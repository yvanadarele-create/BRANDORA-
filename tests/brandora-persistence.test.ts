import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  type Repositories,
  createRepositories,
  type SqlDriver,
  loadProjectBundle,
  openSqlite,
  toBrandProfile,
  transaction,
} from "@brandora/database";

let repos: Repositories;
let db: SqlDriver;

beforeEach(() => {
  db = openSqlite(":memory:");
  repos = createRepositories(db);
});

const makeUser = (email = "founder@example.com") =>
  repos.users.create({ email, name: "Ada Founder" });

/* --- Users ---------------------------------------------------------------- */

describe("users", () => {
  test("an account is created with the customer role by default", async () => {
    const user = await makeUser();
    assert.equal(user.role, "customer");
    assert.equal(user.currency, "XOF");
    assert.equal(user.locale, "en");
  });

  test("email is stored lowercased and looked up case-insensitively", async () => {
    await makeUser("Founder@Example.COM");
    const found = await repos.users.findByEmail("founder@example.com");
    assert.ok(found);
    assert.equal(found.email, "founder@example.com");
    assert.ok(await repos.users.findByEmail("FOUNDER@EXAMPLE.COM"));
  });

  test("two accounts cannot share an address", async () => {
    await makeUser();
    await assert.rejects(() => makeUser(), /UNIQUE|constraint/i);
  });

  test("a user row never carries a password hash", async () => {
    const user = await makeUser();
    await repos.users.setCredentials(user.id, "hash", "salt");
    const fetched = (await repos.users.findById(user.id))!;
    assert.ok(!JSON.stringify(fetched).includes("hash"));
    assert.ok(!("passwordHash" in (fetched as object)));
  });

  test("credentials are fetched only by an explicit, separate call", async () => {
    const user = await makeUser();
    await repos.users.setCredentials(user.id, "the-hash", "the-salt");
    const credentials = (await repos.users.credentialsFor(user.id))!;
    assert.equal(credentials.passwordHash, "the-hash");
    assert.equal(credentials.passwordSalt, "the-salt");
  });

  test("setting credentials twice replaces rather than duplicates", async () => {
    const user = await makeUser();
    await repos.users.setCredentials(user.id, "old", "salt1");
    await repos.users.setCredentials(user.id, "new", "salt2");
    assert.equal((await repos.users.credentialsFor(user.id))!.passwordHash, "new");
  });

  test("an unknown role is refused by the database, not just the application", async () => {
    const user = await makeUser();
    await assert.rejects(
      () => db.run(`UPDATE users SET role = 'superuser' WHERE id = ?`, [user.id]),
      /CHECK|constraint/i,
    );
  });
});

/* --- Sessions ------------------------------------------------------------- */

describe("sessions", () => {
  test("a session can be created, found and destroyed", async () => {
    const user = await makeUser();
    await repos.sessions.create(user.id, "token-1", "2099-01-01T00:00:00.000Z");
    assert.equal((await repos.sessions.find("token-1"))!.userId, user.id);
    await repos.sessions.destroy("token-1");
    assert.equal(await repos.sessions.find("token-1"), null);
  });

  test("logging out everywhere destroys every session for that user", async () => {
    const user = await makeUser();
    await repos.sessions.create(user.id, "a", "2099-01-01T00:00:00.000Z");
    await repos.sessions.create(user.id, "b", "2099-01-01T00:00:00.000Z");
    await repos.sessions.destroyAllFor(user.id);
    assert.equal(await repos.sessions.find("a"), null);
    assert.equal(await repos.sessions.find("b"), null);
  });

  test("expired sessions are purged and live ones are left alone", async () => {
    const user = await makeUser();
    await repos.sessions.create(user.id, "old", "2020-01-01T00:00:00.000Z");
    await repos.sessions.create(user.id, "live", "2099-01-01T00:00:00.000Z");
    assert.equal(await repos.sessions.purgeExpired("2026-01-01T00:00:00.000Z"), 1);
    assert.equal(await repos.sessions.find("old"), null);
    assert.ok(await repos.sessions.find("live"));
  });

  test("deleting a user takes their sessions with them", async () => {
    const user = await makeUser();
    await repos.sessions.create(user.id, "t", "2099-01-01T00:00:00.000Z");
    await db.run(`DELETE FROM users WHERE id = ?`, [user.id]);
    assert.equal(await repos.sessions.find("t"), null);
  });
});

/* --- Ownership ------------------------------------------------------------ */

