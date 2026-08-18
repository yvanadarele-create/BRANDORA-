/**
 * API integration tests.
 *
 * These drive a real HTTP server over a real socket rather than calling the
 * handlers directly, because the things most likely to be wrong live in the
 * transport: whether the session cookie is actually set, whether it comes back,
 * whether a 404 is a 404. A test that calls `createRouter(...).match(...)` by
 * hand proves the routing table compiles and nothing else.
 *
 * The database is `:memory:` per test, so there is no shared fixture state and
 * nothing to clean up.
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createApp } from "@brandora/server";
import type { PaymentProvider, PaymentIntent, VerificationResult } from "@brandora/server";
import { EXAMPLE_CATALOG } from "@brandora/catalog";
import { openSqlite } from "@brandora/database";
import { type Money, money } from "@brandora/shared";
import type { StrategyProvider } from "@brandora/brand-engine";

/* --- Test doubles ---------------------------------------------------------- */

/**
 * A provider that returns a fixed, valid strategy.
 *
 * Not a "mock AI" in the sense the spec forbids: production uses the real
 * provider, and the unconfigured one *fails* rather than fabricating. This
 * exists so the route can be tested without a paid call.
 */
const STUB_STRATEGY = JSON.stringify({
  name: "Maison Doré",
  nameAlternatives: ["Doré", "La Maison", "Atelier Doré"],
  description: "A home bakery selling butter cookies to offices in Abidjan.",
  industry: "bakery",
  targetCustomer: "Office workers ordering for their team",
  promise: "Baked the morning you receive them.",
  mission: "Make a small daily luxury ordinary.",
  vision: "The name people say when they mean good cookies.",
  slogan: "Baked this morning",
  toneOfVoice: "Warm, direct, never fussy.",
  brandStory: "It started with one tin of cookies taken to an office and never came back empty.",
});

class StubStrategyProvider implements StrategyProvider {
  calls = 0;
  constructor(private readonly reply: string = STUB_STRATEGY) {}
  async complete(): Promise<string> {
    this.calls += 1;
    return this.reply;
  }
}

/** A payment provider whose verification result the test controls. */
class StubPaymentProvider implements PaymentProvider {
  readonly name = "stub";
  readonly configured = true;
  /** What the provider will claim was paid. Set by the test. */
  reported: Money | null = null;
  paid = false;
  initialised: { reference: string; amount: Money } | null = null;

  async initialise(input: { reference: string; amount: Money }): Promise<PaymentIntent> {
    this.initialised = { reference: input.reference, amount: input.amount };
    return {
      reference: input.reference,
      authorizationUrl: `https://pay.example/${input.reference}`,
      instruction: "Continue to payment.",
      provider: this.name,
    };
  }

  async verify(): Promise<VerificationResult> {
    return {
      paid: this.paid,
      amount: this.reported,
      providerStatus: this.paid ? "success" : "pending",
    };
  }
}

/* --- Harness --------------------------------------------------------------- */

const ENV: Record<string, string> = {
  BRANDORA_AUTH_SECRET: "test-secret-not-a-real-one",
  BRANDORA_DEFAULT_CURRENCY: "XOF",
  BRANDORA_PUBLIC_BASE_URL: "http://127.0.0.1",
  BRANDORA_MARGIN_RATE: "0.35",
  BRANDORA_LOGISTICS_RATE: "0.08",
  BRANDORA_DELIVERY_FLAT: "3000",
  BRANDORA_DELIVERY_PER_KG: "1200",
  BRANDORA_ROUNDING_STEP: "100",
};

/**
 * Every request in this file comes from 127.0.0.1, so the address-keyed limits
 * would throttle the harness rather than anything under test. The limiter has
 * its own test below; here it is turned up out of the way.
 */
const LIMITS = {
  loginsPerWindow: 10_000,
  signupsPerWindow: 10_000,
  generationsPerWindow: 10_000,
};

interface Harness {
  base: string;
  server: Server;
  app: Awaited<ReturnType<typeof createApp>>;
  strategy: StubStrategyProvider;
  payments: StubPaymentProvider;
  close(): Promise<void>;
}

async function start(): Promise<Harness> {
  const strategy = new StubStrategyProvider();
  const payments = new StubPaymentProvider();
  const app = await createApp({
    db: openSqlite(":memory:"),
    // The shipped catalogue is empty by decision, so a test that needs
    // products supplies its own. See packages/brandora-catalog/src/seed.ts.
    catalog: EXAMPLE_CATALOG,
    env: ENV,
    strategy,
    payments,
    secureCookies: false,
    logger: { error: () => {} },
    rateLimits: LIMITS,
  });

  const server = createServer(app.listener);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as AddressInfo).port;

  return {
    base: `http://127.0.0.1:${port}`,
    server,
    app,
    strategy,
    payments,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => {
          void app.db.close().finally(done);
        });
      }),
  };
}

/** A client that keeps its cookies, so a session behaves as a browser's would. */
class Client {
  private cookie = "";

  constructor(private readonly base: string) {}

  async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: Record<string, any> }> {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const pair = raw.split(";")[0] ?? "";
      if (pair.endsWith("=")) this.cookie = "";
      else this.cookie = pair;
    }

    const text = await response.text();
    let parsed: Record<string, any> = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { _raw: text };
      }
    }
    return { status: response.status, json: parsed };
  }

  get = (path: string) => this.request("GET", path);
  post = (path: string, body?: unknown) => this.request("POST", path, body ?? {});
  patch = (path: string, body?: unknown) => this.request("PATCH", path, body ?? {});
  del = (path: string) => this.request("DELETE", path);

  /** Whether this client is currently carrying a session cookie. */
  get hasSession(): boolean {
    return this.cookie !== "";
  }
}

const PASSWORD = "correct-horse-battery";

