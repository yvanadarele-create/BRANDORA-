/**
 * The Paystack webhook, and notification delivery.
 *
 * One rule is worth stating before the tests, because almost all of them exist
 * to defend it: **a webhook body is a trigger, not evidence.** A valid
 * signature proves the message came from Paystack. It does not prove the charge
 * succeeded, and it certainly does not prove the amount — Paystack's own
 * documentation says to verify, and a signature can be replayed.
 *
 * So nothing is read out of the payload except the reference, and everything
 * that decides whether an order is paid comes from calling the provider back.
 * The test that matters most is `does not settle an order because the payload
 * says so`: a perfectly signed body claiming success against a provider that
 * says otherwise must leave the order unpaid.
 */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { EXAMPLE_CATALOG } from "@brandora/catalog";
import {
  type NotificationTransport,
  type OutboundMessage,
  type PaymentIntent,
  type PaymentProvider,
  ResendTransport,
  UnconfiguredTransport,
  type VerificationResult,
  createApp,
  deliverPending,
  resolveNotificationTransport,
} from "@brandora/server";
import { createRepositories, openSqlite } from "@brandora/database";
import { type Money, money } from "@brandora/shared";
import type { StrategyProvider } from "@brandora/brand-engine";

/* --- Doubles --------------------------------------------------------------- */

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
  async complete(): Promise<string> {
    return STUB_STRATEGY;
  }
}

/** A provider whose verification answer the test sets, and which counts calls. */
class StubPaymentProvider implements PaymentProvider {
  readonly name = "stub";
  readonly configured = true;
  reported: Money | null = null;
  paid = false;
  verifications = 0;

  async initialise(input: { reference: string; amount: Money }): Promise<PaymentIntent> {
    return {
      reference: input.reference,
      authorizationUrl: `https://pay.example/${input.reference}`,
      instruction: "Continue to payment.",
      provider: this.name,
    };
  }

  async verify(): Promise<VerificationResult> {
    this.verifications += 1;
    return {
      paid: this.paid,
      amount: this.reported,
      providerStatus: this.paid ? "success" : "pending",
    };
  }
}

/** A transport that records what it was asked to send, and can be told to fail. */
class RecordingTransport implements NotificationTransport {
  readonly name = "recording";
  configured = true;
  sent: OutboundMessage[] = [];
  fail: string | null = null;

  async send(message: OutboundMessage): Promise<void> {
    if (this.fail) throw new Error(this.fail);
    this.sent.push(message);
  }
}

/* --- Harness --------------------------------------------------------------- */

const WEBHOOK_SECRET = "sk_test_not_a_real_key";

const ENV: Record<string, string> = {
  BRANDORA_AUTH_SECRET: "test-secret-not-a-real-one",
  BRANDORA_DEFAULT_CURRENCY: "XOF",
  BRANDORA_PUBLIC_BASE_URL: "http://127.0.0.1",
  BRANDORA_MARGIN_RATE: "0.35",
  BRANDORA_LOGISTICS_RATE: "0.08",
  BRANDORA_DELIVERY_FLAT: "3000",
  BRANDORA_DELIVERY_PER_KG: "1200",
  BRANDORA_ROUNDING_STEP: "100",
  PAYSTACK_WEBHOOK_SECRET: WEBHOOK_SECRET,
};

const LIMITS = { loginsPerWindow: 10_000, signupsPerWindow: 10_000, generationsPerWindow: 10_000 };

interface Harness {
  base: string;
  server: Server;
  app: Awaited<ReturnType<typeof createApp>>;
  payments: StubPaymentProvider;
  notifications: RecordingTransport;
  close(): Promise<void>;
}

async function start(env: Record<string, string> = ENV): Promise<Harness> {
  const payments = new StubPaymentProvider();
  const notifications = new RecordingTransport();
  const app = await createApp({
    db: openSqlite(":memory:"),
    // The shipped catalogue is empty by decision, so a test that needs
    // products supplies its own. See packages/brandora-catalog/src/seed.ts.
    catalog: EXAMPLE_CATALOG,
    env,
    strategy: new StubStrategyProvider(),
    payments,
    notifications,
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
    payments,
    notifications,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => {
          void app.db.close().finally(done);
        });
      }),
  };
}