describe("project ownership is part of the query, not a check after it", () => {
  test("the owner finds their project", async () => {
    const user = await makeUser();
    const project = await repos.projects.create(user.id, "Luma");
    assert.ok(await repos.projects.findForOwner(project.id, user.id));
  });

  test("another user does not find it — it is absent, not refused", async () => {
    const owner = await makeUser("owner@example.com");
    const stranger = await makeUser("stranger@example.com");
    const project = await repos.projects.create(owner.id, "Luma");
    assert.equal(await repos.projects.findForOwner(project.id, stranger.id), null);
  });

  test("listing is scoped to the owner", async () => {
    const owner = await makeUser("owner@example.com");
    const stranger = await makeUser("stranger@example.com");
    await repos.projects.create(owner.id, "Mine");
    await repos.projects.create(stranger.id, "Theirs");
    const listed = await repos.projects.listForOwner(owner.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.name, "Mine");
  });

  test("a write scoped to the wrong owner changes nothing", async () => {
    const owner = await makeUser("owner@example.com");
    const stranger = await makeUser("stranger@example.com");
    const project = await repos.projects.create(owner.id, "Luma");
    await repos.projects.rename(project.id, stranger.id, "Hijacked");
    assert.equal((await repos.projects.findForOwner(project.id, owner.id))!.name, "Luma");
  });

  test("quotes and orders are scoped the same way", async () => {
    const owner = await makeUser("owner@example.com");
    const stranger = await makeUser("stranger@example.com");
    const project = await repos.projects.create(owner.id, "Luma");

    const quote = await repos.quotes.create({
      projectId: project.id, userId: owner.id, reference: "BRA-2026-0001",
      currency: "XOF", lineItems: [], subtotal: 15_000, shipping: 6_000,
      fees: 1_900, total: 22_900, margin: 5_400, validUntil: "2099-01-01T00:00:00.000Z",
    });
    assert.equal(await repos.quotes.findForOwner(quote.id, stranger.id), null);
    assert.ok(await repos.quotes.findForOwner(quote.id, owner.id));

    const order = await repos.orders.create({
      userId: owner.id, projectId: project.id, quoteId: quote.id,
      reference: "ORD-1", total: 22_900, currency: "XOF",
    });
    assert.equal(await repos.orders.findForOwner(order.id, stranger.id), null);
    assert.ok(await repos.orders.findForOwner(order.id, owner.id));
  });

  test("an admin read is a separately named method, impossible to reach by accident", async () => {
    const owner = await makeUser();
    const project = await repos.projects.create(owner.id, "Luma");
    assert.ok(await repos.projects.findAsAdmin(project.id));
    assert.equal((await repos.projects.listAsAdmin()).length, 1);
  });
});

/* --- Margin privacy ------------------------------------------------------- */

describe("§39 margin never reaches a customer-facing read", () => {
  test("the customer's quote object has no margin field at any depth", async () => {
    const user = await makeUser();
    const project = await repos.projects.create(user.id, "Luma");
    const quote = await repos.quotes.create({
      projectId: project.id, userId: user.id, reference: "BRA-2026-0002",
      currency: "XOF", lineItems: [{ productId: "p", description: "cups", quantity: 30, unitPrice: 500, total: 15_000 }],
      subtotal: 15_000, shipping: 6_000, fees: 1_900, total: 22_900,
      margin: 5_444, validUntil: "2099-01-01T00:00:00.000Z",
    });

    const customerView = (await repos.quotes.findForOwner(quote.id, user.id))!;
    assert.ok(!("margin" in (customerView as object)));
    assert.ok(!JSON.stringify(customerView).includes("5444"));

    const adminView = (await repos.quotes.findAsAdmin(quote.id))!;
    assert.equal(adminView.margin.amount, 5_444, "the admin view does carry it");
  });
});

/* --- Money round-trips ---------------------------------------------------- */

describe("money survives the database", () => {
  test("an XOF amount is stored and read back as the same integer", async () => {
    const user = await makeUser();
    const project = await repos.projects.create(user.id, "Luma");
    const quote = await repos.quotes.create({
      projectId: project.id, userId: user.id, reference: "BRA-2026-0003",
      currency: "XOF", lineItems: [], subtotal: 1_500, shipping: 0, fees: 0,
      total: 1_500, margin: 0, validUntil: "2099-01-01T00:00:00.000Z",
    });
    const read = (await repos.quotes.findForOwner(quote.id, user.id))!;
    assert.deepEqual(read.total, { amount: 1_500, currency: "XOF" });
  });

  test("an amount always comes back with its currency attached", async () => {
    const user = await repos.users.create({ email: "usd@example.com", name: "U", currency: "USD" });
    const project = await repos.projects.create(user.id, "Dollars");
    const quote = await repos.quotes.create({
      projectId: project.id, userId: user.id, reference: "BRA-2026-0004",
      currency: "USD", lineItems: [], subtotal: 1_250, shipping: 0, fees: 0,
      total: 1_250, margin: 0, validUntil: "2099-01-01T00:00:00.000Z",
    });
    assert.equal((await repos.quotes.findForOwner(quote.id, user.id))!.total.currency, "USD");
  });
});