async function signUp(h: Harness, email: string): Promise<Client> {
  const client = new Client(h.base);
  const response = await client.post("/api/auth/signup", {
    email,
    name: "Aïcha Traoré",
    password: PASSWORD,
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return client;
}

/** Promote a user to admin the way an operator would: directly in the database. */
async function makeAdmin(h: Harness, email: string): Promise<void> {
  const user = await h.app.repos.users.findByEmail(email);
  assert.ok(user);
  await h.app.repos.users.setRole(user.id, "admin");
}

const ANSWERS = [
  { field: "business", value: "A home bakery selling butter cookies" },
  { field: "product", value: "Butter cookies in tins" },
  { field: "audience", value: "Office workers ordering for their team" },
  { field: "positioning", value: "accessible-premium" },
  { field: "personality", value: ["warm", "elegant"] },
  { field: "differentiation", value: "Baked the same morning" },
  { field: "style", value: "Clean and warm" },
];

/** Walk a client all the way to a project with a generated brand. */
async function projectWithBrand(client: Client): Promise<string> {
  const created = await client.post("/api/projects", { name: "Untitled brand" });
  const projectId = created.json["project"].id as string;
  await client.request("PUT", `/api/projects/${projectId}/interview`, { answers: ANSWERS });
  const generated = await client.post(`/api/projects/${projectId}/generate`);
  assert.equal(generated.status, 201, JSON.stringify(generated.json));
  return projectId;
}

/* --- Tests ----------------------------------------------------------------- */

describe("a deployment that is not fully configured", () => {
  it("names the missing variables without ever reading one", async () => {
    const { configurationGaps } = await import("@brandora/config");

    const bare = configurationGaps({});
    assert.deepEqual(bare.required, ["BRANDORA_AUTH_SECRET"]);
    assert.deepEqual(bare.recommended, ["BRANDORA_DATABASE_URL", "ANTHROPIC_API_KEY"]);

    const configured = configurationGaps({
      BRANDORA_AUTH_SECRET: "s", BRANDORA_DATABASE_URL: "postgres://x", ANTHROPIC_API_KEY: "k",
    });
    assert.deepEqual(configured.required, []);
    assert.deepEqual(configured.recommended, []);

    // Whitespace is not configuration.
    assert.deepEqual(configurationGaps({ BRANDORA_AUTH_SECRET: "   " }).required, ["BRANDORA_AUTH_SECRET"]);

    // Names only. A value must never come back from this, because the whole
    // point of it is to be safe to put in a 503 body.
    const serialised = JSON.stringify(configurationGaps({ BRANDORA_AUTH_SECRET: "super-secret-value" }));
    assert.equal(serialised.includes("super-secret-value"), false);
  });
});

describe("a failed sign-in", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(() => h.close());

  it("says the credentials are wrong, not that a field looks odd", async () => {
    await signUp(h, "real-account@example.com");

    const client = new Client(h.base);
    const wrongPassword = await client.post("/api/auth/login", {
      email: "real-account@example.com", password: "not-the-password",
    });
    const noAccount = await client.post("/api/auth/login", {
      email: "nobody-here@example.com", password: "not-the-password",
    });

    // The key drives the translation, so this is what decides whether a French
    // visitor reads "votre mot de passe est incorrect" or a generic sentence
    // about a form field. It used to be input.invalid.
    assert.equal(wrongPassword.json["error"], "auth.invalid");
    assert.equal(wrongPassword.status, 401);

    // And the two failures are indistinguishable, so the form cannot be used
    // to find out which addresses have accounts.
    assert.equal(noAccount.status, wrongPassword.status);
    assert.deepEqual(noAccount.json, wrongPassword.json);
  });
});

describe("testimonials", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(() => h.close());

  it("shows nothing until a real quote is approved", async () => {
    const anyone = new Client(h.base);
    assert.deepEqual((await anyone.get("/api/testimonials")).json["testimonials"], []);

    // Created by an administrator, and still not public.
    const created = await h.app.repos.testimonials.create({
      quote: "They found a supplier who could actually do 200.",
      authorName: "A Real Person",
      consentAt: new Date().toISOString(),
    });
    assert.equal(created.approved, false);
    assert.deepEqual((await anyone.get("/api/testimonials")).json["testimonials"], []);

    await h.app.repos.testimonials.setApproved(created.id, true);
    const shown = (await anyone.get("/api/testimonials")).json["testimonials"];
    assert.equal(shown.length, 1);
    assert.equal(shown[0].authorName, "A Real Person");
  });

  it("never puts operational fields on the public response", async () => {
    const t = await h.app.repos.testimonials.create({
      quote: "q", authorName: "n", consentAt: new Date().toISOString(),
    });
    await h.app.repos.testimonials.setApproved(t.id, true);

    const [entry] = (await new Client(h.base).get("/api/testimonials")).json["testimonials"];
    // The consent date and the row id are operational facts. A public
    // response has no use for either.
    for (const field of ["id", "consentAt", "approved", "position", "locale", "createdAt"]) {
      assert.equal(field in entry, false, `${field} reached the public response`);
    }
  });

  it("refuses to publish a quote with no recorded consent", async () => {
    await signUp(h, "t-admin@example.com");
    await makeAdmin(h, "t-admin@example.com");
    const admin = new Client(h.base);
    await admin.post("/api/auth/login", { email: "t-admin@example.com", password: PASSWORD });

    const created = await admin.post("/api/admin/testimonials", {
      quote: "Said in a WhatsApp message.", authorName: "Someone",
    });
    assert.equal(created.status, 201);
    assert.equal(created.json["testimonial"].consentAt, null);

    // A quote is somebody's words with their name on it. Publishing without a
    // record that they agreed is the thing this check exists to prevent.
    const publish = await admin.patch(`/api/admin/testimonials/${created.json["testimonial"].id}`, { approved: true });
    assert.equal(publish.status, 400, JSON.stringify(publish.json));

    // Earlier cases in this file approved their own quotes against the same
    // database, so the assertion is that *this* one did not reach the public
    // list — not that the list is empty.
    const shown = (await new Client(h.base).get("/api/testimonials")).json["testimonials"];
    assert.equal(
      shown.some((entry: { quote: string }) => entry.quote === "Said in a WhatsApp message."),
      false,
      "a quote with no recorded consent was published",
    );
  });

  it("keeps management behind an administrator", async () => {
    const customer = await signUp(h, "t-customer@example.com");
    assert.equal((await customer.get("/api/admin/testimonials")).status, 403);
    assert.equal((await customer.post("/api/admin/testimonials", { quote: "q", authorName: "n" })).status, 403);
  });
});