class Client {
  private cookie = "";
  constructor(private readonly base: string) {}

  async request(method: string, path: string, body?: unknown) {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(";")[0] ?? "";
      this.cookie = pair.endsWith("=") ? "" : pair;
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

/** Sign up, build a brand, price it and check out. Returns the order awaiting payment. */
async function orderAwaitingPayment(h: Harness, email: string) {
  const client = new Client(h.base);
  const signup = await client.post("/api/auth/signup", {
    email, name: "Aïcha Traoré", password: "correct-horse-battery",
  });
  assert.equal(signup.status, 201, JSON.stringify(signup.json));

  const created = await client.post("/api/projects", { name: "Untitled brand" });
  const projectId = created.json["project"].id as string;
  await client.request("PUT", `/api/projects/${projectId}/interview`, { answers: ANSWERS });
  await client.post(`/api/projects/${projectId}/generate`);

  const recommendations = await client.get(`/api/projects/${projectId}/recommendations?quantity=30`);
  const productId = recommendations.json["recommendations"][0].product.id as string;
  const added = await client.post(`/api/projects/${projectId}/package/items`, { productId, quantity: 30 });
  assert.equal(added.status, 201, JSON.stringify(added.json));

  const quoted = await client.post(`/api/projects/${projectId}/quote`);
  assert.equal(quoted.status, 201, JSON.stringify(quoted.json));
  const quote = quoted.json["quote"];
  const checkout = await client.post(`/api/quotes/${quote.id}/checkout`);
  assert.equal(checkout.status, 201, JSON.stringify(checkout.json));

  const order = checkout.json["order"];
  const payments = await h.app.repos.payments.listForOrder(order.id);
  const payment = payments[0];
  assert.ok(payment, "checkout recorded no payment attempt");

  return { client, order, quote, reference: payment.reference };
}

/** Post a webhook the way Paystack does: raw body, signature over those bytes. */
async function postWebhook(
  h: Harness,
  payload: unknown,
  options: { secret?: string; signature?: string | null } = {},
) {
  const raw = JSON.stringify(payload);
  const signature =
    options.signature === null
      ? undefined
      : (options.signature ??
        createHmac("sha512", options.secret ?? WEBHOOK_SECRET).update(raw, "utf8").digest("hex"));

  const response = await fetch(`${h.base}/api/webhooks/paystack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "x-paystack-signature": signature } : {}),
    },
    body: raw,
  });

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

const chargeSuccess = (reference: string, amount = 999_999) => ({
  event: "charge.success",
  data: { reference, status: "success", amount, currency: "XOF" },
});

/* --- The signature --------------------------------------------------------- */

describe("the paystack webhook refuses anything it cannot verify", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(() => h.close());

  it("refuses a request with no signature", async () => {
    const { order, reference } = await orderAwaitingPayment(h, "nosig@example.com");
    const response = await postWebhook(h, chargeSuccess(reference), { signature: null });

    assert.equal(response.status, 401);
    const after = await h.app.repos.orders.findAsAdmin(order.id);
    assert.equal(after?.paymentStatus, "pending");
  });

  it("refuses a signature made with the wrong key", async () => {
    const { order, reference } = await orderAwaitingPayment(h, "wrongkey@example.com");
    const response = await postWebhook(h, chargeSuccess(reference), { secret: "sk_test_someone_elses" });

    assert.equal(response.status, 401);
    const after = await h.app.repos.orders.findAsAdmin(order.id);
    assert.equal(after?.paymentStatus, "pending");
  });

  it("refuses a signature that is valid for a different body", async () => {
    const { order, reference } = await orderAwaitingPayment(h, "swapped@example.com");

    // Signed over one payload, sent with another — the replay an attacker who
    // has seen one legitimate webhook would try.
    const other = createHmac("sha512", WEBHOOK_SECRET)
      .update(JSON.stringify(chargeSuccess("SOMEONE-ELSE")), "utf8")
      .digest("hex");

    const response = await postWebhook(h, chargeSuccess(reference), { signature: other });
    assert.equal(response.status, 401);

    const after = await h.app.repos.orders.findAsAdmin(order.id);
    assert.equal(after?.paymentStatus, "pending");
  });

  it("says nothing about why it refused", async () => {
    const missing = await postWebhook(h, chargeSuccess("x"), { signature: null });
    const wrong = await postWebhook(h, chargeSuccess("x"), { secret: "nope" });

    // Identical. A response that distinguishes "missing" from "wrong" tells
    // someone forging one which half they got right.
    assert.equal(missing.status, wrong.status);
    assert.deepEqual(missing.json, wrong.json);
    assert.equal(JSON.stringify(missing.json).includes("signature"), false);
  });
});

describe("the webhook does not exist without a secret to verify against", () => {
  let h: Harness;
  before(async () => {
    const { PAYSTACK_WEBHOOK_SECRET: _omitted, ...rest } = ENV;
    h = await start(rest as Record<string, string>);
  });
  after(() => h.close());

  it("answers 404, not 500", async () => {
    // 404 rather than 503: in a deployment with no Paystack this endpoint does
    // not exist, and saying so tells a prober nothing about the configuration.
    const response = await postWebhook(h, chargeSuccess("anything"));
    assert.equal(response.status, 404);
  });
});

/* --- The guarantee --------------------------------------------------------- */

describe("a signed webhook is a trigger, not evidence", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(() => h.close());

  it("does not settle an order because the payload says it succeeded", async () => {
    const { order, reference } = await orderAwaitingPayment(h, "forged-success@example.com");

    // The signature is genuine. The provider still says the charge is pending.
    h.payments.paid = false;
    const response = await postWebhook(h, chargeSuccess(reference));

    assert.equal(response.status, 200);
    assert.equal(response.json["acted"], false);

    const after = await h.app.repos.orders.findAsAdmin(order.id);
    assert.equal(after?.paymentStatus, "pending", "a payload claiming success marked an order paid");
    assert.equal(after?.fulfillmentStatus, "pending");
    assert.ok(h.payments.verifications > 0, "the webhook never called the provider back");
  });

  it("does not take the amount from the payload", async () => {
    const { order, quote, reference } = await orderAwaitingPayment(h, "forged-amount@example.com");

    // The payload names the right amount. The provider reports one franc.
    h.payments.paid = true;
    h.payments.reported = money(1, "XOF");
    const response = await postWebhook(h, chargeSuccess(reference, quote.total.amount));

    // 200, so Paystack stops retrying — the mismatch is recorded for a person,
    // not queued for redelivery.
    assert.equal(response.status, 200);
    assert.equal(response.json["acted"], false);

    const after = await h.app.repos.orders.findAsAdmin(order.id);
    assert.equal(after?.paymentStatus, "pending");

    const payment = await h.app.repos.payments.findByReference(reference);
    assert.equal(payment?.status, "mismatch");

    const events = await h.app.repos.orders.events(order.id);
    assert.ok(events.some((event) => event.kind === "payment-mismatch"));
  });

  it("settles when the provider confirms the charge and the amount", async () => {
    const { order, quote, reference } = await orderAwaitingPayment(h, "settles@example.com");

    h.payments.paid = true;
    h.payments.reported = money(quote.total.amount, "XOF");
    const response = await postWebhook(h, chargeSuccess(reference));

    assert.equal(response.status, 200);
    assert.equal(response.json["acted"], true);

    const after = await h.app.repos.orders.findAsAdmin(order.id);
    assert.equal(after?.paymentStatus, "paid");
    // §17 still holds on this path: a paid order goes to a person.
    assert.equal(after?.fulfillmentStatus, "awaiting-approval");

    const payment = await h.app.repos.payments.findByReference(reference);
    assert.equal(payment?.status, "paid");
    assert.ok(payment?.verifiedAt);
  });

  it("records the webhook as the actor, so the history says how it settled", async () => {
    const { order, quote, reference } = await orderAwaitingPayment(h, "actor@example.com");
    h.payments.paid = true;
    h.payments.reported = money(quote.total.amount, "XOF");
    await postWebhook(h, chargeSuccess(reference));

    const events = await h.app.repos.orders.events(order.id);
    const paid = events.find((event) => event.kind === "paid");
    assert.equal(paid?.actor, "paystack-webhook");
  });
});

/* --- Idempotence ----------------------------------------------------------- */

describe("the webhook survives being delivered more than once", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(() => h.close());

  it("settles once, however many times paystack retries", async () => {
    const { order, quote, reference } = await orderAwaitingPayment(h, "retry@example.com");
    h.payments.paid = true;
    h.payments.reported = money(quote.total.amount, "XOF");

    const first = await postWebhook(h, chargeSuccess(reference));
    const second = await postWebhook(h, chargeSuccess(reference));
    const third = await postWebhook(h, chargeSuccess(reference));

    // Every delivery gets a 200, so Paystack stops. None of them re-settles.
    for (const response of [first, second, third]) assert.equal(response.status, 200);

    const events = await h.app.repos.orders.events(order.id);
    assert.equal(
      events.filter((event) => event.kind === "paid").length,
      1,
      "a retried webhook settled the same order twice",
    );

    const after = await h.app.repos.orders.findAsAdmin(order.id);
    assert.equal(after?.paymentStatus, "paid");
    assert.equal(after?.fulfillmentStatus, "awaiting-approval");
  });

  it("does not re-open a payment already refused on the amount", async () => {
    const { order, quote, reference } = await orderAwaitingPayment(h, "refused-twice@example.com");

    h.payments.paid = true;
    h.payments.reported = money(1, "XOF");
    await postWebhook(h, chargeSuccess(reference));

    // Now the provider tells the truth. The reference is still refused: it was
    // marked `mismatch` once, and a retry does not make it correct.
    h.payments.reported = money(quote.total.amount, "XOF");
    const again = await postWebhook(h, chargeSuccess(reference));

    assert.equal(again.status, 200);
    assert.equal(again.json["acted"], false);
    const after = await h.app.repos.orders.findAsAdmin(order.id);
    assert.equal(after?.paymentStatus, "pending");
  });

  it("answers 200 to an event it does not act on", async () => {
    const unknown = await postWebhook(h, chargeSuccess("BRA-NOT-A-REFERENCE"));
    assert.equal(unknown.status, 200);
    assert.equal(unknown.json["acted"], false);

    const other = await postWebhook(h, { event: "customer.created", data: { reference: "x" } });
    assert.equal(other.status, 200);
    assert.equal(other.json["acted"], false);

    const shapeless = await postWebhook(h, { event: "charge.success" });
    assert.equal(shapeless.status, 200);
    assert.equal(shapeless.json["acted"], false);
  });
});

/* --- Notifications --------------------------------------------------------- */

describe("a settled payment tells the customer", () => {
  let h: Harness;
  before(async () => { h = await start(); });
  after(() => h.close());

  it("queues a notification and records that it was actually sent", async () => {
    const { order, quote, reference } = await orderAwaitingPayment(h, "notified@example.com");
    h.payments.paid = true;
    h.payments.reported = money(quote.total.amount, "XOF");
    await postWebhook(h, chargeSuccess(reference));

    const sent = h.notifications.sent.at(-1);
    assert.ok(sent, "nothing was sent when the order settled");
    assert.equal(sent.to, "notified@example.com");
    assert.match(sent.subject, new RegExp(order.reference));
    // §17 again, in the customer's own words.
    assert.match(sent.body, /reviews every paid order/i);

    const rows = await h.app.repos.notifications.listForUser(order.userId ?? "", 10);
    const row = (await h.app.repos.notifications.listForUser(
      (await h.app.repos.orders.findAsAdmin(order.id))!.userId, 10,
    ))[0] ?? rows[0];
    assert.equal(row?.status, "sent");
    assert.equal(row?.attempts, 1);
  });

  it("keeps the row pending when the transport fails, so it can be retried", async () => {
    h.notifications.fail = "451 greylisted, try later";
    const { order, quote, reference } = await orderAwaitingPayment(h, "greylisted@example.com");
    h.payments.paid = true;
    h.payments.reported = money(quote.total.amount, "XOF");
    await postWebhook(h, chargeSuccess(reference));
    h.notifications.fail = null;

    const settled = await h.app.repos.orders.findAsAdmin(order.id);
    // The point: a mail server having a bad afternoon does not un-pay an order.
    assert.equal(settled?.paymentStatus, "paid");

    const rows = await h.app.repos.notifications.listForUser(settled!.userId, 10);
    const row = rows[0];
    assert.equal(row?.status, "pending");
    assert.equal(row?.attempts, 1);
    assert.equal(row?.lastError, "451 greylisted, try later");

    // And the queue picks it up.
    const report = await deliverPending(h.app.repos, h.notifications);
    assert.equal(report.sent, 1);
    assert.equal((await h.app.repos.notifications.findById(row!.id))?.status, "sent");
  });
});

describe("with no transport configured", () => {
  it("fills the queue rather than reporting a delivery", async () => {
    const db = openSqlite(":memory:");
    const repos = createRepositories(db);
    const user = await repos.users.create({ email: "quiet@example.com", name: "Ada" });
    await repos.notifications.create({
      userId: user.id, kind: "order.paid", channel: "email", subject: "s", body: "b",
    });

    const report = await deliverPending(repos, new UnconfiguredTransport());

    assert.equal(report.attempted, 0);
    assert.equal(report.sent, 0);
    // Reported as skipped, never as sent. The row is still there for the day a
    // provider is connected.
    assert.equal(report.skipped, true);
    assert.equal((await repos.notifications.pending()).length, 1);
    await db.close();
  });

  it("is what an unconfigured environment resolves to", () => {
    assert.equal(resolveNotificationTransport({}).configured, false);
    // A key with no From address is a 422 on every send, so it counts as unset.
    assert.equal(resolveNotificationTransport({ RESEND_API_KEY: "re_x" }).configured, false);
    assert.equal(
      resolveNotificationTransport({ RESEND_API_KEY: "re_x", BRANDORA_EMAIL_FROM: "hi@brandora.africa" }).configured,
      true,
    );
  });
});

describe("the email transport", () => {
  it("sends the message and never puts the key in the body", async () => {
    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    const transport = new ResendTransport("re_secret_value", "Brandora <hi@brandora.africa>", async (url, init) => {
      calls.push({ url, headers: init.headers, body: init.body });
      return { status: 200, text: '{"id":"abc"}' };
    });

    await transport.send({ to: "founder@example.com", subject: "Your order", body: "Thanks.", kind: "order.paid" });

    const call = calls[0];
    assert.ok(call);
    const payload = JSON.parse(call.body);
    assert.deepEqual(payload.to, ["founder@example.com"]);
    assert.equal(payload.subject, "Your order");
    assert.equal(payload.from, "Brandora <hi@brandora.africa>");
    assert.equal(call.body.includes("re_secret_value"), false, "the key was serialised into the request body");
  });

  it("throws on a provider error rather than reporting a delivery", async () => {
    const transport = new ResendTransport("re_x", "hi@brandora.africa", async () => ({
      status: 422, text: '{"message":"from address is not verified"}',
    }));

    await assert.rejects(
      () => transport.send({ to: "a@example.com", subject: "s", body: "b", kind: "k" }),
      /422/,
    );
  });
});