/* --- Project bundle ------------------------------------------------------- */

describe("the project bundle", () => {
  test("an interview can be saved, resumed and completed", async () => {
    const user = await makeUser();
    const project = await repos.projects.create(user.id, "Luma");

    await repos.interviews.save(project.id, { business: "A bakery" }, false);
    let interview = (await repos.interviews.findForProject(project.id))!;
    assert.equal(interview.completedAt, undefined, "an in-progress interview has no completion");
    assert.deepEqual(interview.responses, { business: "A bakery" });

    await repos.interviews.save(project.id, { business: "A bakery", product: "Cookies" }, true);
    interview = (await repos.interviews.findForProject(project.id))!;
    assert.ok(interview.completedAt);
    assert.equal(Object.keys(interview.responses).length, 2, "saving replaces, never duplicates");
  });

  test("a strategy and identity round-trip into a BrandProfile the engine accepts", async () => {
    const user = await makeUser();
    const project = await repos.projects.create(user.id, "Luma");

    await repos.strategies.save(project.id, {
      name: "Luma", description: "A home bakery", industry: "bakery",
      positioning: "premium", targetCustomer: "Young professionals",
      personality: ["elegant", "warm"], promise: "Baked this morning",
      mission: "m", vision: "v", slogan: "Baked this morning.",
      toneOfVoice: "warm", brandStory: "story", nameAlternatives: ["Sablé"],
    }, { echoed: true });

    await repos.identities.save(project.id, {
      palette: [{ name: "Primary", hex: "#6D2C47", role: "primary", rationale: "r" }],
      typography: {
        primary: "Playfair Display", secondary: "Inter",
        primaryFallback: "Georgia, serif", secondaryFallback: "system-ui",
        rationale: "r",
      },
      logoBrief: "Minimal geometric mark",
    });

    const bundle = (await loadProjectBundle(repos, project.id, user.id))!;
    assert.ok(bundle.strategy);
    assert.ok(bundle.identity);
    assert.deepEqual(bundle.strategy.personality, ["elegant", "warm"]);

    const profile = toBrandProfile(bundle)!;
    assert.equal(profile.name, "Luma");
    assert.equal(profile.positioning, "premium");
    assert.equal(profile.palette[0]!.hex, "#6D2C47");
    assert.equal(profile.typography.primary, "Playfair Display");
  });

  test("the bundle is null for someone else's project", async () => {
    const owner = await makeUser("owner@example.com");
    const stranger = await makeUser("stranger@example.com");
    const project = await repos.projects.create(owner.id, "Luma");
    assert.equal(await loadProjectBundle(repos, project.id, stranger.id), null);
  });

  test("a profile cannot be assembled from a half-generated project", async () => {
    const user = await makeUser();
    const project = await repos.projects.create(user.id, "Luma");
    assert.equal(toBrandProfile((await loadProjectBundle(repos, project.id, user.id))!), null);
  });
});

/* --- Orders --------------------------------------------------------------- */