describe("the manufacturer network", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(() => h.close());

  it("plots only suppliers with real recorded coordinates", async () => {
    const withCoords = await h.app.repos.suppliers.create({
      name: "Abidjan Print Works", platform: "direct", country: "CI", city: "Abidjan",
      latitude: 5.35, longitude: -4.02,
    });
    await h.app.repos.suppliers.create({ name: "Nowhere Co", platform: "direct", country: "CN" });

    const network = (await new Client(h.base).get("/api/network")).json;
    assert.equal(network.total, 2);
    // The one without coordinates is counted but not plotted — it is not put
    // at a country centroid, because a centroid is a guess dressed as a place.
    assert.equal(network.plotted, 1);
    assert.equal(network.points.length, 1);
    assert.equal(network.points[0].city, "Abidjan");
    assert.equal(network.points[0].lat, 5.35);
    void withCoords;
  });

  it("never puts a supplier name or a cost on a public route", async () => {
    const supplier = await h.app.repos.suppliers.create({
      name: "Secret Supplier Ltd", platform: "alibaba", country: "CN",
      latitude: 23.13, longitude: 113.26,
    });
    await h.app.repos.supplierOffers.save({
      supplierId: supplier.id, productId: "prd_cup_kraft_250",
      unitCost: 145, currency: "XOF", lastCheckedAt: new Date().toISOString(),
    });

    const body = JSON.stringify((await new Client(h.base).get("/api/network")).json);
    // §7: a customer never sees a supplier name or a supplier cost.
    assert.equal(body.includes("Secret Supplier"), false);
    assert.equal(body.includes("145"), false);
  });

  it("drops a blocked supplier from the map entirely", async () => {
    const blocked = await h.app.repos.suppliers.create({
      name: "Blocked Co", platform: "direct", country: "CN", latitude: 30, longitude: 120,
    });
    await h.app.repos.suppliers.setStatus(blocked.id, "blocked", "chargeback");

    const network = (await new Client(h.base).get("/api/network")).json;
    assert.equal(network.points.some((p: { lat: number }) => p.lat === 30), false);
  });
});

describe("staying close to what we're building", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(() => h.close());

  it("records an address without an account", async () => {
    const response = await new Client(h.base).post("/api/subscribe", {
      email: "reader@example.com", locale: "fr", source: "homepage",
    });

    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json["subscribed"], true);

    const rows = await h.app.repos.subscribers.listAsAdmin();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.email, "reader@example.com");
    assert.equal(rows[0]?.locale, "fr");
  });

  it("answers a repeat submission identically", async () => {
    const client = new Client(h.base);
    const first = await client.post("/api/subscribe", { email: "twice@example.com" });
    const second = await client.post("/api/subscribe", { email: "twice@example.com" });

    // Byte-identical. A form that replies "you are already subscribed" lets
    // anyone check whether a given address is on the list, which is somebody
    // else's business.
    assert.equal(first.status, second.status);
    assert.deepEqual(first.json, second.json);
    assert.equal(await h.app.repos.subscribers.count(), 2);
  });

  it("refuses something that is not an address", async () => {
    const client = new Client(h.base);
    for (const email of ["", "nope", "a@b", "no spaces@example.com"]) {
      const response = await client.post("/api/subscribe", { email });
      assert.equal(response.status, 400, `${email} was accepted`);
    }
  });

  it("ignores a locale it does not have", async () => {
    await new Client(h.base).post("/api/subscribe", { email: "locale@example.com", locale: "zz" });
    const row = (await h.app.repos.subscribers.listAsAdmin()).find((r) => r.email === "locale@example.com");
    assert.equal(row?.locale, "en");
  });

  it("keeps the list behind an administrator", async () => {
    const customer = await signUp(h, "not-admin-subs@example.com");
    assert.equal((await customer.get("/api/admin/subscribers")).status, 403);
    assert.equal((await new Client(h.base).get("/api/admin/subscribers")).status, 401);

    await makeAdmin(h, "not-admin-subs@example.com");
    const admin = await new Client(h.base);
    await admin.post("/api/auth/login", { email: "not-admin-subs@example.com", password: PASSWORD });
    const list = await admin.get("/api/admin/subscribers");
    assert.equal(list.status, 200);
    assert.equal(typeof list.json["count"], "number");
  });
});


