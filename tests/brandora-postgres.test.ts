/**
 * The same repository behaviour, against both backends.
 *
 * Production runs on Postgres and the rest of the suite runs on SQLite. That
 * split is only safe if something checks that the two agree, because the ways
 * they differ are quiet: a `COUNT(*)` that comes back as a bigint on one and a
 * number on the other, a JSON column that arrives parsed on one and as a string
 * on the other, a placeholder syntax that is not shared at all.
 *
 * Every assertion below runs twice — once per driver — so a portability
 * mistake fails here rather than in production against real customer data.
 *
 * Set `BRANDORA_TEST_DATABASE_URL` to run the Postgres half. Without it those
 * cases are reported as skipped rather than quietly passing: a suite that says
 * "ok" when it tested nothing is worse than one that says it was not run.
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  type Repositories,
  type SqlDriver,
  createRepositories,
  loadProjectBundle,
  openDatabase,
  openSqlite,
  toPositional,
} from "@brandora/database";

const POSTGRES_URL = process.env["BRANDORA_TEST_DATABASE_URL"] ?? "";

/* --- The placeholder rewrite ------------------------------------------------ */

describe("placeholder rewriting", () => {
  it("numbers each ? in order", () => {
    assert.equal(
      toPositional("SELECT * FROM t WHERE a = ? AND b = ? AND c = ?"),
      "SELECT * FROM t WHERE a = $1 AND b = $2 AND c = $3",
    );
  });

  it("leaves a query with no placeholders alone", () => {
    assert.equal(toPositional("SELECT 1"), "SELECT 1");
  });

  /**
   * The rewrite is a plain scan, so a `?` inside a string literal would be
   * renumbered into nonsense. No query in the package has one; this is what
   * keeps that true.
   */
  it("no repository query contains a ? inside a string literal", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { existsSync } = await import("node:fs");

    let root = import.meta.dirname;
    for (let i = 0; i < 6 && !existsSync(join(root, "pnpm-workspace.yaml")); i += 1) {
      root = dirname(root);
    }

    const source = readFileSync(
      join(root, "packages/brandora-database/src/repositories.ts"),
      "utf8",
    );

    // Every query is a template literal, so only those are scanned — the prose
    // around them is full of apostrophes and none of it reaches the database.
    const queries = source.match(/`[^`]*`/g) ?? [];
    assert.ok(queries.length > 20, `only found ${queries.length} queries — the scan is broken`);

    const offenders = queries
      .flatMap((query) => query.match(/'[^']*'/g) ?? [])
      .filter((literal) => literal.includes("?"));

    assert.deepEqual(offenders, [], `a SQL string literal contains a placeholder: ${offenders}`);
  });
});

/* --- The shared behaviour --------------------------------------------------- */

interface Backend {
  name: string;
  open(): Promise<SqlDriver>;
  /** Postgres keeps its rows between tests; each run needs a clean slate. */
  reset(db: SqlDriver): Promise<void>;
}

const TABLES = [
  "subscribers",
  "order_events",
  "notifications",
  "shipments",
  "quality_checks",
  "payments",
  "orders",
  "supplier_offers",
  "suppliers",
  "quotes",
  "package_items",
  "brand_identities",
  "brand_strategies",
  "interviews",
  "brand_projects",
  "sessions",
  "user_credentials",
  "users",
  "products",
];

const BACKENDS: Backend[] = [
  {
    name: "sqlite",
    open: async () => openSqlite(":memory:"),
    reset: async () => {},
  },
];

if (POSTGRES_URL !== "") {
  BACKENDS.push({
    name: "postgres",
    open: () => openDatabase({ url: POSTGRES_URL, warn: () => {} }),
    reset: async (db) => {
      // Ordered by dependency, so foreign keys never block the wipe.
      for (const table of TABLES) await db.run(`DELETE FROM ${table}`);
    },
  });
}

for (const backend of BACKENDS) {
  describe(`repositories on ${backend.name}`, () => {
    let db: SqlDriver;
    let repos: Repositories;

    before(async () => {
      db = await backend.open();
      repos = createRepositories(db);
    });

    after(async () => {
      await backend.reset(db);
      await db.close();
    });

    const fresh = async () => {
      await backend.reset(db);
      return repos.users.create({ email: `f-${Math.random().toString(36).slice(2)}@example.com`, name: "Ada" });
    };

    it("round-trips an account", async () => {
      const user = await fresh();
      const found = await repos.users.findById(user.id);
      assert.equal(found?.email, user.email);
      assert.equal(found?.role, "customer");
      assert.equal(found?.currency, "XOF");
    });

    it("finds an address regardless of the case it was typed in", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "Founder@Example.COM", name: "Ada" });
      assert.equal(user.email, "founder@example.com");
      assert.ok(await repos.users.findByEmail("FOUNDER@EXAMPLE.COM"));
      assert.ok(await repos.users.findByEmail("founder@example.com"));
    });

    it("refuses a second account on the same address", async () => {
      await backend.reset(db);
      await repos.users.create({ email: "dup@example.com", name: "One" });
      await assert.rejects(() => repos.users.create({ email: "dup@example.com", name: "Two" }));
    });

    it("stores and reads JSON columns identically", async () => {
      const user = await fresh();
      const project = await repos.projects.create(user.id, "Luma");

      await repos.interviews.save(project.id, { answers: [{ field: "business", value: "Bakery" }] }, true);
      const interview = await repos.interviews.findForProject(project.id);

      // The shape that differs between backends: Postgres may hand back a
      // parsed object, SQLite hands back the string it stored.
      const answers = (interview?.responses as { answers?: unknown[] })?.answers;
      assert.ok(Array.isArray(answers), `responses came back as ${typeof interview?.responses}`);
      assert.equal((answers[0] as { value: string }).value, "Bakery");
    });

    it("counts with COUNT(*) as a number, not a bigint", async () => {
      await backend.reset(db);
      const sequence = await repos.quotes.nextSequence("BRA-2026-");
      assert.equal(typeof sequence, "number");
      assert.equal(sequence, 1);
      assert.equal(Number.isInteger(sequence), true);
    });

    it("keeps ownership in the query", async () => {
      await backend.reset(db);
      const owner = await repos.users.create({ email: "owner@example.com", name: "Owner" });
      const stranger = await repos.users.create({ email: "stranger@example.com", name: "Stranger" });
      const project = await repos.projects.create(owner.id, "Luma");

      assert.ok(await repos.projects.findForOwner(project.id, owner.id));
      assert.equal(await repos.projects.findForOwner(project.id, stranger.id), null);
      assert.equal(await loadProjectBundle(repos, project.id, stranger.id), null);
    });

    it("enforces the status CHECK in the database, not the application", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "check@example.com", name: "Ada" });
      await assert.rejects(
        () => db.run(`UPDATE users SET role = 'superuser' WHERE id = ?`, [user.id]),
        /check|constraint/i,
      );
    });

    it("cascades a delete to the rows that depend on it", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "cascade@example.com", name: "Ada" });
      await repos.sessions.create(user.id, "tok", "2099-01-01T00:00:00.000Z");
      await db.run(`DELETE FROM users WHERE id = ?`, [user.id]);
      assert.equal(await repos.sessions.find("tok"), null);
    });

    it("returns the joined project summary in one read", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "summary@example.com", name: "Ada" });
      const project = await repos.projects.create(user.id, "Luma");

      await repos.strategies.save(
        project.id,
        {
          name: "Maison Doré", description: "d", industry: "bakery", positioning: "premium",
          targetCustomer: "t", personality: ["warm"], promise: "p", mission: "m", vision: "v",
          slogan: "s", toneOfVoice: "t", brandStory: "b", nameAlternatives: ["alt"],
        },
        {},
      );
      await repos.identities.save(project.id, {
        palette: [{ name: "Primary", hex: "#4B167A", role: "primary", rationale: "r" }],
        typography: {
          primary: "Playfair Display", primaryFallback: "serif",
          secondary: "Inter", secondaryFallback: "sans-serif", rationale: "r",
        },
        logoBrief: "brief",
      });
      await repos.packages.add(project.id, "prd_cup_kraft_250", 50, "");

      const [summary] = await repos.projects.listSummariesForOwner(user.id);
      assert.ok(summary);
      assert.equal(summary.brandName, "Maison Doré");
      assert.equal(summary.slogan, "s");
      assert.equal(summary.positioning, "premium");
      assert.equal(summary.packageItems, 1);
      assert.equal(summary.palette?.[0]?.hex, "#4B167A");
    });

    it("counts customers and their orders in one admin read", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "counts@example.com", name: "Ada" });
      await repos.projects.create(user.id, "One");
      await repos.projects.create(user.id, "Two");

      const [customer] = await repos.users.listWithCountsAsAdmin(10);
      assert.ok(customer);
      assert.equal(customer.projectCount, 2);
      assert.equal(customer.orderCount, 0);
      assert.equal(typeof customer.projectCount, "number");
    });

    it("rolls a failed transaction back", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "tx@example.com", name: "Ada" });

      await assert.rejects(() =>
        db.transaction(async (tx) => {
          await createRepositories(tx).projects.create(user.id, "Half-written");
          throw new Error("something failed downstream");
        }),
      );

      assert.deepEqual(await repos.projects.listForOwner(user.id), []);
    });

    it("commits a successful transaction", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "tx2@example.com", name: "Ada" });

      await db.transaction(async (tx) => {
        await createRepositories(tx).projects.create(user.id, "Written");
      });

      assert.equal((await repos.projects.listForOwner(user.id)).length, 1);
    });

    it("preserves money as an integer in its own currency", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "money@example.com", name: "Ada" });
      const project = await repos.projects.create(user.id, "Luma");

      const quote = await repos.quotes.create({
        projectId: project.id, userId: user.id, reference: "BRA-2026-9001",
        currency: "XOF", lineItems: [], subtotal: 15_000, shipping: 6_000,
        fees: 2_000, total: 23_000, margin: 5_000,
        validUntil: "2099-01-01T00:00:00.000Z",
      });

      const read = await repos.quotes.findForOwner(quote.id, user.id);
      // 23 000 francs, not 230.00 of anything: XOF has no decimal places.
      assert.equal(read?.total.amount, 23_000);
      assert.equal(read?.total.currency, "XOF");
      assert.equal(Number.isInteger(read?.total.amount), true);
    });

    it("keeps margin off the customer-facing read and on the admin one", async () => {
      await backend.reset(db);
      const user = await repos.users.create({ email: "margin@example.com", name: "Ada" });
      const project = await repos.projects.create(user.id, "Luma");

      const quote = await repos.quotes.create({
        projectId: project.id, userId: user.id, reference: "BRA-2026-9002",
        currency: "XOF", lineItems: [], subtotal: 1, shipping: 0, fees: 0,
        total: 1, margin: 4_242, validUntil: "2099-01-01T00:00:00.000Z",
      });

      const customerView = await repos.quotes.findForOwner(quote.id, user.id);
      assert.equal("margin" in (customerView as object), false);

      const adminView = await repos.quotes.findAsAdmin(quote.id);
      assert.equal(adminView?.margin.amount, 4_242);
    });

    /* --- Suppliers ------------------------------------------------------- */

    it("records a supplier as unverified until someone checks it", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({
        name: "Yiwu Pack Co", platform: "alibaba", externalId: "yw-1",
        categories: ["packaging", "tableware"], customization: ["print"],
      });

      assert.equal(supplier.status, "unverified");
      assert.equal(supplier.verifiedAt, undefined);
      assert.deepEqual(supplier.categories, ["packaging", "tableware"]);

      await repos.suppliers.markVerified(supplier.id);
      const verified = await repos.suppliers.findById(supplier.id);
      assert.equal(verified?.status, "active");
      assert.ok(verified?.verifiedAt);
    });

    it("does not promote a blocked supplier when it is verified", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({ name: "Blocked", platform: "local" });
      await repos.suppliers.setStatus(supplier.id, "blocked", "chargeback");
      await repos.suppliers.markVerified(supplier.id);

      const read = await repos.suppliers.findById(supplier.id);
      assert.equal(read?.status, "blocked", "verifying a supplier un-blocked it");
      assert.equal(read?.riskFlag, "chargeback");
    });

    it("stores recorded counts, not an opinion", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({ name: "Counts", platform: "direct" });

      await repos.suppliers.recordOutcome(supplier.id, { completed: true });
      await repos.suppliers.recordOutcome(supplier.id, { completed: true, late: true });
      await repos.suppliers.recordOutcome(supplier.id, { defect: true, dispute: true });

      const read = await repos.suppliers.findById(supplier.id);
      assert.equal(read?.completedOrders, 2);
      assert.equal(read?.lateOrders, 1);
      assert.equal(read?.defectReports, 1);
      assert.equal(read?.disputes, 1);
      // Integers on both backends — a bigint here would poison every score.
      assert.equal(typeof read?.completedOrders, "number");
    });

    it("leaves an omitted field alone when a supplier is updated", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({
        name: "Partial", platform: "local", country: "CI", notes: "met at the fair",
      });

      const updated = await repos.suppliers.update(supplier.id, { name: "Partial SARL" });
      assert.equal(updated?.name, "Partial SARL");
      assert.equal(updated?.country, "CI");
      assert.equal(updated?.notes, "met at the fair");
    });

    it("finds a supplier by its marketplace identity", async () => {
      await backend.reset(db);
      await repos.suppliers.create({ name: "AE", platform: "aliexpress", externalId: "ae-99" });
      assert.ok(await repos.suppliers.findByExternal("aliexpress", "ae-99"));
      assert.equal(await repos.suppliers.findByExternal("alibaba", "ae-99"), null);
    });

    it("filters suppliers by category without matching a longer word", async () => {
      await backend.reset(db);
      await repos.suppliers.create({ name: "A", platform: "local", categories: ["cup"] });
      await repos.suppliers.create({ name: "B", platform: "local", categories: ["cupboard"] });

      const found = await repos.suppliers.list({ category: "cup" });
      assert.deepEqual(found.map((supplier) => supplier.name), ["A"]);
    });

    /* --- Offers ---------------------------------------------------------- */

    it("keeps one row per price break and replaces it when re-checked", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({ name: "Tiered", platform: "alibaba" });

      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_cup_kraft_250",
        fromQuantity: 1, unitCost: 200, currency: "XOF", minimumOrder: 1,
      });
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_cup_kraft_250",
        fromQuantity: 500, unitCost: 120, currency: "XOF", minimumOrder: 1,
      });
      // The same tier again, at a new price.
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_cup_kraft_250",
        fromQuantity: 1, unitCost: 190, currency: "XOF", minimumOrder: 1,
      });

      const offers = await repos.supplierOffers.listForSupplier(supplier.id);
      assert.equal(offers.length, 2, "a re-check created a duplicate tier");
      assert.equal(offers.find((offer) => offer.fromQuantity === 1)?.unitCost.amount, 190);
    });

    it("does not offer a price break the quantity has not reached", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({ name: "Breaks", platform: "alibaba" });
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_x", fromQuantity: 1,
        unitCost: 200, currency: "XOF", minimumOrder: 1,
      });
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_x", fromQuantity: 500,
        unitCost: 120, currency: "XOF", minimumOrder: 1,
      });

      const atThirty = await repos.supplierOffers.listForProduct("prd_x", 30);
      assert.deepEqual(atThirty.map((offer) => offer.unitCost.amount), [200]);

      const atFiveHundred = await repos.supplierOffers.listForProduct("prd_x", 500);
      assert.deepEqual(atFiveHundred.map((offer) => offer.unitCost.amount), [120, 200]);
    });

    it("excludes an offer whose own minimum the quantity does not meet", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({ name: "High MOQ", platform: "alibaba" });
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_y", fromQuantity: 1,
        unitCost: 90, currency: "XOF", minimumOrder: 1_000,
      });

      assert.deepEqual(await repos.supplierOffers.listForProduct("prd_y", 30), []);
      assert.equal((await repos.supplierOffers.listForProduct("prd_y", 1_000)).length, 1);
    });

    it("keeps an offer's money in its own currency, as an integer", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({ name: "Money", platform: "local" });
      const offer = await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_z",
        unitCost: 1_250, currency: "XOF", setupCost: 15_000, shippingCost: 40_000,
      });

      assert.equal(offer.unitCost.amount, 1_250);
      assert.equal(offer.unitCost.currency, "XOF");
      assert.equal(offer.setupCost.amount, 15_000);
      assert.equal(offer.shippingCost?.amount, 40_000);
      assert.equal(Number.isInteger(offer.unitCost.amount), true);
    });

    it("finds offers nobody has confirmed lately", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({ name: "Stale", platform: "local" });
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_old", unitCost: 1, currency: "XOF",
        lastCheckedAt: "2020-01-01T00:00:00.000Z",
      });
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_new", unitCost: 1, currency: "XOF",
      });

      const stale = await repos.supplierOffers.listStale("2024-01-01T00:00:00.000Z");
      assert.deepEqual(stale.map((offer) => offer.productId), ["prd_old"]);
    });

    it("drops a supplier's offers with the supplier", async () => {
      await backend.reset(db);
      const supplier = await repos.suppliers.create({ name: "Gone", platform: "local" });
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_a", unitCost: 1, currency: "XOF",
      });
      await repos.suppliers.remove(supplier.id);
      assert.deepEqual(await repos.supplierOffers.listForProduct("prd_a"), []);
    });

    /* --- Quality, shipments, notifications -------------------------------- */

    const anOrder = async () => {
      const user = await repos.users.create({ email: `o-${Math.random().toString(36).slice(2)}@example.com`, name: "Ada" });
      const project = await repos.projects.create(user.id, "Luma");
      const quote = await repos.quotes.create({
        projectId: project.id, userId: user.id, reference: `BRA-${Math.random().toString(36).slice(2, 8)}`,
        currency: "XOF", lineItems: [], subtotal: 1_000, shipping: 0, fees: 0,
        total: 1_000, margin: 0, validUntil: "2099-01-01T00:00:00.000Z",
      });
      const order = await repos.orders.create({
        userId: user.id, projectId: project.id, quoteId: quote.id,
        reference: `ORD-${Math.random().toString(36).slice(2, 8)}`,
        total: 1_000, currency: "XOF",
      });
      return { user, order };
    };

    it("opens a quality check without claiming it was inspected", async () => {
      await backend.reset(db);
      const { order } = await anOrder();

      const check = await repos.qualityChecks.create({
        orderId: order.id, kind: "sample", inspectedBy: "usr_admin",
      });

      assert.equal(check.outcome, "pending");
      // The one that matters: an opened check is not a carried-out check.
      assert.equal(check.inspectedAt, undefined);

      const done = await repos.qualityChecks.recordOutcome(check.id, {
        outcome: "failed", defects: ["print off-centre", "lid does not seat"],
        notes: "Rejected, asked for a second sample.",
      });
      assert.equal(done?.outcome, "failed");
      assert.deepEqual(done?.defects, ["print off-centre", "lid does not seat"]);
      assert.ok(done?.inspectedAt, "a recorded outcome has no inspection time");
    });

    it("never invents an estimated delivery date", async () => {
      await backend.reset(db);
      const { order } = await anOrder();

      const shipment = await repos.shipments.create({ orderId: order.id });
      assert.equal(shipment.status, "preparing");
      assert.equal(shipment.estimatedDelivery, undefined);
      assert.equal(shipment.trackingNumber, undefined);

      const updated = await repos.shipments.update(shipment.id, {
        carrier: "DHL", trackingNumber: "JD0002", status: "in-transit",
      });
      assert.equal(updated?.carrier, "DHL");
      assert.equal(updated?.status, "in-transit");
      // Still not quoted, still not guessed.
      assert.equal(updated?.estimatedDelivery, undefined);
    });

    it("queues a notification and records whether it was actually sent", async () => {
      await backend.reset(db);
      const { user, order } = await anOrder();

      const notification = await repos.notifications.create({
        userId: user.id, orderId: order.id, kind: "order.paid",
        channel: "email", subject: "Your order", body: "We have your payment.",
      });

      assert.equal(notification.status, "pending");
      assert.equal(notification.attempts, 0);
      assert.equal((await repos.notifications.pending()).length, 1);

      await repos.notifications.markSent(notification.id);
      const sent = await repos.notifications.findById(notification.id);
      assert.equal(sent?.status, "sent");
      assert.equal(sent?.attempts, 1);
      assert.ok(sent?.sentAt);
      assert.deepEqual(await repos.notifications.pending(), []);
    });

    it("records an address once, however many times it is submitted", async () => {
      await backend.reset(db);

      const first = await repos.subscribers.add({ email: "Founder@Example.COM", source: "homepage" });
      const second = await repos.subscribers.add({ email: "founder@example.com", source: "homepage" });

      assert.equal(first.added, true);
      // The second call did not add it — and said so, which is what the log
      // needs. The visitor is told the same thing either way; that is the
      // route's job, not the repository's.
      assert.equal(second.added, false);
      assert.equal(await repos.subscribers.count(), 1);

      const [row] = await repos.subscribers.listAsAdmin();
      // Lowercased on write, so the same person cannot be on the list twice
      // with different capitalisation.
      assert.equal(row?.email, "founder@example.com");
      assert.equal(row?.source, "homepage");
      assert.equal(row?.locale, "en");
    });

    it("retries a failed notification, then abandons it", async () => {
      await backend.reset(db);
      const { user } = await anOrder();

      const notification = await repos.notifications.create({
        userId: user.id, kind: "order.paid", channel: "email",
        subject: "s", body: "b",
      });

      await repos.notifications.markFailed(notification.id, "550 no such mailbox", 3);
      let read = await repos.notifications.findById(notification.id);
      assert.equal(read?.status, "pending", "a first failure should be retried");
      assert.equal(read?.attempts, 1);
      assert.equal(read?.lastError, "550 no such mailbox");

      await repos.notifications.markFailed(notification.id, "550", 3);
      await repos.notifications.markFailed(notification.id, "550", 3);
      read = await repos.notifications.findById(notification.id);

      // A permanently-bouncing address stops being retried rather than being
      // attempted until the end of time.
      assert.equal(read?.status, "abandoned");
      assert.equal(read?.attempts, 3);
      assert.deepEqual(await repos.notifications.pending(), []);
    });
  });
}

if (POSTGRES_URL === "") {
  describe("postgres", () => {
    it("was not exercised — set BRANDORA_TEST_DATABASE_URL to run it", { skip: true }, () => {});
  });
}