describe("orders", () => {
  const seed = async () => {
    const user = await makeUser();
    const project = await repos.projects.create(user.id, "Luma");
    const quote = await repos.quotes.create({
      projectId: project.id, userId: user.id, reference: "BRA-2026-0005",
      currency: "XOF", lineItems: [], subtotal: 15_000, shipping: 6_000,
      fees: 1_900, total: 22_900, margin: 5_400, validUntil: "2099-01-01T00:00:00.000Z",
    });
    return { user, project, quote };
  };

  test("a new order is unpaid and pending — never optimistically paid", async () => {
    const { user, project, quote } = await seed();
    const order = await repos.orders.create({
      userId: user.id, projectId: project.id, quoteId: quote.id,
      reference: "ORD-1", total: 22_900, currency: "XOF",
    });
    assert.equal(order.paymentStatus, "unpaid");
    assert.equal(order.fulfillmentStatus, "pending");
  });

  test("the event log is append-only and ordered", async () => {
    const { user, project, quote } = await seed();
    const order = await repos.orders.create({
      userId: user.id, projectId: project.id, quoteId: quote.id,
      reference: "ORD-2", total: 22_900, currency: "XOF",
    });
    await repos.orders.addEvent(order.id, "created", "system");
    await repos.orders.addEvent(order.id, "payment-verified", "system:paystack", "ref=abc");
    const events = await repos.orders.events(order.id);
    assert.equal(events.length, 2);
    assert.equal(events[0]!.kind, "created");
    assert.equal(events[1]!.detail, "ref=abc");
  });

  test("an order cannot reference a quote that does not exist", async () => {
    const user = await makeUser();
    const project = await repos.projects.create(user.id, "Luma");
    await assert.rejects(
      () => repos.orders.create({
        userId: user.id, projectId: project.id, quoteId: "qte_missing",
        reference: "ORD-3", total: 1, currency: "XOF",
      }),
      /FOREIGN KEY|constraint/i,
    );
  });

  test("an unknown payment status is refused by the database", async () => {
    const { user, project, quote } = await seed();
    const order = await repos.orders.create({
      userId: user.id, projectId: project.id, quoteId: quote.id,
      reference: "ORD-4", total: 1, currency: "XOF",
    });
    await assert.rejects(
      () => db.run(`UPDATE orders SET payment_status = 'definitely-paid' WHERE id = ?`, [order.id]),
      /CHECK|constraint/i,
    );
  });
});

/* --- Transactions --------------------------------------------------------- */

describe("transactions", () => {
  test("a failure rolls the whole unit of work back", async () => {
    const user = await makeUser();
    await assert.rejects(() =>
      transaction(db, async () => {
        await repos.projects.create(user.id, "Half-written");
        throw new Error("something failed downstream");
      }),
    );
    assert.equal((await repos.projects.listForOwner(user.id)).length, 0);
  });

  test("a successful transaction commits", async () => {
    const user = await makeUser();
    await transaction(db, async () => {
      await repos.projects.create(user.id, "Committed");
    });
    assert.equal((await repos.projects.listForOwner(user.id)).length, 1);
  });
});

/**
 * A malformed value in a JSON array column must not poison the row for ever.
 *
 * `fromJson<string[]>` casts whatever it parsed and trusts the type argument.
 * When a model returned "warm, reliable" instead of ["warm","reliable"], the
 * value parsed back as a string, satisfied the compiler, and threw
 * `personality.join is not a function` on every subsequent read — a permanent
 * 500 on the brand book, fixable only by editing the database.
 */
describe("a JSON array column survives a value that is not an array", () => {
  test("wraps a single string rather than throwing or dropping it", async () => {
    const db = openSqlite(":memory:");
    const repos = createRepositories(db);

    const user = await repos.users.create({ email: `shape-${Date.now()}@example.com`, name: "Shape" });
    const project = await repos.projects.create(user.id, "Shape test");

    // Exactly what a model returning prose instead of a list would store.
    await repos.strategies.save(project.id, {
      name: "Maison Doré", description: "A bakery", industry: "bakery",
      positioning: "accessible-premium", targetCustomer: "Families",
      personality: "chaleureux, fiable" as unknown as string[],
      promise: "Baked this morning", mission: "m", vision: "v", slogan: "s",
      toneOfVoice: "warm", brandStory: "story", nameAlternatives: [],
    }, "{}");

    const read = await repos.strategies.findForProject(project.id);
    assert.ok(read, "the strategy was not saved");
    assert.ok(Array.isArray(read.personality), "personality must read back as an array");
    // The words are kept, not discarded — somebody meant them.
    assert.deepEqual(read.personality, ["chaleureux", "fiable"]);
    // And the thing that used to throw now works.
    assert.equal(read.personality.join(" · "), "chaleureux · fiable");

    await db.close();
  });

  test("a proper array is untouched", async () => {
    const db = openSqlite(":memory:");
    const repos = createRepositories(db);
    const user = await repos.users.create({ email: `shape2-${Date.now()}@example.com`, name: "S" });
    const project = await repos.projects.create(user.id, "Shape test");

    await repos.strategies.save(project.id, {
      name: "N", description: "d", industry: "bakery", positioning: "premium",
      targetCustomer: "t", personality: ["warm", "elegant"], promise: "p",
      mission: "m", vision: "v", slogan: "s", toneOfVoice: "t", brandStory: "b",
      nameAlternatives: [],
    }, "{}");

    const read = await repos.strategies.findForProject(project.id);
    assert.deepEqual(read?.personality, ["warm", "elegant"]);
    await db.close();
  });
});