describe("brandora api", () => {
  let h: Harness;

  before(async () => {
    h = await start();
  });

  after(async () => {
    await h.close();
  });

  describe("health and public data", () => {
    it("reports its status without naming a credential", async () => {
      const response = await new Client(h.base).get("/api/health");
      assert.equal(response.status, 200);
      assert.equal(response.json["status"], "ok");
      const serialised = JSON.stringify(response.json);
      assert.ok(!/secret|key|token/i.test(serialised), serialised);
    });

    it("serves the interview without an account", async () => {
      const response = await new Client(h.base).get("/api/interview/questions");
      assert.equal(response.status, 200);
      assert.equal(response.json["questions"].length, 7);
      // §15: every question has an "I don't know" path.
      for (const question of response.json["questions"]) {
        assert.ok(question.helpPrompt.length > 0, `${question.field} has no help prompt`);
      }
    });

    it("answers an unknown API path in JSON, not HTML", async () => {
      const response = await new Client(h.base).get("/api/nope");
      assert.equal(response.status, 404);
      assert.equal(response.json["error"], "not-found");
    });
  });

  describe("authentication", () => {
    it("signs a customer up, keeps them signed in, and signs them out", async () => {
      const client = await signUp(h, "aicha@example.com");

      const me = await client.get("/api/auth/me");
      assert.equal(me.status, 200);
      assert.equal(me.json["user"].email, "aicha@example.com");
      assert.equal(me.json["user"].role, "customer");

      const out = await client.post("/api/auth/logout");
      assert.equal(out.status, 200);
      assert.equal(client.hasSession, false);

      // The probe still answers — with nobody. See the route's comment.
      const after = await client.get("/api/auth/me");
      assert.equal(after.status, 200);
      assert.equal(after.json["user"], null);
    });

    it("never returns a password hash", async () => {
      const client = await signUp(h, "hash@example.com");
      const me = await client.get("/api/auth/me");
      const serialised = JSON.stringify(me.json);
      assert.ok(!/passwordHash|password_hash|salt/i.test(serialised), serialised);
    });

    it("refuses a weak password", async () => {
      const response = await new Client(h.base).post("/api/auth/signup", {
        email: "weak@example.com",
        name: "Weak",
        password: "short",
      });
      assert.equal(response.status, 400);
    });

    it("gives the same answer for a wrong password and an unknown address", async () => {
      await signUp(h, "known@example.com");

      const wrong = await new Client(h.base).post("/api/auth/login", {
        email: "known@example.com",
        password: "definitely-not-the-password",
      });
      const unknown = await new Client(h.base).post("/api/auth/login", {
        email: "nobody@example.com",
        password: "definitely-not-the-password",
      });

      assert.equal(wrong.status, unknown.status);
      assert.deepEqual(wrong.json, unknown.json);
    });

    it("logs a returning customer back in", async () => {
      await signUp(h, "returning@example.com");
      const client = new Client(h.base);
      const login = await client.post("/api/auth/login", {
        email: "returning@example.com",
        password: PASSWORD,
      });
      assert.equal(login.status, 200);
      assert.equal((await client.get("/api/auth/me")).status, 200);
    });

    it("rejects a tampered session cookie", async () => {
      const response = await fetch(`${h.base}/api/auth/me`, {
        headers: { Cookie: "brandora_session=forged.forgedsignature" },
      });
      assert.equal(response.status, 200);
      const probe = (await response.json()) as Record<string, unknown>;
      assert.equal(probe["user"], null, "a forged cookie resolved to a user");

      // And a route that needs a user still refuses one.
      const projects = await fetch(`${h.base}/api/projects`, {
        headers: { Cookie: "brandora_session=forged.forgedsignature" },
      });
      assert.equal(projects.status, 401);
    });
  });

  describe("the journey", () => {
    it("carries one customer from interview to a paid order", async () => {
      const client = await signUp(h, "journey@example.com");

      // 1. Project
      const created = await client.post("/api/projects", { name: "Untitled brand" });
      assert.equal(created.status, 201);
      const projectId = created.json["project"].id as string;

      // 2. Interview
      const saved = await client.request("PUT", `/api/projects/${projectId}/interview`, {
        answers: ANSWERS,
      });
      assert.equal(saved.status, 200);
      assert.equal(saved.json["complete"], true);

      // 3. Generation — persisted, not held in the browser.
      const generated = await client.post(`/api/projects/${projectId}/generate`);
      assert.equal(generated.status, 201, JSON.stringify(generated.json));
      assert.equal(generated.json["strategy"].name, "Maison Doré");
      assert.ok(generated.json["identity"].palette.length >= 4);

      // 4. The brand survives a fresh read: it is in the database.
      const brand = await client.get(`/api/projects/${projectId}/brand`);
      assert.equal(brand.status, 200);
      assert.equal(brand.json["brand"].name, "Maison Doré");
      assert.equal(brand.json["brand"].positioning, "accessible-premium");
      assert.ok(brand.json["guidelines"].includes("Maison Doré"));

      // 5. Recommendations come from the stored strategy.
      const recommendations = await client.get(`/api/projects/${projectId}/recommendations?quantity=25`);
      assert.equal(recommendations.status, 200);
      assert.ok(recommendations.json["recommendations"].length > 0);
      for (const entry of recommendations.json["recommendations"]) {
        assert.ok(entry.reasons.length > 0, "a recommendation with no reason is a black box");
      }

      // 6. Package
      const productId = recommendations.json["recommendations"][0].product.id as string;
      const added = await client.post(`/api/projects/${projectId}/package/items`, {
        productId,
        quantity: 30,
      });
      assert.equal(added.status, 201, JSON.stringify(added.json));
      assert.equal(added.json["items"].length, 1);
      assert.ok(added.json["totals"].total.amount > 0);

      // 7. Quote — priced by the server.
      const quoted = await client.post(`/api/projects/${projectId}/quote`);
      assert.equal(quoted.status, 201, JSON.stringify(quoted.json));
      const quote = quoted.json["quote"];
      assert.match(quote.reference, /^BRA-\d{4}-\d{4}$/);
      assert.equal(quote.currency, "XOF");
      assert.equal(
        quote.subtotal.amount + quote.shipping.amount + quote.fees.amount,
        quote.total.amount,
        "a quote whose parts do not sum to its total is a quote nobody can check",
      );

      // 8. Checkout
      const checkout = await client.post(`/api/quotes/${quote.id}/checkout`);
      assert.equal(checkout.status, 201, JSON.stringify(checkout.json));
      const order = checkout.json["order"];
      assert.match(order.reference, /^ORD-\d{4}-\d{4}$/);
      assert.equal(order.total.amount, quote.total.amount);
      assert.equal(order.paymentStatus, "pending");
      assert.equal(h.payments.initialised?.amount.amount, quote.total.amount);

      // 9. Payment settles only when the provider agrees on the amount.
      h.payments.paid = true;
      h.payments.reported = money(quote.total.amount, "XOF");
      const verified = await client.post(`/api/orders/${order.id}/verify`);
      assert.equal(verified.status, 200, JSON.stringify(verified.json));
      assert.equal(verified.json["settled"], true);
      assert.equal(verified.json["order"].paymentStatus, "paid");
      // §17: a paid order goes to a person, not to a supplier.
      assert.equal(verified.json["order"].fulfillmentStatus, "awaiting-approval");

      // 10. The dashboard shows it.
      const dashboard = await client.get("/api/dashboard");
      assert.equal(dashboard.status, 200);
      assert.equal(dashboard.json["counts"].orders, 1);
      assert.equal(dashboard.json["orders"][0].reference, order.reference);

      h.payments.paid = false;
      h.payments.reported = null;
    });

    it("resumes an unfinished project at the right step", async () => {
      const client = await signUp(h, "resume@example.com");
      const created = await client.post("/api/projects", { name: "Half-done" });
      const projectId = created.json["project"].id as string;

      let list = await client.get("/api/projects");
      assert.equal(list.json["projects"][0].nextStep, "interview");

      await client.post(`/api/projects/${projectId}/generate`).catch(() => undefined);
      await client.request("PUT", `/api/projects/${projectId}/interview`, { answers: ANSWERS });
      await client.post(`/api/projects/${projectId}/generate`);

      list = await client.get("/api/projects");
      const project = list.json["projects"].find((p: any) => p.id === projectId);
      assert.equal(project.nextStep, "products");
    });
  });

  describe("the price is the server's", () => {
    it("ignores any price a client tries to send", async () => {
      const client = await signUp(h, "tamper@example.com");
      const projectId = await projectWithBrand(client);

      const honest = await client.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
      });
      const honestTotal = honest.json["totals"].total.amount;

      await client.del(`/api/projects/${projectId}/package`);

      // Every field a hopeful attacker might try.
      const tampered = await client.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
        unitPrice: 1,
        price: 1,
        total: 1,
        amount: 1,
        subtotal: 1,
      });

      assert.equal(tampered.json["totals"].total.amount, honestTotal);
    });

    it("charges the quote's amount at checkout, not the request's", async () => {
      const client = await signUp(h, "checkout-tamper@example.com");
      const projectId = await projectWithBrand(client);
      await client.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
      });
      const quote = (await client.post(`/api/projects/${projectId}/quote`)).json["quote"];

      const checkout = await client.post(`/api/quotes/${quote.id}/checkout`, {
        amount: 1,
        total: 1,
        currency: "USD",
      });

      assert.equal(checkout.status, 201);
      assert.equal(checkout.json["order"].total.amount, quote.total.amount);
      assert.equal(checkout.json["order"].currency, "XOF");
      assert.equal(h.payments.initialised?.amount.amount, quote.total.amount);
    });

    it("refuses to settle when the provider reports a different amount", async () => {
      const client = await signUp(h, "mismatch@example.com");
      const projectId = await projectWithBrand(client);
      await client.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
      });
      const quote = (await client.post(`/api/projects/${projectId}/quote`)).json["quote"];
      const order = (await client.post(`/api/quotes/${quote.id}/checkout`)).json["order"];

      h.payments.paid = true;
      h.payments.reported = money(100, "XOF"); // paid a hundred francs for a whole order

      const verified = await client.post(`/api/orders/${order.id}/verify`);
      assert.equal(verified.status, 409);

      // And the order did not quietly become paid on the way past.
      const reread = await client.get(`/api/orders/${order.id}`);
      assert.equal(reread.json["order"].paymentStatus, "pending");

      h.payments.paid = false;
      h.payments.reported = null;
    });

    it("raises a quantity to the minimum and says so rather than charging silently", async () => {
      const client = await signUp(h, "moq@example.com");
      const projectId = await projectWithBrand(client);

      const catalog = await client.get("/api/catalog");
      const withMoq = catalog.json["products"].find((p: any) => p.minimumQuantity > 1);
      assert.ok(withMoq, "the catalogue has no product with a minimum quantity to test");

      const added = await client.post(`/api/projects/${projectId}/package/items`, {
        productId: withMoq.id,
        quantity: 1,
      });

      assert.equal(added.json["adjustments"].length, 1);
      assert.equal(added.json["adjustments"][0].requested, 1);
      assert.equal(added.json["adjustments"][0].charged, withMoq.minimumQuantity);
    });

    it("refuses a customisation the catalogue has not confirmed", async () => {
      const client = await signUp(h, "unconfirmed@example.com");
      const projectId = await projectWithBrand(client);

      const catalog = await client.get("/api/catalog");
      const unconfirmed = catalog.json["products"].find(
        (p: any) => p.customization.confidence !== "verified",
      );
      assert.ok(unconfirmed, "every product is verified; nothing to test");

      const response = await client.post(`/api/projects/${projectId}/package/items`, {
        productId: unconfirmed.id,
        quantity: 50,
        customizationMethod: "screen-print",
      });
      assert.equal(response.status, 400);
    });
  });

  describe("one customer cannot reach another's", () => {
    it("does not find another customer's project", async () => {
      const owner = await signUp(h, "owner@example.com");
      const stranger = await signUp(h, "stranger@example.com");

      const projectId = await projectWithBrand(owner);

      for (const path of [
        `/api/projects/${projectId}`,
        `/api/projects/${projectId}/brand`,
        `/api/projects/${projectId}/package`,
        `/api/projects/${projectId}/interview`,
      ]) {
        const response = await stranger.get(path);
        assert.equal(response.status, 404, `${path} answered ${response.status}`);
      }
    });

    it("returns 404 rather than 403, so an id cannot be confirmed by probing", async () => {
      const owner = await signUp(h, "confirm-owner@example.com");
      const stranger = await signUp(h, "confirm-stranger@example.com");
      const real = await projectWithBrand(owner);

      const existing = await stranger.get(`/api/projects/${real}`);
      const invented = await stranger.get("/api/projects/brn_0000000000000000does");

      assert.equal(existing.status, 404);
      assert.equal(invented.status, existing.status);
      assert.deepEqual(existing.json, invented.json);
    });

    it("cannot write into another customer's package", async () => {
      const owner = await signUp(h, "pkg-owner@example.com");
      const stranger = await signUp(h, "pkg-stranger@example.com");
      const projectId = await projectWithBrand(owner);

      await owner.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
      });
      const before = await owner.get(`/api/projects/${projectId}/package`);

      const attempt = await stranger.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 5_000,
      });
      assert.equal(attempt.status, 404);

      const after = await owner.get(`/api/projects/${projectId}/package`);
      assert.deepEqual(after.json["items"], before.json["items"]);
    });

    it("cannot read another customer's quote or order", async () => {
      const owner = await signUp(h, "q-owner@example.com");
      const stranger = await signUp(h, "q-stranger@example.com");
      const projectId = await projectWithBrand(owner);
      await owner.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
      });
      const quote = (await owner.post(`/api/projects/${projectId}/quote`)).json["quote"];
      const order = (await owner.post(`/api/quotes/${quote.id}/checkout`)).json["order"];

      assert.equal((await stranger.get(`/api/quotes/${quote.id}`)).status, 404);
      assert.equal((await stranger.get(`/api/orders/${order.id}`)).status, 404);
      assert.equal((await stranger.post(`/api/orders/${order.id}/verify`)).status, 404);
    });

    it("refuses everything to a caller with no session", async () => {
      const anonymous = new Client(h.base);
      for (const path of ["/api/projects", "/api/quotes", "/api/orders", "/api/dashboard"]) {
        const response = await anonymous.get(path);
        assert.equal(response.status, 401, `${path} answered ${response.status}`);
      }
    });
  });

  describe("admin", () => {
    it("refuses a customer, and 403 rather than 404 — the route is not a secret", async () => {
      const customer = await signUp(h, "not-admin@example.com");
      for (const path of [
        "/api/admin/overview",
        "/api/admin/customers",
        "/api/admin/projects",
        "/api/admin/quotes",
        "/api/admin/orders",
        "/api/admin/integrations",
      ]) {
        const response = await customer.get(path);
        assert.equal(response.status, 403, `${path} answered ${response.status}`);
      }
    });

    it("does not let a customer promote themselves", async () => {
      const customer = await signUp(h, "climber@example.com");
      // There is no route that writes a role. If one is ever added, this fails.
      for (const attempt of [
        customer.patch("/api/auth/me", { role: "admin" }),
        customer.post("/api/auth/signup", {
          email: "climber2@example.com",
          name: "Climber",
          password: PASSWORD,
          role: "admin",
        }),
      ]) {
        await attempt;
      }

      const promoted = await h.app.repos.users.findByEmail("climber2@example.com");
      assert.equal(promoted?.role, "customer", "signup honoured a role from the request body");
      assert.equal((await h.app.repos.users.findByEmail("climber@example.com"))?.role, "customer");
    });

    it("shows an admin the operational picture", async () => {
      const admin = await signUp(h, "admin@example.com");
      await makeAdmin(h, "admin@example.com");

      const overview = await admin.get("/api/admin/overview");
      assert.equal(overview.status, 200);
      assert.ok(overview.json["counts"].customers > 0);

      for (const path of ["/api/admin/customers", "/api/admin/projects", "/api/admin/orders"]) {
        assert.equal((await admin.get(path)).status, 200);
      }
    });

    it("masks credentials on the integrations page and never returns a value", async () => {
      const admin = await signUp(h, "admin-integrations@example.com");
      await makeAdmin(h, "admin-integrations@example.com");

      const response = await admin.get("/api/admin/integrations");
      assert.equal(response.status, 200);
      for (const integration of response.json["integrations"]) {
        for (const field of integration.fields) {
          assert.ok(
            field.masked === "Not set" || field.masked.startsWith("••••"),
            `${integration.name}/${field.label} returned "${field.masked}"`,
          );
        }
      }
    });
  });

  describe("the human approval gate (§17)", () => {
    /** Walk a customer to a paid order and hand back its id. */
    async function paidOrder(email: string): Promise<string> {
      const client = await signUp(h, email);
      const projectId = await projectWithBrand(client);
      await client.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
      });
      const quote = (await client.post(`/api/projects/${projectId}/quote`)).json["quote"];
      const order = (await client.post(`/api/quotes/${quote.id}/checkout`)).json["order"];

      h.payments.paid = true;
      h.payments.reported = money(quote.total.amount, "XOF");
      await client.post(`/api/orders/${order.id}/verify`);
      h.payments.paid = false;
      h.payments.reported = null;

      return order.id;
    }

    it("stops a paid order at approval rather than sending it to a supplier", async () => {
      const orderId = await paidOrder("gate@example.com");
      const order = h.app.repos.orders.findAsAdmin(orderId);
      assert.equal((await order)?.paymentStatus, "paid");
      assert.equal((await order)?.fulfillmentStatus, "awaiting-approval");
    });

    it("records why the order is waiting, so a customer is not left guessing", async () => {
      const orderId = await paidOrder("gate-events@example.com");
      const events = await h.app.repos.orders.events(orderId);
      assert.ok(
        events.some((event) => event.kind === "awaiting-operations-approval"),
        `no approval event recorded: ${events.map((e) => e.kind).join(", ")}`,
      );
    });

    it("refuses a move that skips the lifecycle", async () => {
      const orderId = await paidOrder("gate-skip@example.com");
      const admin = await signUp(h, "gate-admin@example.com");
      await makeAdmin(h, "gate-admin@example.com");

      // Straight to shipped, skipping sourcing, production and the check.
      const jump = await admin.patch(`/api/admin/orders/${orderId}`, { fulfillmentStatus: "shipped" });
      assert.equal(jump.status, 400);
      assert.equal(
        (await h.app.repos.orders.findAsAdmin(orderId))?.fulfillmentStatus,
        "awaiting-approval",
        "the order moved despite the refusal",
      );
    });

    it("lets an administrator release it, one step at a time", async () => {
      const orderId = await paidOrder("gate-release@example.com");
      const admin = await signUp(h, "gate-release-admin@example.com");
      await makeAdmin(h, "gate-release-admin@example.com");

      for (const step of ["sourcing", "processing", "quality-check", "shipped", "delivered"]) {
        const response = await admin.patch(`/api/admin/orders/${orderId}`, { fulfillmentStatus: step });
        assert.equal(response.status, 200, `${step} was refused: ${JSON.stringify(response.json)}`);
      }

      assert.equal((await h.app.repos.orders.findAsAdmin(orderId))?.fulfillmentStatus, "delivered");
    });

    it("names the administrator who released it", async () => {
      const orderId = await paidOrder("gate-audit@example.com");
      const admin = await signUp(h, "gate-audit-admin@example.com");
      await makeAdmin(h, "gate-audit-admin@example.com");
      const adminRow = await h.app.repos.users.findByEmail("gate-audit-admin@example.com");

      await admin.patch(`/api/admin/orders/${orderId}`, { fulfillmentStatus: "sourcing" });

      const events = await h.app.repos.orders.events(orderId);
      const release = events.find((event) => event.kind === "fulfilment:sourcing");
      assert.ok(release, "no event recorded for the release");
      assert.equal(release.actor, `admin:${adminRow?.id}`);
    });

    it("does not let a customer move their own order", async () => {
      const orderId = await paidOrder("gate-customer@example.com");
      const customer = await signUp(h, "gate-customer2@example.com");
      const response = await customer.patch(`/api/admin/orders/${orderId}`, {
        fulfillmentStatus: "sourcing",
      });
      assert.equal(response.status, 403);
      assert.equal(
        (await h.app.repos.orders.findAsAdmin(orderId))?.fulfillmentStatus,
        "awaiting-approval",
      );
    });
  });

  describe("margin never reaches a customer", () => {
    it("omits margin from every customer-facing quote read", async () => {
      const client = await signUp(h, "margin@example.com");
      const projectId = await projectWithBrand(client);
      await client.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
      });
      const quote = (await client.post(`/api/projects/${projectId}/quote`)).json["quote"];

      for (const response of [
        await client.get(`/api/quotes/${quote.id}`),
        await client.get("/api/quotes"),
        await client.get("/api/dashboard"),
        await client.get(`/api/projects/${projectId}`),
      ]) {
        const serialised = JSON.stringify(response.json);
        assert.ok(!/"margin"/.test(serialised), `margin leaked: ${serialised.slice(0, 400)}`);
        assert.ok(!/supplierPrice|supplier_price|landedCost/.test(serialised));
      }
    });

    it("gives an admin the margin the customer never saw", async () => {
      const admin = await signUp(h, "margin-admin@example.com");
      await makeAdmin(h, "margin-admin@example.com");
      const response = await admin.get("/api/admin/quotes");
      assert.equal(response.status, 200);
      if (response.json["quotes"].length > 0) {
        assert.ok(response.json["quotes"][0].margin, "an admin quote with no margin is not useful");
      }
    });
  });

  describe("no invented promises", () => {
    it("returns a null delivery estimate rather than a plausible date", async () => {
      const client = await signUp(h, "delivery@example.com");
      const catalog = await client.get("/api/catalog");
      for (const product of catalog.json["products"]) {
        assert.equal(product.deliveryEstimate, null);
      }
    });

    it("labels unconfirmed branding as unconfirmed", async () => {
      const catalog = await new Client(h.base).get("/api/catalog");
      for (const product of catalog.json["products"]) {
        if (product.customization.confidence !== "verified") {
          assert.equal(product.customization.canCarryLogo, false);
          assert.ok(!/^Confirmed/.test(product.customization.label));
        }
      }
    });
  });

  describe("input handling", () => {
    it("rejects a body that is not a JSON object", async () => {
      const response = await fetch(`${h.base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[1,2,3]",
      });
      assert.equal(response.status, 400);
    });

    it("rejects an oversized body without reading all of it into a record", async () => {
      const response = await fetch(`${h.base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.co", password: "x".repeat(300_000) }),
      });
      assert.equal(response.status, 400);
    });

    it("answers the wrong verb with 405, not 404", async () => {
      const response = await new Client(h.base).del("/api/health");
      assert.equal(response.status, 405);
    });
  });

  describe("rate limiting", () => {
    it("throttles repeated login attempts from one address", async () => {
      const app = await createApp({
        db: openSqlite(":memory:"),
        catalog: EXAMPLE_CATALOG,
        env: ENV,
        strategy: new StubStrategyProvider(),
        payments: new StubPaymentProvider(),
        secureCookies: false,
        logger: { error: () => {} },
        rateLimits: { loginsPerWindow: 3, signupsPerWindow: 10_000 },
      });
      const server = createServer(app.listener);
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

      try {
        const client = new Client(base);
        const statuses: number[] = [];
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const response = await client.post("/api/auth/login", {
            email: "guess@example.com",
            password: `attempt-${attempt}`,
          });
          statuses.push(response.status);
        }
        assert.ok(statuses.includes(429), `no attempt was throttled: ${statuses.join(", ")}`);
      } finally {
        await new Promise<void>((done) => server.close(() => done()));
        await app.db.close();
      }
    });
  });

  describe("errors stay customer-safe", () => {
    it("never returns a stack trace or an internal path", async () => {
      const client = await signUp(h, "errors@example.com");
      const response = await client.post("/api/projects", {});
      assert.equal(response.status, 400);
      const serialised = JSON.stringify(response.json);
      assert.ok(!/at .*\.ts:|node_modules|\/home\//.test(serialised), serialised);
      assert.equal(response.json["message"], "Something in that form didn't look right. Please check and try again.");
    });
  });
});

/* --- The unconfigured cases ------------------------------------------------ */

describe("brandora api without credentials", () => {
  it("refuses to generate a brand rather than inventing one", async () => {
    const app = await createApp({
      db: openSqlite(":memory:"),
    // The shipped catalogue is empty by decision, so a test that needs
    // products supplies its own. See packages/brandora-catalog/src/seed.ts.
    catalog: EXAMPLE_CATALOG,
      env: ENV,
      secureCookies: false,
      logger: { error: () => {} },
      rateLimits: LIMITS,
    });
    const server = createServer(app.listener);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    try {
      const client = new Client(base);
      await client.post("/api/auth/signup", {
        email: "noai@example.com",
        name: "No AI",
        password: PASSWORD,
      });
      const created = await client.post("/api/projects", { name: "Untitled brand" });
      const projectId = created.json["project"].id as string;
      await client.request("PUT", `/api/projects/${projectId}/interview`, { answers: ANSWERS });

      const generated = await client.post(`/api/projects/${projectId}/generate`);
      assert.notEqual(generated.status, 201, "generation succeeded with no API key configured");
      assert.equal(generated.json["error"], "brand.generation-failed");

      // And nothing fabricated was saved.
      assert.equal(await app.repos.strategies.findForProject(projectId), null);
    } finally {
      await new Promise<void>((done) => server.close(() => done()));
      await app.db.close();
    }
  });

  it("places a real order with no payment provider, and never marks it paid", async () => {
    const app = await createApp({
      db: openSqlite(":memory:"),
    // The shipped catalogue is empty by decision, so a test that needs
    // products supplies its own. See packages/brandora-catalog/src/seed.ts.
    catalog: EXAMPLE_CATALOG,
      env: ENV,
      strategy: new StubStrategyProvider(),
      secureCookies: false,
      logger: { error: () => {} },
      rateLimits: LIMITS,
    });
    const server = createServer(app.listener);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    try {
      const client = new Client(base);
      await client.post("/api/auth/signup", {
        email: "manual@example.com",
        name: "Manual",
        password: PASSWORD,
      });
      const created = await client.post("/api/projects", { name: "Untitled brand" });
      const projectId = created.json["project"].id as string;
      await client.request("PUT", `/api/projects/${projectId}/interview`, { answers: ANSWERS });
      await client.post(`/api/projects/${projectId}/generate`);
      await client.post(`/api/projects/${projectId}/package/items`, {
        productId: "prd_cup_kraft_250",
        quantity: 50,
      });
      const quote = (await client.post(`/api/projects/${projectId}/quote`)).json["quote"];

      const checkout = await client.post(`/api/quotes/${quote.id}/checkout`);
      assert.equal(checkout.status, 201);
      assert.equal(checkout.json["payment"].configured, false);
      assert.equal(checkout.json["payment"].authorizationUrl, null);
      assert.equal(checkout.json["order"].paymentStatus, "pending");

      // Verification must not settle it: only an administrator can.
      const verified = await client.post(`/api/orders/${checkout.json["order"].id}/verify`);
      assert.equal(verified.json["settled"], false);
      assert.equal(verified.json["order"].paymentStatus, "pending");
    } finally {
      await new Promise<void>((done) => server.close(() => done()));
      await app.db.close();
    }
  });
});

/**
 * Being at an earlier step is not a malformed form.
 *
 * Every case below used to answer `input.invalid`, which the interface renders
 * as "Something in that form didn't look right. Please check and try again."
 * Told to someone whose form was fine, that sends them back to re-check work
 * that was never wrong, and it never mentions the one thing they need to do.
 *
 * So each asserts two things: the key is the sequencing one, and it is *not*
 * `input.invalid`. The second half is the point — a future refactor that
 * collapses these back into a generic validation error fails here.
 */
describe("a precondition says which step is missing", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(async () => { await h.close(); });

  it("generating before the interview exists", async () => {
    const client = await signUp(h, `seq-generate-${Date.now()}@example.com`);
    const project = await client.post("/api/projects", { name: "Untitled brand" });
    const response = await client.post(`/api/projects/${project.json["project"].id}/generate`);

    assert.equal(response.status, 409);
    assert.equal(response.json["error"], "brand.interview-incomplete");
    assert.notEqual(response.json["error"], "input.invalid");
  });

  it("asking the assistant before a brand exists", async () => {
    const client = await signUp(h, `seq-assistant-${Date.now()}@example.com`);
    const project = await client.post("/api/projects", { name: "Untitled brand" });
    const response = await client.post(`/api/projects/${project.json["project"].id}/assistant`, {
      question: "Quel emballage pour 500 boîtes ?",
    });

    assert.equal(response.status, 409);
    assert.equal(response.json["error"], "brand.not-generated");
    // The question was well-formed. Nothing about it was a validation problem.
    assert.notEqual(response.json["error"], "input.invalid");
  });

  it("recommendations before a brand exists", async () => {
    const client = await signUp(h, `seq-recs-${Date.now()}@example.com`);
    const project = await client.post("/api/projects", { name: "Untitled brand" });
    const response = await client.get(`/api/projects/${project.json["project"].id}/recommendations`);

    assert.equal(response.status, 409);
    assert.equal(response.json["error"], "brand.not-generated");
  });

  it("quoting an empty package", async () => {
    const client = await signUp(h, `seq-quote-${Date.now()}@example.com`);
    const projectId = await projectWithBrand(client);
    const response = await client.post(`/api/projects/${projectId}/quote`);

    assert.equal(response.status, 409);
    assert.equal(response.json["error"], "package.empty");
    assert.notEqual(response.json["error"], "input.invalid");
  });

  it("each message names the next step rather than blaming the form", async () => {
    const client = await signUp(h, `seq-wording-${Date.now()}@example.com`);
    const project = await client.post("/api/projects", { name: "Untitled brand" });
    const response = await client.post(`/api/projects/${project.json["project"].id}/generate`);

    const message = String(response.json["message"]);
    assert.match(message, /question/i, message);
    assert.doesNotMatch(message, /didn't look right/i, message);
  });
});

/**
 * The waiting list records what the person actually told us.
 *
 * The list existed but held only an address, which makes it a mailing list
 * rather than a sourcing signal: eleven addresses say nothing, while eleven
 * people wanting printed boxes at around thirty units is a brief you can take
 * to a manufacturer. Everything past the address is optional, so the tests
 * that matter are the ones about *absence* — a skipped field must come back
 * absent, not as an empty string or a zero that reads like an answer.
 */
describe("the waiting list", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(async () => { await h.close(); });

  it("keeps the name, business, interest and quantity", async () => {
    const email = `wl-full-${Date.now()}@example.com`;
    const response = await new Client(h.base).post("/api/subscribe", {
      email,
      name: "Aïcha Traoré",
      business: "Boulangerie Cocody",
      interest: "Boîtes imprimées et stickers",
      quantity: 30,
      locale: "fr",
    });
    assert.equal(response.status, 201);

    const row = (await h.app.repos.subscribers.listAsAdmin()).find((s) => s.email === email);
    assert.ok(row, "the row was not written");
    assert.equal(row.name, "Aïcha Traoré");
    assert.equal(row.business, "Boulangerie Cocody");
    assert.equal(row.interest, "Boîtes imprimées et stickers");
    assert.equal(row.quantity, 30);
    assert.equal(row.locale, "fr");
  });

  it("an address alone still joins", async () => {
    const email = `wl-bare-${Date.now()}@example.com`;
    assert.equal((await new Client(h.base).post("/api/subscribe", { email })).status, 201);

    const row = (await h.app.repos.subscribers.listAsAdmin()).find((s) => s.email === email);
    assert.ok(row);
    // Absent, not "" and not 0 — nobody was asked and answered nothing.
    assert.equal(row.name, undefined);
    assert.equal(row.business, undefined);
    assert.equal(row.interest, undefined);
    assert.equal(row.quantity, undefined);
  });

  it("a small quantity is a real answer", async () => {
    // Brandora is for founders ordering 20 and 30. A minimum that quietly
    // rejected those would reject exactly the customer it is built for.
    const email = `wl-small-${Date.now()}@example.com`;
    await new Client(h.base).post("/api/subscribe", { email, quantity: 20 });

    const row = (await h.app.repos.subscribers.listAsAdmin()).find((s) => s.email === email);
    assert.equal(row?.quantity, 20);
  });

  it("a quantity that is not a number is dropped, not a 400", async () => {
    const email = `wl-junk-${Date.now()}@example.com`;
    const response = await new Client(h.base).post("/api/subscribe", {
      email,
      quantity: "je ne sais pas encore",
    });

    // Joining still succeeds. Losing someone from the waiting list because
    // they typed words into a number box is the worst possible trade.
    assert.equal(response.status, 201);
    const row = (await h.app.repos.subscribers.listAsAdmin()).find((s) => s.email === email);
    assert.ok(row);
    assert.equal(row.quantity, undefined);
  });

  it("a quantity typed as a string is understood", async () => {
    const email = `wl-str-${Date.now()}@example.com`;
    await new Client(h.base).post("/api/subscribe", { email, quantity: "50" });
    const row = (await h.app.repos.subscribers.listAsAdmin()).find((s) => s.email === email);
    assert.equal(row?.quantity, 50);
  });
});

/**
 * One customer cannot read another's brand, and is not told it exists.
 *
 * Ownership lives in the SQL WHERE clause, not in a check above the query, so
 * a missing row and someone else's row are indistinguishable by construction.
 * The status is 404 rather than 403 for the same reason: 403 confirms the id
 * is real, which is exactly what someone walking ids wants to learn.
 */
describe("another customer's brand", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(async () => { await h.close(); });

  it("is a 404, and its contents never appear in the response", async () => {
    const owner = await signUp(h, `owner-${Date.now()}@example.com`);
    const stranger = await signUp(h, `stranger-${Date.now()}@example.com`);

    const created = await owner.post("/api/projects", { name: "Confidential brand" });
    const id = created.json["project"].id as string;
    await owner.request("PUT", `/api/projects/${id}/interview`, {
      answers: [{ field: "business", value: "A private idea nobody else should read" }],
    });

    assert.equal((await owner.get(`/api/projects/${id}`)).status, 200);

    for (const path of [`/api/projects/${id}`, `/api/projects/${id}/interview`, `/api/projects/${id}/package`]) {
      const response = await stranger.get(path);
      assert.equal(response.status, 404, `${path} answered ${response.status}`);
      assert.doesNotMatch(JSON.stringify(response.json), /private idea|Confidential/, path);
    }
  });

  it("says 'that', not 'that order' — it is not an order", async () => {
    const owner = await signUp(h, `msg-owner-${Date.now()}@example.com`);
    const stranger = await signUp(h, `msg-stranger-${Date.now()}@example.com`);
    const created = await owner.post("/api/projects", { name: "Another brand" });

    const response = await stranger.get(`/api/projects/${created.json["project"].id}`);
    assert.equal(response.json["error"], "not-found");
    // Being told about an order you never placed is its own small confusion.
    assert.doesNotMatch(String(response.json["message"]), /order/i, String(response.json["message"]));
  });
});
