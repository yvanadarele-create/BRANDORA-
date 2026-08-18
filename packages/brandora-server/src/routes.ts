/**
 * Brandora's API.
 *
 * The whole customer journey is here, in the order a founder walks it:
 *
 *   sign up → project → interview → generate → brand → catalogue →
 *   package → quote → checkout → order → dashboard
 *
 * Three rules run through every handler and are worth stating once rather than
 * repeating in each comment.
 *
 * **The session names the user.** No route reads a `userId` from a body or a
 * query string. `requireUser` returns the row the session cookie resolved to,
 * and that id is what goes into the `WHERE` clause. There is therefore no
 * request shape that lets someone act as another account.
 *
 * **Ownership is a filter, not a check.** Reads use `findForOwner(id, userId)`,
 * so another customer's project is *not found* rather than *found and refused*.
 * A 403 confirms the id exists, which is precisely what someone enumerating ids
 * is trying to learn.
 *
 * **Money is recomputed, never accepted.** Package routes take product ids and
 * quantities. Quote routes price from the catalogue. Checkout reads the amount
 * from the stored quote. Nothing here parses a price out of a request body,
 * because no handler has a line that could.
 */

import { randomBytes } from "node:crypto";

import {
  BrandoraError,
  type BrandoraProduct,
  type CurrencyCode,
  type Money,
  NotFoundError,
  ValidationError,
  add,
  formatMoney,
  money,
  multiply,
  sum,
  toMajor,
} from "@brandora/shared";
import {
  INTERVIEW_QUESTIONS,
  type InterviewAnswer,
  type RegenerableField,
  REGENERABLE_FIELDS,
  type StrategyProvider,
  brandKitManifest,
  buildBrief,
  buildGuidelines,
  derivePalette,
  deriveTypography,
  buildLogoBrief,
} from "@brandora/brand-engine";
import { generateBrandWithRetry, regenerateField } from "@brandora/ai";
import { CATALOG, filterProducts } from "@brandora/catalog";
import { defaultPolicy, policyToRow } from "./quote-pricing.js";
import {
  type QualityCheckRow,
  type Repositories,
  type ShipmentInput,
  type ShipmentRow,
  type SupplierInput,
  type SupplierOfferRow,
  type SupplierRow,
  type TestimonialRow,
  type UserRow,
  loadProjectBundle,
  toBrandProfile,
} from "@brandora/database";
import {
  MIN_PASSWORD_LENGTH,
  assertPasswordAcceptable,
  hashPassword,
  newPasswordResetToken,
  newSessionToken,
  passwordResetExpiry,
  passwordResetIsLive,
  sessionExpiry,
  verifyPassword,
  wasteVerificationTime,
} from "@brandora/auth";
import { DEFAULT_VALIDITY_DAYS, quoteReference } from "@brandora/quotes";
import {
  aliexpressIntegrationStatus,
  calendlyUrl,
  googleClientId,
  googleClientSecret,
  googleSignInConfigured,
  notificationsIntegrationStatus,
  paystackIntegrationStatus,
  paystackWebhookSecret,
} from "@brandora/config";

import {
  type HttpResult,
  RateLimitedError,
  RateLimiter,
  Router,
  type ServerLogger,
  json,
  optionalString,
  requireArray,
  requireInteger,
  requireString,
  signValue,
  unsignValue,
} from "./http.js";
import { type PricingSettings, priceProject, recommendProducts } from "./pricing.js";
import { MAX_QUESTION_LENGTH, ask } from "./assistant.js";
import {
  MAX_BRIEF_LENGTH,
  type ProcurementReport,
  sourceFromBrief,
  toSupplierFacts,
} from "./agent.js";
import { type PriceConfidence, authorizeOrder, landedCost, riskSignals } from "./procurement.js";
import {
  type PaymentProvider,
  assertAmountMatches,
  paymentReference,
  paystackSignatureValid,
} from "./payments.js";
import {
  type NotificationTransport,
  deliverOne,
  deliverPending,
  resolveNotificationTransport,
} from "./notifications.js";
import {
  AFTER_PAYMENT,
  FULFILMENT_STATUSES,
  PAYMENT_STATUSES,
  assertFulfilmentTransition,
  isFulfilmentStatus,
  isPaymentStatus,
} from "./fulfilment.js";
import {
  SESSION_COOKIE,
  type SessionContext,
  currentUser,
  publicUser,
  requireAdmin,
  requireUser,
} from "./session.js";

export interface ServerDeps {
  repos: Repositories;
  authSecret: string;
  /** Generates brand strategy. Unconfigured providers fail loudly, never fake. */
  strategy: StrategyProvider;
  payments: PaymentProvider;
  /** Delivers queued notifications. Unconfigured, the queue fills honestly. */
  notifications?: NotificationTransport;
  pricing: PricingSettings;
  publicBaseUrl: string;
  logger: ServerLogger;
  catalog?: readonly BrandoraProduct[];
  now?: () => Date;
  /** Overridden in tests, where every request shares one address. */
  rateLimits?: Partial<RateLimits>;
  /** The environment as the admin integrations page should read it. */
  env?: Record<string, string | undefined>;
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

/** Carries the Google OAuth CSRF state between /start and /callback. Cleared on the way out. */
const GOOGLE_STATE_COOKIE = "brandora_google_state";

/**
 * How a message from Brandora Union signs off.
 *
 * Written once and shared by every notification. Two copies of a phone number
 * is one edit away from two different phone numbers going out in the same week,
 * and the address on an order confirmation is the one a customer actually
 * replies to.
 */
const EMAIL_SIGNATURE = [
  "",
  "Brandora Union — where brands take form.",
  "brandora.union@gmail.com · 0556140994",
].join("\n");

export interface RateLimits {
  loginsPerWindow: number;
  loginWindowMs: number;
  signupsPerWindow: number;
  signupWindowMs: number;
  generationsPerWindow: number;
  generationWindowMs: number;
  subscribesPerWindow: number;
  subscribeWindowMs: number;
  passwordResetsPerWindow: number;
  passwordResetWindowMs: number;
}

/**
 * Deliberately loose on the address-keyed limits.
 *
 * Brandora's customers reach it over West African mobile networks, where
 * carrier-grade NAT puts thousands of people behind one address. A limit tuned
 * as though an IP were a person locks out a whole city block the moment a few
 * founders sign up in the same hour — the failure looks like an outage and is
 * invisible in the logs. Password guessing is throttled hard because a login
 * attempt is cheap to repeat; account creation is throttled gently because a
 * false positive there costs a customer.
 *
 * The generation limit is keyed on the user id, not the address, because it
 * protects a paid API rather than an account.
 */
export const DEFAULT_RATE_LIMITS: RateLimits = {
  loginsPerWindow: 20,
  loginWindowMs: 10 * 60 * 1000,
  signupsPerWindow: 40,
  signupWindowMs: 60 * 60 * 1000,
  generationsPerWindow: 12,
  generationWindowMs: 60 * 60 * 1000,
  // A public form with no account behind it, so this is the one an address can
  // be pointed at cheaply. Still loose enough that an office behind one NAT
  // address can all sign up in an afternoon.
  subscribesPerWindow: 30,
  subscribeWindowMs: 60 * 60 * 1000,
  // Throttled like login, not like signup: a request costs Brandora an email
  // send and costs the target inbox a message they did not ask for, so an
  // address should not be able to trigger many of them quickly. The response
  // is identical whether or not the address has an account either way (no
  // enumeration), so this limit is the only thing standing between the form
  // and an attacker mail-bombing a stranger's inbox with reset links.
  passwordResetsPerWindow: 6,
  passwordResetWindowMs: 60 * 60 * 1000,
};

/* --- Presentation helpers -------------------------------------------------- */

/**
 * How money crosses the wire.
 *
 * Both the integer and a formatted string, because the browser must never do
 * currency arithmetic — it has no idea XOF is zero-decimal, and a front end
 * that divides by 100 turns 15 000 FCFA into 150.
 */
const asMoney = (value: { amount: number; currency: string }) => ({
  amount: value.amount,
  currency: value.currency,
  major: toMajor(value as never),
  display: formatMoney(value as never),
});

const productView = (product: BrandoraProduct) => ({
  id: product.id,
  name: product.name,
  // Both languages travel together; the browser already knows which one the
  // visitor is reading (§ the whole i18n system is client-driven) and picks
  // via localizedField() in api.js. Absent when no French copy exists yet —
  // the client falls back to the English name rather than showing nothing.
  nameFr: product.nameFr ?? null,
  category: product.category,
  subcategory: product.subcategory,
  description: product.description,
  descriptionFr: product.descriptionFr ?? null,
  images: product.images,
  material: product.material ?? null,
  colors: product.colors,
  minimumQuantity: product.minimumQuantity,
  availableQuantity: product.availableQuantity,
  unitPrice: asMoney(product.indicativeUnitPrice),
  // See BrandoraProduct.quoteOnRequest: unitPrice above is zero when this is
  // true, and the interface must never format it as a price.
  quoteOnRequest: product.quoteOnRequest === true,
  supplierReference: product.supplierReference ?? null,
  weightG: product.dimensions?.weightG ?? null,
  featured: product.featured,
  customization: {
    confidence: product.customization.confidence,
    methods: product.customization.methods,
    unitCost: product.customization.unitCost ? asMoney(product.customization.unitCost) : null,
    setupCost: product.customization.setupCost ? asMoney(product.customization.setupCost) : null,
    minimumUnits: product.customization.minimumUnits ?? null,
    notes: product.customization.notes ?? null,
    // §36: a claim only when there is evidence behind it.
    canCarryLogo: product.customization.confidence === "verified",
    label:
      product.customization.confidence === "verified"
        ? "Confirmed: carries your logo"
        : product.customization.confidence === "reported"
          ? "Supplier reports branding — we confirm before you pay"
          : product.customization.confidence === "unavailable"
            ? "Cannot be branded"
            : "Branding not confirmed yet",
  },
  /**
   * §38: no invented dates. The catalogue carries no carrier estimate, so the
   * field is explicitly null and the interface says so rather than guessing.
   */
  deliveryEstimate: null as string | null,
});

/* --- The router ------------------------------------------------------------ */

export function createRouter(deps: ServerDeps): Router {
  const router = new Router();
  const repos = deps.repos;
  const catalog = deps.catalog ?? CATALOG;
  const now = deps.now ?? (() => new Date());
  const session: SessionContext = { repos, authSecret: deps.authSecret };

  const limits: RateLimits = { ...DEFAULT_RATE_LIMITS, ...(deps.rateLimits ?? {}) };
  const loginLimiter = new RateLimiter(limits.loginsPerWindow, limits.loginWindowMs);
  const signupLimiter = new RateLimiter(limits.signupsPerWindow, limits.signupWindowMs);
  const generateLimiter = new RateLimiter(limits.generationsPerWindow, limits.generationWindowMs);
  const subscribeLimiter = new RateLimiter(limits.subscribesPerWindow, limits.subscribeWindowMs);
  const passwordResetLimiter = new RateLimiter(limits.passwordResetsPerWindow, limits.passwordResetWindowMs);

  const byId = new Map(catalog.map((p) => [p.id, p]));

  /** Load a project the caller owns, or 404. */
  const ownedProject = async (ctx: { params: Record<string, string> }, user: UserRow) => {
    const id = ctx.params["id"] ?? "";
    const project = await repos.projects.findForOwner(id, user.id);
    if (!project) throw new NotFoundError("project", id);
    return project;
  };

  const setSessionCookie = async (userId: string): Promise<HttpResult["cookies"]> => {
    const token = newSessionToken();
    await repos.sessions.create(userId, token, sessionExpiry(now()));
    return [
      { name: SESSION_COOKIE, value: signValue(token, deps.authSecret), maxAgeSeconds: SESSION_MAX_AGE },
    ];
  };

  const transport = deps.notifications ?? resolveNotificationTransport(deps.env ?? process.env);

  /**
   * Queue a notification, and try to deliver it now.
   *
   * The record is written first and unconditionally: the fact that a customer
   * should have been told about their payment is worth keeping even in a
   * deployment with no email provider connected, and it is what the queue
   * drains from once one is.
   *
   * Delivery failure never fails the request that caused it. A customer whose
   * payment settled has paid; an email provider having a bad afternoon must not
   * turn that into a 500 and a retry against an order that is already paid. The
   * attempt is recorded on the row and the queue picks it up again.
   */
  const notify = async (
    userId: string,
    orderId: string | undefined,
    kind: string,
    message: {
      subject: string;
      body: string;
      channel?: "email" | "sms" | "whatsapp" | "in-app";
      /** Overrides userId's own email — see recipient_email's comment in schema.sql. */
      to?: string;
    },
  ): Promise<void> => {
    let row;
    try {
      row = await repos.notifications.create({
        userId,
        ...(orderId ? { orderId } : {}),
        kind,
        channel: message.channel ?? "email",
        subject: message.subject,
        body: message.body,
        ...(message.to ? { recipientEmail: message.to } : {}),
      });
    } catch (err) {
      deps.logger.error(`notification ${kind} could not be recorded: ${String(err)}`);
      return;
    }

    if (!transport.configured) return;

    try {
      await deliverOne(repos, transport, row);
    } catch (err) {
      deps.logger.error(`notification ${kind} delivery threw: ${String(err)}`);
    }
  };

  /* --- Health and reference data ----------------------------------------- */

  router.get("/api/health", async () =>
    json(200, {
      status: "ok",
      time: now().toISOString(),
      payments: deps.payments.configured ? deps.payments.name : "not-configured",
    }),
  );

  /**
   * Public configuration the front end needs to render itself.
   *
   * Only values that are already public by nature. There is no branch of this
   * route that returns a credential, because `describeConfig` and the
   * integration statuses cannot produce one.
   */
  router.get("/api/settings", () =>
    json(200, {
      currency: deps.pricing.currency,
      // Empty when unset, and every booking control hides itself rather than
      // linking somewhere that is not a booking page.
      calendlyUrl: calendlyUrl(deps.env ?? process.env),
      // Same rule as calendlyUrl: false until a real Client ID and Secret are
      // both set, and the "Sign in with Google" button hides itself rather
      // than starting a flow that cannot finish.
      googleSignInEnabled: googleSignInConfigured(deps.env ?? process.env),
      locales: ["en", "fr", "es"],
    }),
  );

  // Public: the interview is the front door, and a visitor sees it before they
  // have an account.
  router.get("/api/interview/questions", async () =>
    json(200, {
      questions: INTERVIEW_QUESTIONS.map((q) => ({
        field: q.field,
        prompt: q.prompt,
        because: q.because,
        helpPrompt: q.helpPrompt,
        examples: q.examples,
        kind: q.kind,
        options: q.options ?? [],
        required: q.required,
      })),
    }),
  );

  /**
   * Keep me posted.
   *
   * Public, because asking to hear what a company is building should not
   * require an account.
   *
   * Two things it deliberately does not do. It does not say whether the address
   * was already on the list — a form that answers "you are already subscribed"
   * lets anyone check whether a given address subscribed, which is somebody
   * else's business. And it does not send anything: there is no welcome email
   * because there is no list to welcome anyone to yet, and a confirmation for a
   * newsletter that does not exist is the kind of small lie this codebase does
   * not tell.
   */
  router.post("/api/subscribe", async (ctx) => {
    if (subscribeLimiter.exceeded(ctx.ip)) throw new RateLimitedError("subscribe: too many from this address");

    const email = requireString(ctx.body, "email", 254).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new ValidationError("email", "does not look like an email address");
    }

    const locale = optionalString(ctx.body, "locale", 5);
    const source = optionalString(ctx.body, "source", 40);

    /*
     * Everything past the address is optional, and none of it is validated
     * beyond a length cap. This is a waiting list, not an application form: a
     * rejected submission here is a founder who wanted to hear from Brandora
     * and did not get on the list because their business name had a slash in
     * it. The one thing that must be right is the address, because it is the
     * only way to reach them.
     */
    const name = optionalString(ctx.body, "name", 120);
    const business = optionalString(ctx.body, "business", 160);
    const interest = optionalString(ctx.body, "interest", 200);

    const rawQuantity = ctx.body["quantity"];
    const parsedQuantity =
      typeof rawQuantity === "number"
        ? rawQuantity
        : Number.parseInt(String(rawQuantity ?? "").trim(), 10);
    // Brandora is built for orders of 20 and 30, so there is no lower bound to
    // enforce — only an upper one, to catch a pasted phone number rather than
    // to tell anybody their order is too big.
    const quantity =
      Number.isFinite(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= 10_000_000
        ? Math.floor(parsedQuantity)
        : undefined;

    const { added } = await repos.subscribers.add({
      email,
      ...(locale && ["en", "fr", "es"].includes(locale) ? { locale } : {}),
      ...(source ? { source } : {}),
      ...(name ? { name } : {}),
      ...(business ? { business } : {}),
      ...(interest ? { interest } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
    });

    // The same answer either way. `added` goes to the log, not to the wire.
    if (!added) deps.logger.error(`subscribe: ${email.slice(0, 3)}… was already recorded`);
    return json(201, { subscribed: true });
  });

  /**
   * The testimonials the site may show.
   *
   * Approved rows only. There is no query parameter that widens this, because
   * a quote reaches a visitor because somebody decided it should — not because
   * it exists in a table.
   *
   * An empty list is a correct answer and the front end renders nothing for
   * it. A company that has not yet delivered its first order has no
   * testimonials, and inventing one is fraud with extra steps.
   */
  router.get("/api/testimonials", async () =>
    json(200, { testimonials: (await repos.testimonials.listApproved(12)).map(testimonialView) }),
  );

  /**
   * Where Brandora Union's manufacturers actually are.
   *
   * Feeds the globe. Only suppliers that are not blocked and that have real
   * recorded coordinates — a supplier with no latitude is not plotted at a
   * country centroid, because a centroid is a guess dressed as a coordinate
   * and a map that plots guesses claims a factory in the middle of a desert.
   *
   * Deliberately coarse: a city, a country and a count. It carries no supplier
   * name, no contact and no price, because §7 says a customer never sees those
   * and this is a public route.
   */
  router.get("/api/network", async () => {
    const suppliers = await repos.suppliers.list({ limit: 500 });
    const plottable = suppliers.filter(
      (supplier) =>
        supplier.status !== "blocked" &&
        typeof supplier.latitude === "number" &&
        typeof supplier.longitude === "number",
    );

    return json(200, {
      // Counted from the same list, so the number under the globe and the dots
      // on it can never disagree.
      total: suppliers.filter((supplier) => supplier.status !== "blocked").length,
      plotted: plottable.length,
      countries: [...new Set(plottable.map((s) => s.country).filter(Boolean))].length,
      points: plottable.map((supplier) => ({
        lat: supplier.latitude,
        lon: supplier.longitude,
        country: supplier.country ?? null,
        city: supplier.city ?? null,
        verified: supplier.verifiedAt !== undefined,
      })),
    });
  });

  /* --- Authentication ----------------------------------------------------- */

  router.post("/api/auth/signup", async (ctx) => {
    if (signupLimiter.exceeded(ctx.ip)) {
      throw new RateLimitedError(`signup rate limit from ${ctx.ip}`);
    }

    const email = requireString(ctx.body, "email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new ValidationError("email", "does not look like an email address");
    }
    const name = requireString(ctx.body, "name", 120);
    const password = requireString(ctx.body, "password", 512);
    assertPasswordAcceptable(password);

    // Deliberately the same response as a successful signup would produce is
    // *not* attempted here: an account creation form must tell you the address
    // is taken, or you cannot proceed. The enumeration defence lives on login,
    // where it costs the user nothing.
    if (await repos.users.findByEmail(email)) {
      throw new ValidationError("email", "an account already exists for this address");
    }

    const locale = optionalString(ctx.body, "locale", 5);
    const country = optionalString(ctx.body, "country", 80);
    const phone = optionalString(ctx.body, "phone", 40);

    const user = await repos.users.create({
      email,
      name,
      role: "customer",
      ...(locale === "fr" || locale === "es" ? { locale } : {}),
      ...(country ? { country } : {}),
      ...(phone ? { phone } : {}),
    });

    const record = hashPassword(password);
    await repos.users.setCredentials(user.id, record.hash, record.salt);

    return json(201, { user: publicUser(user) }, { cookies: await setSessionCookie(user.id) });
  });

  router.post("/api/auth/login", async (ctx) => {
    if (loginLimiter.exceeded(ctx.ip)) {
      throw new RateLimitedError(`login rate limit from ${ctx.ip}`);
    }

    const email = requireString(ctx.body, "email", 254);
    const password = requireString(ctx.body, "password", 512);

    const user = await repos.users.findByEmail(email);
    const credentials = user ? await repos.users.credentialsFor(user.id) : null;

    if (!user || !credentials) {
      // Burn the same work a real verification costs, so the response time does
      // not tell an attacker which addresses have accounts.
      wasteVerificationTime();
      throw new BrandoraError("auth.invalid", `no account for ${email}`, 401);
    }

    const ok = verifyPassword(password, {
      hash: credentials.passwordHash,
      salt: credentials.passwordSalt,
    });
    if (!ok) throw new BrandoraError("auth.invalid", `bad password for ${user.id}`, 401);

    loginLimiter.reset(ctx.ip);
    return json(200, { user: publicUser(user) }, { cookies: await setSessionCookie(user.id) });
  });

  /**
   * Request a reset link.
   *
   * The response is the same sentence whether or not the address has an
   * account — the enumeration defence login already has, applied here too,
   * because "no account for that address" is exactly the fact a password
   * reset form must not leak. The generic response happens whether or not the
   * lookup, token creation and email queueing below actually ran.
   */
  router.post("/api/auth/password-reset/request", async (ctx) => {
    if (passwordResetLimiter.exceeded(ctx.ip)) {
      throw new RateLimitedError(`password reset rate limit from ${ctx.ip}`);
    }

    const email = requireString(ctx.body, "email", 254).trim().toLowerCase();
    const GENERIC = {
      requested: true,
      message: "If an account exists for that address, a reset link is on its way.",
    };

    const user = await repos.users.findByEmail(email);
    if (!user) return json(200, GENERIC);

    // A fresh request invalidates any link already out for this account —
    // only the newest email should work.
    await repos.passwordResets.destroyAllFor(user.id);

    const token = newPasswordResetToken();
    await repos.passwordResets.create(user.id, token, passwordResetExpiry(now()));

    const resetUrl = `${deps.publicBaseUrl}/reset-password.html?token=${encodeURIComponent(token)}`;
    await notify(user.id, undefined, "auth.password-reset-requested", {
      subject: "Reset your Brandora password",
      body:
        `We received a request to reset the password on your Brandora account.\n\n` +
        `Reset it here (valid for one hour): ${resetUrl}\n\n` +
        `If you did not request this, you can ignore this email — your password has not been changed.`,
    });

    return json(200, GENERIC);
  });

  /**
   * Spend the token.
   *
   * A missing, expired or already-used token gets the same error — an
   * attacker probing which is true learns nothing either way, the same
   * reasoning as the generic response above.
   */
  router.post("/api/auth/password-reset/confirm", async (ctx) => {
    const token = requireString(ctx.body, "token", 128);
    const password = requireString(ctx.body, "password", 512);

    const record = await repos.passwordResets.find(token);
    const valid = record && !record.usedAt && passwordResetIsLive(record.expiresAt, now());
    if (!record || !valid) {
      throw new BrandoraError("auth.reset-invalid", "reset token missing, used or expired", 400);
    }

    assertPasswordAcceptable(password);
    const hashed = hashPassword(password);
    await repos.users.setCredentials(record.userId, hashed.hash, hashed.salt);
    await repos.passwordResets.markUsed(token);

    // A changed password invalidates every session — the whole point of a
    // reset is that whoever had the old password should be logged out
    // everywhere, not just unable to log back in with it.
    await repos.sessions.destroyAllFor(record.userId);

    return json(200, { reset: true }, { cookies: await setSessionCookie(record.userId) });
  });

  /**
   * Google sign-in, start.
   *
   * Redirects to Google's consent screen with a CSRF `state` value carried in
   * a short-lived signed cookie — compared, not trusted, on the way back at
   * /callback. 404s rather than redirecting to a Client ID that does not
   * exist when Google sign-in is not configured; the button that links here
   * is already hidden in that case (see /api/settings), so reaching this
   * route unconfigured means someone typed the URL by hand.
   */
  router.get("/api/auth/google/start", async () => {
    const clientId = googleClientId(deps.env ?? process.env);
    if (!clientId) throw new NotFoundError("route", "/api/auth/google/start");

    const state = randomBytes(24).toString("base64url");
    const redirectUri = `${deps.publicBaseUrl}/api/auth/google/callback`;
    const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "openid email profile");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("prompt", "select_account");

    return {
      status: 302,
      headers: { Location: authorizeUrl.toString() },
      cookies: [{ name: GOOGLE_STATE_COOKIE, value: signValue(state, deps.authSecret), maxAgeSeconds: 600 }],
    };
  });

  /**
   * Google sign-in, callback.
   *
   * Two server-to-server calls and nothing else: exchange the code for an
   * access token, then ask Google's userinfo endpoint who it belongs to.
   * Neither step needs this server to verify a JWT signature itself — the
   * calls are already authenticated by Google over TLS — so no JOSE/JWT
   * dependency was added for a check the HTTP call already makes.
   *
   * A Google account with an unverified email is refused rather than trusted:
   * `email_verified` is Google's own attestation that the address is real,
   * and signing someone in against an address they do not control is exactly
   * the account-takeover this whole flow exists to prevent.
   */
  router.get("/api/auth/google/callback", async (ctx) => {
    const clientId = googleClientId(deps.env ?? process.env);
    const clientSecret = googleClientSecret(deps.env ?? process.env);
    const failure = (reason: string) => ({
      status: 302 as const,
      headers: { Location: `/login.html?error=${encodeURIComponent(reason)}` },
    });

    if (!clientId || !clientSecret) return failure("google-not-configured");

    const code = ctx.query.get("code");
    const state = ctx.query.get("state");
    const expectedState = unsignValue(ctx.cookies[GOOGLE_STATE_COOKIE], deps.authSecret);
    if (!code || !state || !expectedState || state !== expectedState) {
      return failure("google-state-mismatch");
    }

    const redirectUri = `${deps.publicBaseUrl}/api/auth/google/callback`;

    let accessToken: string;
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!tokenResponse.ok) return failure("google-token-exchange-failed");
      const tokenBody = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenBody.access_token) return failure("google-token-exchange-failed");
      accessToken = tokenBody.access_token;
    } catch {
      return failure("google-unreachable");
    }

    let profile: { email?: string; email_verified?: boolean; name?: string };
    try {
      const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!profileResponse.ok) return failure("google-profile-failed");
      profile = (await profileResponse.json()) as typeof profile;
    } catch {
      return failure("google-unreachable");
    }

    if (!profile.email || !profile.email_verified) return failure("google-email-unverified");

    const email = profile.email.trim().toLowerCase();
    let user = await repos.users.findByEmail(email);
    if (!user) {
      user = await repos.users.create({
        email,
        name: profile.name?.trim() || email.split("@")[0] || "Brandora customer",
        role: "customer",
      });
      // No setCredentials call: this account has no password, by design —
      // credentialsFor() returning null already makes the password-login
      // route refuse it correctly, with no extra branch needed there.
    }

    return {
      status: 302,
      headers: { Location: "/dashboard.html" },
      cookies: [
        ...(await setSessionCookie(user.id))!,
        { name: GOOGLE_STATE_COOKIE, value: "", clear: true },
      ],
    };
  });

  router.post("/api/auth/logout", async (ctx) => {
    const user = await requireUser(ctx, session);
    // Every session, not just this cookie: "log out" on a shared phone should
    // mean it, and a single-device logout is the surprising behaviour here.
    await repos.sessions.destroyAllFor(user.id);
    return json(200, { ok: true }, { cookies: [{ name: SESSION_COOKIE, value: "", clear: true }] });
  });

  /**
   * Who is signed in — including "nobody".
   *
   * Deliberately 200 with a null user rather than 401. Every page asks this on
   * load to decide what to put in the header, and a 401 there is not a failure:
   * it is the answer. Returning an error status made a browser log a console
   * error on every page a signed-out visitor opened, which buries the errors
   * that do matter. Routes that actually need a user still answer 401.
   */
  router.get("/api/auth/me", async (ctx) => {
    const user = await currentUser(ctx, session);
    return json(200, { user: user ? publicUser(user) : null });
  });

  router.get("/api/auth/password-policy", async () =>
    json(200, { minimumLength: MIN_PASSWORD_LENGTH }),
  );

  /* --- Projects ----------------------------------------------------------- */

  router.get("/api/projects", async (ctx) => {
    const user = await requireUser(ctx, session);
    // One joined query, not three per project: see listSummariesForOwner.
    const projects = await repos.projects.listSummariesForOwner(user.id);
    return json(200, {
      projects: projects.map((project) => ({
        ...project,
        // What "Resume" should do, computed here so every surface agrees.
        nextStep: nextStepFor(project.status, project.brandName !== null, project.packageItems),
      })),
    });
  });

  router.post("/api/projects", async (ctx) => {
    const user = await requireUser(ctx, session);
    const name = requireString(ctx.body, "name", 120);
    const project = await repos.projects.create(user.id, name);
    return json(201, { project });
  });

  router.get("/api/projects/:id", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    const bundle = await loadProjectBundle(repos, project.id, user.id);
    if (!bundle) throw new NotFoundError("project", project.id);

    const items = await repos.packages.listForProject(project.id);
    return json(200, {
      project: bundle.project,
      interview: bundle.interview,
      strategy: bundle.strategy,
      identity: bundle.identity,
      packageItems: items.length,
      quotes: (await repos.quotes.listForProject(project.id, user.id)).map(quoteView),
      nextStep: nextStepFor(project.status, !!bundle.strategy, items.length),
    });
  });

  router.patch("/api/projects/:id", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    const name = requireString(ctx.body, "name", 120);
    await repos.projects.rename(project.id, user.id, name);
    return json(200, { project: await repos.projects.findForOwner(project.id, user.id) });
  });

  /* --- Interview ---------------------------------------------------------- */

  router.put("/api/projects/:id/interview", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);

    const answers = readAnswers(ctx.body);
    const complete = isComplete(answers);

    const row = await repos.interviews.save(project.id, { answers }, complete);
    await repos.projects.setStatus(project.id, user.id, complete ? "interviewing" : "draft");

    return json(200, { interview: row, complete });
  });

  router.get("/api/projects/:id/interview", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    const row = await repos.interviews.findForProject(project.id);
    return json(200, { interview: row });
  });

  /* --- Generation --------------------------------------------------------- */

  router.post("/api/projects/:id/generate", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);

    if (generateLimiter.exceeded(user.id)) {
      throw new RateLimitedError(`generation rate limit for ${user.id}`);
    }

    const stored = await repos.interviews.findForProject(project.id);
    if (!stored) {
      throw new BrandoraError("brand.interview-incomplete", "no interview saved for this project", 409);
    }

    const answers = readAnswers(stored.responses);
    const existingName = optionalString(ctx.body, "existingName", 120);
    const variation = typeof ctx.body["variation"] === "number" ? ctx.body["variation"] : 0;

    const result = await generateBrandWithRetry(deps.strategy, {
      userId: user.id,
      answers,
      locale: user.locale,
      ...(existingName ? { existingName } : {}),
      variation,
      brandId: project.id,
      now: now(),
    });

    await repos.strategies.save(
      project.id,
      {
        name: result.strategy.name,
        description: result.strategy.description,
        industry: result.strategy.industry,
        positioning: result.strategy.positioning,
        targetCustomer: result.strategy.targetCustomer,
        personality: result.strategy.personality,
        promise: result.strategy.promise,
        mission: result.strategy.mission,
        vision: result.strategy.vision,
        slogan: result.strategy.slogan,
        toneOfVoice: result.strategy.toneOfVoice,
        brandStory: result.strategy.brandStory,
        nameAlternatives: result.strategy.nameAlternatives,
      },
      result.raw,
    );

    await repos.identities.save(project.id, {
      palette: result.profile.palette,
      typography: result.profile.typography,
      logoBrief: result.profile.logoBrief,
    });

    await repos.projects.setStatus(project.id, user.id, "generated");
    if (project.name === "Untitled brand" || project.name.trim() === "") {
      await repos.projects.rename(project.id, user.id, result.strategy.name);
    }

    return json(201, { strategy: result.strategy, identity: identityView(result.profile) });
  });

  router.post("/api/projects/:id/regenerate", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);

    if (generateLimiter.exceeded(user.id)) {
      throw new RateLimitedError(`regeneration rate limit for ${user.id}`);
    }

    const field = requireString(ctx.body, "field", 40);
    if (!(REGENERABLE_FIELDS as readonly string[]).includes(field)) {
      throw new ValidationError("field", `expected one of ${REGENERABLE_FIELDS.join(", ")}`);
    }

    const stored = await repos.strategies.findForProject(project.id);
    const interview = await repos.interviews.findForProject(project.id);
    if (!stored || !interview) {
      throw new BrandoraError("brand.not-generated", "no strategy to regenerate a field from", 409);
    }

    const brief = buildBrief(readAnswers(interview.responses), user.locale);
    const updated = await regenerateField(
      deps.strategy,
      brief,
      {
        name: stored.name,
        description: stored.description,
        industry: stored.industry,
        targetCustomer: stored.targetCustomer,
        positioning: stored.positioning,
        personality: stored.personality,
        promise: stored.promise,
        mission: stored.mission,
        vision: stored.vision,
        slogan: stored.slogan,
        toneOfVoice: stored.toneOfVoice,
        brandStory: stored.brandStory,
        nameAlternatives: stored.nameAlternatives,
      },
      field as RegenerableField,
    );

    await repos.strategies.save(project.id, { ...updated }, updated);
    return json(200, { strategy: updated });
  });

  /**
   * Re-derive the palette without touching the words (§18).
   *
   * The variation is a seed, so "show me another" is reproducible rather than
   * random — a founder who liked the third one can get it back.
   */
  router.post("/api/projects/:id/identity/regenerate", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);

    const interview = await repos.interviews.findForProject(project.id);
    const strategy = await repos.strategies.findForProject(project.id);
    if (!interview || !strategy) throw new ValidationError("identity", "generate a brand first");

    const variation = requireInteger(ctx.body, "variation", 0, 99);
    const brief = buildBrief(readAnswers(interview.responses), user.locale);
    const palette = derivePalette(brief, { variation });
    const typography = deriveTypography(brief);

    const saved = await repos.identities.save(project.id, {
      palette,
      typography,
      logoBrief: buildLogoBrief(brief, palette, typography, strategy.name),
    });

    return json(200, { identity: saved });
  });

  /* --- The brand ---------------------------------------------------------- */

  router.get("/api/projects/:id/brand", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    const bundle = await loadProjectBundle(repos, project.id, user.id);
    if (!bundle) throw new NotFoundError("project", project.id);

    const profile = toBrandProfile(bundle);
    if (!profile) throw new NotFoundError("brand", project.id);

    return json(200, {
      brand: profile,
      kit: brandKitManifest(profile),
      guidelines: buildGuidelines(profile),
      nameAlternatives: bundle.strategy?.nameAlternatives ?? [],
    });
  });

  router.get("/api/projects/:id/brand/guidelines", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    const bundle = await loadProjectBundle(repos, project.id, user.id);
    const profile = bundle ? toBrandProfile(bundle) : null;
    if (!profile) throw new NotFoundError("brand", project.id);

    return {
      status: 200,
      raw: buildGuidelines(profile),
      contentType: "text/markdown; charset=utf-8",
      headers: {
        "Content-Disposition": `attachment; filename="${profile.name.replace(/[^\w-]+/g, "-")}-guidelines.md"`,
      },
    };
  });

  /* --- Catalogue ---------------------------------------------------------- */

  router.get("/api/catalog", async (ctx) => {
    const quantityRaw = ctx.query.get("quantity");
    const quantity = quantityRaw ? Number(quantityRaw) : undefined;
    const category = ctx.query.get("category") ?? undefined;
    const search = ctx.query.get("q") ?? undefined;
    const customizable = ctx.query.get("customizable") === "true";

    const result = filterProducts(
      {
        ...(category && category !== "all" ? { category: category as never } : {}),
        ...(search ? { search } : {}),
        ...(quantity && Number.isFinite(quantity) ? { quantity } : {}),
        ...(customizable ? { customizableOnly: true } : {}),
      },
      catalog,
    );

    return json(200, {
      products: result.matches.map(productView),
      // §35: shown under their own heading rather than dropped. "We have this,
      // but not at thirty" is the sentence that teaches a founder that fifty
      // units unlocks a better shelf.
      nearMisses: result.nearMisses.map(productView),
      total: catalog.length,
    });
  });

  router.get("/api/catalog/:productId", async (ctx) => {
    const product = byId.get(ctx.params["productId"] ?? "");
    if (!product) throw new NotFoundError("product", ctx.params["productId"] ?? "");
    return json(200, { product: productView(product) });
  });

  router.get("/api/projects/:id/recommendations", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    const strategy = await repos.strategies.findForProject(project.id);
    if (!strategy) {
      throw new BrandoraError("brand.not-generated", "no strategy to recommend against", 409);
    }

    const quantityRaw = Number(ctx.query.get("quantity") ?? 25);
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.floor(quantityRaw) : 25;

    const ranked = recommendProducts(
      {
        positioning: strategy.positioning,
        personality: strategy.personality,
        industry: `${strategy.industry} ${strategy.description}`,
        quantity,
      },
      catalog,
    );

    return json(200, {
      quantity,
      recommendations: ranked.map((entry) => ({
        product: productView(entry.product),
        score: entry.score,
        reasons: entry.reasons,
      })),
    });
  });

  /* --- Ask Brandora -------------------------------------------------------- */

  /**
   * The assistant, grounded in this customer's brand and the real catalogue.
   *
   * Behind `requireUser` and scoped to a project they own, because the answer
   * is built from their brand — and because it costs a paid model call, which
   * is not something to leave open to the internet.
   */
  router.post("/api/projects/:id/assistant", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);

    if (generateLimiter.exceeded(user.id)) {
      throw new RateLimitedError(`assistant rate limit for ${user.id}`);
    }

    const bundle = await loadProjectBundle(repos, project.id, user.id);
    const strategy = bundle?.strategy;
    if (!strategy) {
      throw new BrandoraError("brand.not-generated", "the assistant answers from the strategy", 409);
    }

    const question = requireString(ctx.body, "question", MAX_QUESTION_LENGTH);

    const result = await ask({
      question,
      brand: {
        name: strategy.name,
        description: strategy.description,
        industry: strategy.industry,
        positioning: strategy.positioning,
        targetCustomer: strategy.targetCustomer,
        personality: strategy.personality,
        promise: strategy.promise,
        toneOfVoice: strategy.toneOfVoice,
        palette: bundle?.identity?.palette ?? [],
        typography: bundle?.identity?.typography
          ? {
              primary: bundle.identity.typography.primary,
              secondary: bundle.identity.typography.secondary,
            }
          : null,
      },
      catalog,
      provider: deps.strategy,
    });

    // A cited id that was never offered means the model invented a product.
    // The customer never sees it — `products` is resolved from the catalogue —
    // but an administrator should know it happened.
    if (result.unreferencedClaims.length > 0) {
      deps.logger.error(
        `assistant invented product ids for ${project.id}: ${result.unreferencedClaims.join(", ")}`,
      );
    }

    return json(200, {
      answer: result.answer,
      quantity: result.quantity,
      // Rendered from our data, never from the model's prose.
      products: result.products.map(productView),
    });
  });

  /* --- The package -------------------------------------------------------- */

  const packageResponse = async (projectId: string) => {
    const items = await repos.packages.listForProject(projectId);
    if (items.length === 0) {
      return { items: [], totals: null, adjustments: [], currency: deps.pricing.currency };
    }

    const priced = priceProject(
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        ...(item.customizationMethod ? { customizationMethod: item.customizationMethod } : {}),
      })),
      catalog,
      deps.pricing,
    );

    return {
      currency: deps.pricing.currency,
      items: items.map((item) => {
        const product = byId.get(item.productId);
        const line = priced.lines.find((l) => l.productId === item.productId);
        return {
          id: item.id,
          productId: item.productId,
          name: product?.name ?? item.productId,
          image: product?.images[0] ?? null,
          quantity: item.quantity,
          chargedQuantity: line?.quantity ?? item.quantity,
          customizationMethod: item.customizationMethod || null,
          unitPrice: product ? asMoney(product.indicativeUnitPrice) : null,
          lineTotal: line ? asMoney(add(line.productsTotal, line.customizationTotal)) : null,
        };
      }),
      totals: {
        products: asMoney(priced.productsTotal),
        customization: asMoney(priced.customizationTotal),
        shipping: asMoney(priced.shippingTotal),
        logistics: asMoney(priced.logisticsTotal),
        service: asMoney(priced.serviceTotal),
        total: asMoney(priced.total),
        unitCount: priced.unitCount,
      },
      adjustments: priced.adjustments,
    };
  };

  router.get("/api/projects/:id/package", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    return json(200, await packageResponse(project.id));
  });

  router.post("/api/projects/:id/package/items", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);

    const productId = requireString(ctx.body, "productId", 80);
    const product = byId.get(productId);
    if (!product) throw new ValidationError("productId", `unknown product ${productId}`);
    // A quote-on-request product has no landed price to sum into a package
    // total — adding it would either silently price it at zero or crash the
    // package view. It gets its own request-a-quote path instead.
    if (product.quoteOnRequest) {
      throw new ValidationError(
        "productId",
        `${product.name} has no fixed price yet — request a quote for it directly`,
      );
    }

    const quantity = requireInteger(ctx.body, "quantity", 1, 1_000_000);
    const method = optionalString(ctx.body, "customizationMethod", 40);

    // §36 again, this time at the write: a method Brandora has not confirmed
    // cannot be attached to a line, so it can never reach a quote.
    if (method) {
      const offered = (product.customization.methods as readonly string[]).includes(method);
      if (!offered || product.customization.confidence !== "verified") {
        throw new ValidationError("customizationMethod", `${product.name} does not offer confirmed ${method}`);
      }
    }

    await repos.packages.add(project.id, productId, quantity, method ?? "");
    return json(201, await packageResponse(project.id));
  });

  router.patch("/api/projects/:id/package/items/:itemId", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    const quantity = requireInteger(ctx.body, "quantity", 1, 1_000_000);
    // Scoped to the project: an item id belonging to someone else's package
    // updates nothing rather than updating theirs.
    await repos.packages.setQuantity(project.id, ctx.params["itemId"] ?? "", quantity);
    return json(200, await packageResponse(project.id));
  });

  router.delete("/api/projects/:id/package/items/:itemId", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    await repos.packages.remove(project.id, ctx.params["itemId"] ?? "");
    return json(200, await packageResponse(project.id));
  });

  router.delete("/api/projects/:id/package", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);
    await repos.packages.clear(project.id);
    return json(200, await packageResponse(project.id));
  });

  /* --- Quotes -------------------------------------------------------------- */

  router.post("/api/projects/:id/quote", async (ctx) => {
    const user = await requireUser(ctx, session);
    const project = await ownedProject(ctx, user);

    const items = await repos.packages.listForProject(project.id);
    if (items.length === 0) {
      throw new BrandoraError("package.empty", "no package items to price", 409);
    }

    const priced = priceProject(
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        ...(item.customizationMethod ? { customizationMethod: item.customizationMethod } : {}),
      })),
      catalog,
      deps.pricing,
    );

    const issuedAt = now();
    const validUntil = new Date(issuedAt.getTime());
    validUntil.setUTCDate(validUntil.getUTCDate() + DEFAULT_VALIDITY_DAYS);

    const currency = deps.pricing.currency;
    const fees = sum([priced.logisticsTotal, priced.serviceTotal], currency);
    const subtotal = add(priced.productsTotal, priced.customizationTotal);

    // Margin is stored, never returned by a customer-facing read (§39). It is
    // written here so an admin can see it later; the quote view below has no
    // field it could travel in.
    const margin = multiply(subtotal, deps.pricing.serviceRate);

    const quote = await insertQuoteWithUniqueReference(repos, issuedAt, {
      projectId: project.id,
      userId: user.id,
      currency,
      lineItems: priced.lines.map((line) => ({
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice.amount,
        total: add(line.productsTotal, line.customizationTotal).amount,
      })),
      subtotal: subtotal.amount,
      shipping: priced.shippingTotal.amount,
      fees: fees.amount,
      total: priced.total.amount,
      margin: margin.amount,
      validUntil: validUntil.toISOString(),
    });

    await repos.projects.setStatus(project.id, user.id, "active");
    return json(201, { quote: quoteView(quote) });
  });

  router.get("/api/quotes", async (ctx) => {
    const user = await requireUser(ctx, session);
    return json(200, { quotes: (await repos.quotes.listForOwner(user.id)).map(quoteView) });
  });

  router.get("/api/quotes/:id", async (ctx) => {
    const user = await requireUser(ctx, session);
    const quote = await repos.quotes.findForOwner(ctx.params["id"] ?? "", user.id);
    if (!quote) throw new NotFoundError("quote", ctx.params["id"] ?? "");
    return json(200, { quote: quoteView(quote) });
  });

  /* --- Checkout ------------------------------------------------------------ */

  /**
   * Turn a quote into an order and start a payment.
   *
   * The request body carries no amount — there is nowhere to put one. The
   * charge is `quote.total` as stored, and that same figure is written to the
   * `payments` row so verification has something to compare against that the
   * customer never touched.
   */
  router.post("/api/quotes/:id/checkout", async (ctx) => {
    const user = await requireUser(ctx, session);
    const quoteId = ctx.params["id"] ?? "";
    const quote = await repos.quotes.findForOwner(quoteId, user.id);
    if (!quote) throw new NotFoundError("quote", quoteId);

    if (quote.status === "rejected" || quote.status === "expired") {
      throw new ValidationError("quote", `quote ${quote.reference} is ${quote.status}`);
    }
    if (new Date(quote.validUntil).getTime() < now().getTime()) {
      await repos.quotes.setStatus(quote.id, "expired");
      throw new ValidationError("quote", `quote ${quote.reference} expired on ${quote.validUntil}`);
    }

    const issuedAt = now();
    const order = await insertOrderWithUniqueReference(repos, issuedAt, {
      userId: user.id,
      projectId: quote.projectId,
      quoteId: quote.id,
      total: quote.total.amount,
      currency: quote.currency,
    });

    await repos.quotes.setStatus(quote.id, "approved");
    await repos.orders.addEvent(order.id, "created", `customer:${user.id}`, `from quote ${quote.reference}`);

    const reference = paymentReference(order.reference, (await repos.payments.listForOrder(order.id)).length + 1);
    await repos.payments.create({
      orderId: order.id,
      provider: deps.payments.name,
      reference,
      amount: quote.total.amount,
      currency: quote.currency,
    });

    const intent = await deps.payments.initialise({
      reference,
      amount: quote.total,
      email: user.email,
      callbackUrl: `${deps.publicBaseUrl}/order?ref=${encodeURIComponent(order.reference)}`,
    });

    if (deps.payments.configured) {
      await repos.orders.setPaymentStatus(order.id, "pending");
      await repos.orders.addEvent(order.id, "payment-initialised", "system", `${deps.payments.name} ${reference}`);
    } else {
      // No provider: the order is real and awaiting an arranged payment. It is
      // never marked paid by anything on this path.
      await repos.orders.setPaymentStatus(order.id, "pending");
      await repos.orders.addEvent(order.id, "payment-manual", "system", "awaiting arranged payment");
    }

    return json(201, {
      order: orderView(await repos.orders.findForOwner(order.id, user.id) ?? order),
      payment: {
        reference: intent.reference,
        authorizationUrl: intent.authorizationUrl,
        instruction: intent.instruction,
        provider: intent.provider,
        configured: deps.payments.configured,
      },
    });
  });

  /**
   * Settle one payment reference, whoever asked.
   *
   * The customer returning from the payment page and Paystack's webhook are two
   * signals about the same fact, and they must not be two implementations of
   * it — a webhook path that settles more cheaply than the browser path is how
   * an order gets marked paid without the amount ever being checked.
   *
   * Neither caller supplies an amount or a status. Both are read from the
   * provider, and the amount is compared against the `payments` row written at
   * initialisation, which itself came from the stored quote.
   *
   * Idempotent: a reference already `paid` returns settled without touching the
   * order again. Paystack retries a webhook it did not get a 200 for, so this
   * runs more than once as a matter of course.
   */
  const settlePayment = async (
    reference: string,
    actor: string,
  ): Promise<{ settled: boolean; providerStatus: string; orderId: string | null }> => {
    const payment = await repos.payments.findByReference(reference);
    if (!payment) return { settled: false, providerStatus: "unknown-reference", orderId: null };

    if (payment.status === "paid") {
      return { settled: true, providerStatus: "already-settled", orderId: payment.orderId };
    }
    if (payment.status === "mismatch") {
      // Refused once on the amount. It does not become correct on a retry.
      return { settled: false, providerStatus: "mismatch", orderId: payment.orderId };
    }

    const result = await deps.payments.verify(reference);
    if (!result.paid) {
      return { settled: false, providerStatus: result.providerStatus, orderId: payment.orderId };
    }

    try {
      assertAmountMatches(payment.amount, result.amount);
    } catch (err) {
      await repos.payments.markStatus(reference, "mismatch");
      await repos.orders.addEvent(payment.orderId, "payment-mismatch", actor, reference);
      throw err;
    }

    await repos.payments.markPaid(reference, now().toISOString());
    await repos.orders.setPaymentStatus(payment.orderId, "paid");

    // §17: a paid order goes to a person, not to a supplier. Nothing automated
    // moves it past this point.
    await repos.orders.setFulfillmentStatus(payment.orderId, AFTER_PAYMENT);
    await repos.orders.addEvent(payment.orderId, "paid", actor, reference);
    await repos.orders.addEvent(
      payment.orderId,
      "awaiting-operations-approval",
      "system",
      "a Brandora Union administrator reviews this before it reaches a supplier",
    );

    const target = await repos.orders.notificationTarget(payment.orderId);
    if (target) {
      await notify(target.userId, payment.orderId, "order.paid", {
        subject: `Payment received — order ${target.reference}`,
        body: [
          `We have your payment for order ${target.reference}.`,
          "",
          "A member of the Brandora Union team reviews every paid order before it reaches a supplier.",
          "You will hear from us when it moves to production.",
          EMAIL_SIGNATURE,
        ].join("\n"),
      });
    }

    return { settled: true, providerStatus: result.providerStatus, orderId: payment.orderId };
  };

  /**
   * Confirm a payment with the provider.
   *
   * Called on return from the payment page. The amount comparison is the point:
   * whatever the provider reports must equal what Brandora recorded when the
   * charge was created, or the payment is marked `mismatch` and the order stays
   * unpaid.
   */
  router.post("/api/orders/:id/verify", async (ctx) => {
    const user = await requireUser(ctx, session);
    const order = await repos.orders.findForOwner(ctx.params["id"] ?? "", user.id);
    if (!order) throw new NotFoundError("order", ctx.params["id"] ?? "");

    const attempts = await repos.payments.listForOrder(order.id);
    const pending = attempts.find((p) => p.status === "initialised") ?? attempts[0];
    if (!pending) {
      throw new BrandoraError("payment.not-started", `no payment attempt for order ${order.id}`, 409);
    }

    if (pending.status === "paid") {
      return json(200, { order: orderView(order), payment: paymentView(pending) });
    }

    const outcome = await settlePayment(pending.reference, "system");

    if (!outcome.settled) {
      return json(200, {
        order: orderView((await repos.orders.findForOwner(order.id, user.id)) ?? order),
        payment: { ...paymentView(pending), providerStatus: outcome.providerStatus },
        settled: false,
      });
    }

    const settled = await repos.orders.findForOwner(order.id, user.id);
    return json(200, {
      order: orderView(settled ?? order),
      payment: paymentView(await repos.payments.findByReference(pending.reference) ?? pending),
      settled: true,
    });
  });

  /**
   * Paystack's webhook.
   *
   * The customer's return to the order page is the happy path, and it is the
   * one that breaks: a closed tab, a dead battery, a bank app that swallows the
   * redirect. Paystack tells us anyway — this is the endpoint that hears it.
   *
   * Four things make it safe to expose without a session.
   *
   * **The signature is checked against the raw bytes.** `ctx.rawBody` is the
   * body exactly as it arrived; re-serialising the parsed object reorders keys
   * and invalidates the HMAC. Compared in constant time.
   *
   * **The payload is a trigger, not evidence.** Nothing is read from it except
   * the reference. Whether the charge succeeded, and for how much, comes from
   * calling Paystack back — so a forged body with a valid-looking shape cannot
   * mark anything paid, and neither can a replayed one.
   *
   * **It is idempotent.** Paystack retries anything it did not get a 200 for.
   * `settlePayment` returns early on a reference that is already `paid`.
   *
   * **It always answers 200 once the signature holds.** A reference we do not
   * recognise, or an event we do not act on, is still a well-formed message
   * from Paystack; answering 4xx makes them retry it for hours.
   */
  router.post("/api/webhooks/paystack", async (ctx) => {
    const secret = paystackWebhookSecret(deps.env ?? process.env);

    // Nothing to verify against means nothing can be trusted. 404 rather than
    // 503: in a deployment with no Paystack, this endpoint does not exist, and
    // saying so tells a prober nothing about the configuration.
    if (secret === "") throw new NotFoundError("route", "/api/webhooks/paystack");

    const header = ctx.headers["x-paystack-signature"];
    const signature = Array.isArray(header) ? header[0] : header;

    if (!paystackSignatureValid(ctx.rawBody, signature, secret)) {
      // No detail. A response that distinguishes "missing" from "wrong" is a
      // free oracle for someone forging one.
      deps.logger.error("paystack webhook rejected: signature did not verify");
      return json(401, { error: { message: "Unauthorized" } });
    }

    const event = typeof ctx.body["event"] === "string" ? ctx.body["event"] : "";
    const data = ctx.body["data"];
    const reference =
      typeof data === "object" && data !== null && typeof (data as Record<string, unknown>)["reference"] === "string"
        ? ((data as Record<string, unknown>)["reference"] as string)
        : "";

    if (event !== "charge.success" || reference === "") {
      return json(200, { received: true, acted: false });
    }

    try {
      const outcome = await settlePayment(reference, "paystack-webhook");
      return json(200, { received: true, acted: outcome.settled });
    } catch (err) {
      // An amount mismatch throws. It is already recorded against the payment
      // and the order, and Paystack must not be asked to redeliver it — the
      // next attempt would reach the same conclusion and the row is already
      // marked `mismatch` for an administrator to pick up.
      deps.logger.error(
        `paystack webhook could not settle ${reference}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return json(200, { received: true, acted: false });
    }
  });

  /* --- Orders -------------------------------------------------------------- */

  router.get("/api/orders", async (ctx) => {
    const user = await requireUser(ctx, session);
    return json(200, { orders: (await repos.orders.listForOwner(user.id)).map(orderView) });
  });

  router.get("/api/orders/:id", async (ctx) => {
    const user = await requireUser(ctx, session);
    const order = await repos.orders.findForOwner(ctx.params["id"] ?? "", user.id);
    if (!order) throw new NotFoundError("order", ctx.params["id"] ?? "");

    const quote = await repos.quotes.findForOwner(order.quoteId, user.id);
    return json(200, {
      order: orderView(order),
      quote: quote ? quoteView(quote) : null,
      events: await repos.orders.events(order.id),
      payments: (await repos.payments.listForOrder(order.id)).map(paymentView),
    });
  });

  /* --- The customer dashboard --------------------------------------------- */

  router.get("/api/dashboard", async (ctx) => {
    const user = await requireUser(ctx, session);

    // Three independent reads; nothing here waits on anything else's result.
    const [projects, quotes, orders] = await Promise.all([
      repos.projects.listSummariesForOwner(user.id),
      repos.quotes.listForOwner(user.id),
      repos.orders.listForOwner(user.id),
    ]);

    return json(200, {
      user: publicUser(user),
      projects: projects.map((project) => ({
        id: project.id,
        name: project.brandName ?? project.name,
        status: project.status,
        slogan: project.slogan,
        palette: project.palette,
        packageItems: project.packageItems,
        updatedAt: project.updatedAt,
        nextStep: nextStepFor(project.status, project.brandName !== null, project.packageItems),
      })),
      quotes: quotes.map(quoteView),
      orders: orders.map(orderView),
      counts: { projects: projects.length, quotes: quotes.length, orders: orders.length },
    });
  });

  /* --- Admin --------------------------------------------------------------- */

  router.get("/api/admin/overview", async (ctx) => {
    await requireAdmin(ctx, session);
    const orders = await repos.orders.listAsAdmin(500);
    const quotes = await repos.quotes.listAsAdmin(500);
    const currency = deps.pricing.currency;

    const paid = orders.filter((o) => o.paymentStatus === "paid");
    const revenue = sum(
      paid.filter((o) => o.currency === currency).map((o) => o.total),
      currency,
    );

    return json(200, {
      counts: {
        customers: (await repos.users.listAsAdmin(1_000)).length,
        projects: (await repos.projects.listAsAdmin(1_000)).length,
        quotes: quotes.length,
        orders: orders.length,
        awaitingFulfilment: orders.filter(
          (o) => o.paymentStatus === "paid" && o.fulfillmentStatus !== "delivered",
        ).length,
      },
      revenue: asMoney(revenue),
      integrations: [
        aliexpressIntegrationStatus(deps.env ?? process.env),
        paystackIntegrationStatus(deps.env ?? process.env),
        notificationsIntegrationStatus(deps.env ?? process.env),
      ],
    });
  });

  router.get("/api/admin/customers", async (ctx) => {
    await requireAdmin(ctx, session);
    const customers = await repos.users.listWithCountsAsAdmin(500);
    return json(200, {
      customers: customers.map((customer) => ({
        ...publicUser(customer),
        createdAt: customer.createdAt,
        projects: customer.projectCount,
        orders: customer.orderCount,
      })),
    });
  });

  router.get("/api/admin/projects", async (ctx) => {
    await requireAdmin(ctx, session);
    const projects = await repos.projects.listSummariesAsAdmin(500);
    return json(200, { projects });
  });

  // The only surface where margin is returned, and it is behind requireAdmin.
  // The only surface where margin is returned, and it is behind requireAdmin.
  router.get("/api/admin/quotes", async (ctx) => {
    await requireAdmin(ctx, session);

    const quotes = await repos.quotes.listAsAdmin(500);
    // One lookup of every customer beats one lookup per quote: five hundred
    // quotes from twenty customers is twenty rows, not five hundred queries.
    const emails = await emailsFor(repos, quotes.map((quote) => quote.userId));

    return json(200, {
      quotes: quotes.map((quote) => ({
        ...quoteView(quote),
        margin: asMoney(quote.margin),
        ownerEmail: emails.get(quote.userId) ?? null,
      })),
    });
  });

  router.get("/api/admin/orders", async (ctx) => {
    await requireAdmin(ctx, session);

    const orders = await repos.orders.listAsAdmin(500);
    const emails = await emailsFor(repos, orders.map((order) => order.userId));
    const payments = await Promise.all(orders.map((order) => repos.payments.listForOrder(order.id)));

    return json(200, {
      orders: orders.map((order, index) => ({
        ...orderView(order),
        ownerEmail: emails.get(order.userId) ?? null,
        payments: (payments[index] ?? []).map(paymentView),
      })),
    });
  });

  router.patch("/api/admin/orders/:id", async (ctx) => {
    const admin = await requireAdmin(ctx, session);
    const order = await repos.orders.findAsAdmin(ctx.params["id"] ?? "");
    if (!order) throw new NotFoundError("order", ctx.params["id"] ?? "");

    const fulfillment = optionalString(ctx.body, "fulfillmentStatus", 40);
    const payment = optionalString(ctx.body, "paymentStatus", 40);

    if (fulfillment) {
      if (!isFulfilmentStatus(fulfillment)) {
        throw new ValidationError("fulfillmentStatus", `expected one of ${FULFILMENT_STATUSES.join(", ")}`);
      }
      // Checked against the lifecycle, not merely against the list of names.
      // Without this an order could go from `pending` straight to `shipped`,
      // skipping the approval, the production record and the quality check —
      // each of which is a promise made to a customer.
      assertFulfilmentTransition(order.fulfillmentStatus, fulfillment);

      await repos.orders.setFulfillmentStatus(order.id, fulfillment);
      await repos.orders.addEvent(order.id, `fulfilment:${fulfillment}`, `admin:${admin.id}`);
    }

    if (payment) {
      if (!isPaymentStatus(payment)) {
        throw new ValidationError("paymentStatus", `expected one of ${PAYMENT_STATUSES.join(", ")}`);
      }
      // §45: an admin marking a manual transfer received is a human decision,
      // recorded with their id. Nothing automatic ever reaches 'paid'.
      await repos.orders.setPaymentStatus(order.id, payment as never);
      await repos.orders.addEvent(order.id, `payment:${payment}`, `admin:${admin.id}`);
    }

    if (!fulfillment && !payment) {
      throw new ValidationError("status", "nothing to change");
    }

    return json(200, { order: orderView(await repos.orders.findAsAdmin(order.id) ?? order) });
  });

  /* --- Procurement --------------------------------------------------------- */

  /**
   * The procurement agent.
   *
   * Administrator-only, and that is a security decision rather than a
   * convenience one: §7 says a customer never sees a supplier name or a
   * supplier cost, and this response is made almost entirely of both. There is
   * no customer-facing variant of this route.
   *
   * The model is called once, to read the sentence. Everything after that is
   * the database — so a report with no options means no supplier in Brandora's
   * database offers the thing, and says exactly that instead of inventing one.
   */
  router.post("/api/admin/procurement/source", async (ctx) => {
    await requireAdmin(ctx, session);
    const brief = requireString(ctx.body, "brief", MAX_BRIEF_LENGTH);

    const report = await sourceFromBrief({
      repos,
      brief,
      provider: deps.strategy,
      catalogue: catalog,
      currency: deps.pricing.currency,
      ...(optionalInteger(ctx.body, "limit", 1, 5) !== undefined
        ? { limit: optionalInteger(ctx.body, "limit", 1, 5)! }
        : {}),
    });

    return json(200, { report: procurementView(report) });
  });

  /**
   * Whether the agent may place a given order itself.
   *
   * The request names a supplier, a product and a quantity — never a figure.
   * The amount is computed from the recorded offer by the same landed-cost
   * function the shortlist uses, for the same reason no other route accepts a
   * price: an authorisation decision made against a number somebody typed is
   * not an authorisation decision.
   *
   * How old that recorded price is decides `priceConfidence`, and §10 sends an
   * estimate to a human whatever the amount.
   */
  router.post("/api/admin/procurement/authorize", async (ctx) => {
    await requireAdmin(ctx, session);

    const supplierId = requireString(ctx.body, "supplierId", 60);
    const productId = requireString(ctx.body, "productId", 80);
    const quantity = requireInteger(ctx.body, "quantity", 1, 1_000_000);

    const supplier = await repos.suppliers.findById(supplierId);
    if (!supplier) throw new NotFoundError("supplier", supplierId);

    const offers = await repos.supplierOffers.listForProduct(productId, quantity);
    const offer = offers.find((candidate) => candidate.supplierId === supplierId);
    if (!offer) {
      throw new ValidationError(
        "productId",
        "this supplier has no recorded offer for that product at that quantity",
      );
    }

    const cost = landedCost({
      offer: {
        supplierId: offer.supplierId,
        productId: offer.productId,
        fromQuantity: offer.fromQuantity,
        unitCost: offer.unitCost,
        customizationCost: offer.customizationCost,
        setupCost: offer.setupCost,
        minimumOrder: offer.minimumOrder,
        availableQuantity: offer.availableQuantity,
        ...(offer.productionDays !== undefined ? { productionDays: offer.productionDays } : {}),
        ...(offer.shippingCost ? { shippingCost: offer.shippingCost } : {}),
        customization: offer.customization,
        lastCheckedAt: offer.lastCheckedAt,
      },
      quantity,
    });

    const signals = riskSignals({ supplier: toSupplierFacts(supplier) });
    const limit = autoApprovalLimit(deps.env ?? process.env, deps.pricing.currency);

    const decision = authorizeOrder({
      total: cost.total,
      limit,
      // A supplier carrying any recorded signal is not "low risk" because the
      // amount happens to be small.
      risk: signals.length === 0 ? "low" : signals.length > 1 ? "high" : "medium",
      priceConfidence: priceConfidenceOf(offer.lastCheckedAt, cost.unknowns, now()),
      ...(ctx.body["sampleApproved"] === true ? { sampleApproved: true } : {}),
      newSupplier: supplier.completedOrders === 0,
    });

    return json(200, {
      decision,
      cost: { perUnit: asMoney(cost.perUnit), total: asMoney(cost.total), unknowns: cost.unknowns },
      limit: asMoney(limit),
      risk: { signals },
    });
  });

  /* --- Suppliers ----------------------------------------------------------- */

  router.get("/api/admin/suppliers", async (ctx) => {
    await requireAdmin(ctx, session);
    const status = ctx.query.get("status") ?? "";
    const category = ctx.query.get("category") ?? "";
    const suppliers = await repos.suppliers.list({
      ...(status && isSupplierStatus(status) ? { status } : {}),
      ...(category ? { category } : {}),
      limit: 200,
    });
    return json(200, { suppliers: suppliers.map(supplierView) });
  });

  router.post("/api/admin/suppliers", async (ctx) => {
    await requireAdmin(ctx, session);
    const supplier = await repos.suppliers.create(readSupplierInput(ctx.body, true));
    return json(201, { supplier: supplierView(supplier) });
  });

  router.get("/api/admin/suppliers/:id", async (ctx) => {
    await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    const supplier = await repos.suppliers.findById(id);
    if (!supplier) throw new NotFoundError("supplier", id);
    return json(200, {
      supplier: supplierView(supplier),
      offers: (await repos.supplierOffers.listForSupplier(id)).map(offerView),
      risk: riskSignals({ supplier: toSupplierFacts(supplier) }),
    });
  });

  router.patch("/api/admin/suppliers/:id", async (ctx) => {
    await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    const updated = await repos.suppliers.update(id, readSupplierInput(ctx.body, false));
    if (!updated) throw new NotFoundError("supplier", id);
    return json(200, { supplier: supplierView(updated) });
  });

  /**
   * Mark a supplier as checked.
   *
   * Recorded against the administrator who did it, because "verified" with no
   * name behind it is a checkbox rather than a fact — and the authorisation
   * rule reads this status to decide whether a sample is required first.
   */
  router.post("/api/admin/suppliers/:id/verify", async (ctx) => {
    const admin = await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    const supplier = await repos.suppliers.findById(id);
    if (!supplier) throw new NotFoundError("supplier", id);

    await repos.suppliers.markVerified(id);
    const note = optionalString(ctx.body, "notes", 500);
    await repos.suppliers.update(id, {
      notes: note ? `${supplier.notes ? `${supplier.notes}\n` : ""}verified by ${admin.id}: ${note}` : supplier.notes,
    });

    return json(200, { supplier: supplierView((await repos.suppliers.findById(id))!) });
  });

  router.delete("/api/admin/suppliers/:id", async (ctx) => {
    await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    if (!(await repos.suppliers.findById(id))) throw new NotFoundError("supplier", id);
    await repos.suppliers.remove(id);
    return json(200, { deleted: id });
  });

  /**
   * Record what a supplier quoted for a product, at a quantity break.
   *
   * Every cost is an integer in the deployment's currency and comes from this
   * route, never from a customer request — the same rule as pricing. A price
   * recorded here is what the shortlist compares; a price nobody recorded is
   * an offer that does not exist.
   */
  router.post("/api/admin/suppliers/:id/offers", async (ctx) => {
    await requireAdmin(ctx, session);
    const supplierId = ctx.params["id"] ?? "";
    if (!(await repos.suppliers.findById(supplierId))) throw new NotFoundError("supplier", supplierId);

    const productId = requireString(ctx.body, "productId", 80);
    if (!byId.has(productId)) throw new ValidationError("productId", "is not a Brandora product");

    const offer = await repos.supplierOffers.save({
      supplierId,
      productId,
      unitCost: requireInteger(ctx.body, "unitCost", 1, 1_000_000_000),
      currency: deps.pricing.currency,
      ...optionalIntegers(ctx.body, {
        fromQuantity: [1, 1_000_000],
        customizationCost: [0, 1_000_000_000],
        setupCost: [0, 1_000_000_000],
        minimumOrder: [1, 1_000_000],
        availableQuantity: [0, 100_000_000],
        productionDays: [1, 365],
        shippingCost: [0, 1_000_000_000],
      }),
      ...(readStringArray(ctx.body, "customization") ? { customization: readStringArray(ctx.body, "customization")! } : {}),
      ...(optionalString(ctx.body, "externalProductId", 200)
        ? { externalProductId: optionalString(ctx.body, "externalProductId", 200)! }
        : {}),
      ...(optionalString(ctx.body, "externalProductUrl", 500)
        ? { externalProductUrl: optionalString(ctx.body, "externalProductUrl", 500)! }
        : {}),
    });

    return json(201, { offer: offerView(offer) });
  });

  router.delete("/api/admin/offers/:id", async (ctx) => {
    await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    if (!(await repos.supplierOffers.findById(id))) throw new NotFoundError("offer", id);
    await repos.supplierOffers.remove(id);
    return json(200, { deleted: id });
  });

  /* --- Quality and shipping ------------------------------------------------- */

  router.get("/api/admin/orders/:id/quality-checks", async (ctx) => {
    await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    if (!(await repos.orders.findAsAdmin(id))) throw new NotFoundError("order", id);
    return json(200, { checks: (await repos.qualityChecks.listForOrder(id)).map(qualityView) });
  });

  router.post("/api/admin/orders/:id/quality-checks", async (ctx) => {
    const admin = await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    if (!(await repos.orders.findAsAdmin(id))) throw new NotFoundError("order", id);

    const kind = requireString(ctx.body, "kind", 20);
    if (kind !== "sample" && kind !== "production" && kind !== "pre-shipment") {
      throw new ValidationError("kind", "expected one of sample, production, pre-shipment");
    }

    // Opened, not carried out. `inspectedAt` stays null until an outcome is
    // recorded, so the two facts never collapse into one.
    const check = await repos.qualityChecks.create({ orderId: id, kind, inspectedBy: admin.id });
    await repos.orders.addEvent(id, `quality-check:${kind}:opened`, `admin:${admin.id}`);
    return json(201, { check: qualityView(check) });
  });

  router.patch("/api/admin/quality-checks/:id", async (ctx) => {
    const admin = await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    const existing = await repos.qualityChecks.findById(id);
    if (!existing) throw new NotFoundError("quality check", id);

    const outcome = requireString(ctx.body, "outcome", 30);
    if (!["pending", "passed", "failed", "passed-with-notes"].includes(outcome)) {
      throw new ValidationError("outcome", "expected one of pending, passed, failed, passed-with-notes");
    }

    const updated = await repos.qualityChecks.recordOutcome(id, {
      outcome: outcome as never,
      ...(readStringArray(ctx.body, "defects") ? { defects: readStringArray(ctx.body, "defects")! } : {}),
      ...(readStringArray(ctx.body, "evidence") ? { evidence: readStringArray(ctx.body, "evidence")! } : {}),
      ...(optionalString(ctx.body, "notes", 2_000) ? { notes: optionalString(ctx.body, "notes", 2_000)! } : {}),
    });

    await repos.orders.addEvent(existing.orderId, `quality-check:${existing.kind}:${outcome}`, `admin:${admin.id}`);
    return json(200, { check: qualityView(updated!) });
  });

  router.get("/api/admin/orders/:id/shipments", async (ctx) => {
    await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    if (!(await repos.orders.findAsAdmin(id))) throw new NotFoundError("order", id);
    return json(200, { shipments: (await repos.shipments.listForOrder(id)).map(shipmentView) });
  });

  router.post("/api/admin/orders/:id/shipments", async (ctx) => {
    const admin = await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    if (!(await repos.orders.findAsAdmin(id))) throw new NotFoundError("order", id);

    const shipment = await repos.shipments.create({ orderId: id, ...readShipmentInput(ctx.body) });
    await repos.orders.addEvent(id, "shipment:created", `admin:${admin.id}`, shipment.trackingNumber ?? "");
    return json(201, { shipment: shipmentView(shipment) });
  });

  router.patch("/api/admin/shipments/:id", async (ctx) => {
    const admin = await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    const existing = await repos.shipments.findById(id);
    if (!existing) throw new NotFoundError("shipment", id);

    const updated = await repos.shipments.update(id, readShipmentInput(ctx.body));
    await repos.orders.addEvent(
      existing.orderId,
      `shipment:${updated?.status ?? existing.status}`,
      `admin:${admin.id}`,
      updated?.trackingNumber ?? "",
    );

    // The customer is told when it actually moves, and told the number the
    // carrier gave — never a date nobody quoted.
    if (updated && updated.status !== existing.status) {
      const target = await repos.orders.notificationTarget(existing.orderId);
      if (target) {
        await notify(target.userId, existing.orderId, `shipment.${updated.status}`, {
          subject: `Order ${target.reference} — ${updated.status.replace(/-/g, " ")}`,
          body: [
            `Your order ${target.reference} is now ${updated.status.replace(/-/g, " ")}.`,
            updated.carrier ? `Carrier: ${updated.carrier}` : "",
            updated.trackingNumber ? `Tracking number: ${updated.trackingNumber}` : "",
            updated.estimatedDelivery ? `The carrier estimates delivery on ${updated.estimatedDelivery}.` : "",
            EMAIL_SIGNATURE,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }
    }

    return json(200, { shipment: shipmentView(updated!) });
  });

  router.get("/api/admin/testimonials", async (ctx) => {
    await requireAdmin(ctx, session);
    return json(200, { testimonials: (await repos.testimonials.listAsAdmin()).map(adminTestimonialView) });
  });

  router.post("/api/admin/testimonials", async (ctx) => {
    await requireAdmin(ctx, session);
    const created = await repos.testimonials.create({
      quote: requireString(ctx.body, "quote", 800),
      authorName: requireString(ctx.body, "authorName", 160),
      ...(optionalString(ctx.body, "authorRole", 160) ? { authorRole: optionalString(ctx.body, "authorRole", 160)! } : {}),
      ...(optionalString(ctx.body, "company", 160) ? { company: optionalString(ctx.body, "company", 160)! } : {}),
      ...(optionalString(ctx.body, "country", 2) ? { country: optionalString(ctx.body, "country", 2)!.toUpperCase() } : {}),
      ...(optionalString(ctx.body, "consentAt", 40) ? { consentAt: optionalString(ctx.body, "consentAt", 40)! } : {}),
      ...(optionalInteger(ctx.body, "position", 0, 999) !== undefined
        ? { position: optionalInteger(ctx.body, "position", 0, 999)! }
        : {}),
    });
    return json(201, { testimonial: adminTestimonialView(created) });
  });

  /**
   * Publish or unpublish a quote.
   *
   * Publishing requires a recorded consent date. A quote is somebody's words
   * with their name attached, and putting it on a marketing page without a
   * record that they agreed is the kind of thing that is only noticed when it
   * becomes a problem.
   */
  router.patch("/api/admin/testimonials/:id", async (ctx) => {
    await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    const existing = await repos.testimonials.findById(id);
    if (!existing) throw new NotFoundError("testimonial", id);

    const approved = ctx.body["approved"] === true;
    if (approved && !existing.consentAt) {
      throw new ValidationError(
        "approved",
        "cannot publish a quote with no recorded consent date — record when the person agreed to be quoted",
      );
    }

    await repos.testimonials.setApproved(id, approved);
    return json(200, { testimonial: adminTestimonialView((await repos.testimonials.findById(id))!) });
  });

  router.delete("/api/admin/testimonials/:id", async (ctx) => {
    await requireAdmin(ctx, session);
    const id = ctx.params["id"] ?? "";
    if (!(await repos.testimonials.findById(id))) throw new NotFoundError("testimonial", id);
    await repos.testimonials.remove(id);
    return json(200, { deleted: id });
  });

  router.get("/api/admin/subscribers", async (ctx) => {
    await requireAdmin(ctx, session);
    return json(200, {
      count: await repos.subscribers.count(),
      subscribers: await repos.subscribers.listAsAdmin(500),
    });
  });

  /* --- Pricing policy ---------------------------------------------------- */

  /**
   * The margins and minimums, as an administrator sees them.
   *
   * Admin-only, because a target margin is what Brandora keeps and a customer
   * who can read it can negotiate against it.
   */
  router.get("/api/admin/pricing", async (ctx) => {
    await requireAdmin(ctx, session);
    const stored = await repos.pricingPolicy.read();
    return json(200, {
      policy: stored ?? policyToRow(defaultPolicy(deps.pricing.currency)),
      // So the screen can say "these are the starting values, not yours yet".
      isDefault: stored === null,
    });
  });

  router.put("/api/admin/pricing", async (ctx) => {
    const admin = await requireAdmin(ctx, session);
    const body = ctx.body;

    const rate = (key: string, max = 1): number => {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0 || value > max) {
        throw new ValidationError(key, `must be a rate between 0 and ${max}`);
      }
      return value;
    };
    const amount = (key: string): number => {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0) throw new ValidationError(key, "must be zero or more");
      return Math.floor(value);
    };

    const rawBands = Array.isArray(body["bands"]) ? body["bands"] : [];
    if (rawBands.length === 0) throw new ValidationError("bands", "at least one margin band is required");

    const bands = rawBands.map((entry, index) => {
      const record = entry as Record<string, unknown>;
      const margin = Number(record["targetMargin"]);
      if (!Number.isFinite(margin) || margin < 0 || margin >= 1) {
        throw new ValidationError(`bands[${index}].targetMargin`, "must be between 0 and 1");
      }
      const ceiling = record["upToCost"];
      return {
        // null is the open-ended top band, and must survive as null rather than
        // becoming 0 — which would make it match nothing.
        upToCost: ceiling === null || ceiling === undefined ? null : Math.floor(Number(ceiling)),
        targetMargin: margin,
        label: String(record["label"] ?? `band ${index + 1}`).slice(0, 60),
      };
    });

    // Sorted here rather than trusted from the form: `bandFor` walks the list
    // in order and returns the first ceiling the cost fits under, so an
    // out-of-order table would quietly price large orders at the small rate.
    bands.sort((a, b) => (a.upToCost === null ? 1 : b.upToCost === null ? -1 : a.upToCost - b.upToCost));

    const repeatRaw = body["repeatCustomerMargin"];
    const policy = {
      currency: deps.pricing.currency,
      bands,
      ...(repeatRaw === null || repeatRaw === undefined
        ? {}
        : { repeatCustomerMargin: rate("repeatCustomerMargin", 0.99) }),
      minimumMargin: rate("minimumMargin", 0.99),
      minimumOrderValue: amount("minimumOrderValue"),
      minimumGrossProfit: amount("minimumGrossProfit"),
      contingencyRate: rate("contingencyRate", 0.5),
      paymentFeeRate: rate("paymentFeeRate", 0.5),
      roundingStep: amount("roundingStep"),
      sampleCreditedToProduction: body["sampleCreditedToProduction"] === true,
    };

    // Refuse a policy that cannot price anything, before it is stored rather
    // than when the next customer asks for a quote.
    for (const band of bands) {
      if (band.targetMargin + policy.paymentFeeRate >= 1) {
        throw new ValidationError(
          "bands",
          `band "${band.label}" at ${band.targetMargin} plus a ${policy.paymentFeeRate} payment fee leaves nothing to price against`,
        );
      }
    }

    await repos.pricingPolicy.save(policy, admin.id);
    deps.logger.error(`pricing policy updated by ${admin.id}`);
    return json(200, { policy, isDefault: false });
  });

  router.get("/api/admin/integrations", async (ctx) => {
    await requireAdmin(ctx, session);
    // Masks only. There is no variant of this route that returns a value.
    return json(200, {
      integrations: [
        aliexpressIntegrationStatus(deps.env ?? process.env),
        paystackIntegrationStatus(deps.env ?? process.env),
        notificationsIntegrationStatus(deps.env ?? process.env),
      ],
    });
  });

  /**
   * The notification queue, and what actually happened to each row.
   *
   * `sent` here means a provider accepted the message. Nothing on this route
   * counts a row as delivered because the code path that created it completed.
   */
  router.get("/api/admin/notifications", async (ctx) => {
    await requireAdmin(ctx, session);
    const pending = await repos.notifications.pending(100);
    return json(200, {
      transport: { name: transport.name, configured: transport.configured },
      pending: pending.map(notificationView),
    });
  });

  /**
   * Drain the queue by hand.
   *
   * Delivery is attempted inline when an event happens, so this is for the
   * cases that leaves behind: a provider that was down, a key added after the
   * fact, a run of rows that failed once and are waiting for a retry.
   */
  router.post("/api/admin/notifications/deliver", async (ctx) => {
    await requireAdmin(ctx, session);
    const report = await deliverPending(repos, transport, { limit: 50 });
    return json(200, { report });
  });

  /* --- Guard rails --------------------------------------------------------- */

  // Anything under /api that no route claimed is a 404 in JSON, not the static
  // fallback's index.html — an HTML body arriving where JSON was expected sends
  // whoever is debugging in entirely the wrong direction.
  router.get("/api/:rest", async () => json(404, { error: "not-found", message: "No such endpoint." }));

  return router;
}

/* --- Shared shapes --------------------------------------------------------- */

/** Never includes `margin` — the type it accepts may carry it; this does not. */
function quoteView(quote: {
  id: string;
  projectId: string;
  reference: string;
  currency: string;
  lineItems: { productId: string; description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: { amount: number; currency: string };
  shipping: { amount: number; currency: string };
  fees: { amount: number; currency: string };
  total: { amount: number; currency: string };
  status: string;
  validUntil: string;
  createdAt: string;
}) {
  return {
    id: quote.id,
    projectId: quote.projectId,
    reference: quote.reference,
    currency: quote.currency,
    lines: quote.lineItems.map((line) => ({
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: asMoney(money(line.unitPrice, quote.currency as never)),
      total: asMoney(money(line.total, quote.currency as never)),
    })),
    subtotal: asMoney(quote.subtotal),
    shipping: asMoney(quote.shipping),
    fees: asMoney(quote.fees),
    total: asMoney(quote.total),
    status: quote.status,
    validUntil: quote.validUntil,
    createdAt: quote.createdAt,
    // §38: shown as "unavailable" rather than filled with a plausible number.
    deliveryEstimate: null,
  };
}

function orderView(order: {
  id: string;
  projectId: string;
  quoteId: string;
  reference: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  total: { amount: number; currency: string };
  currency: string;
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: order.id,
    projectId: order.projectId,
    quoteId: order.quoteId,
    reference: order.reference,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    total: asMoney(order.total),
    currency: order.currency,
    trackingNumber: order.trackingNumber ?? null,
    carrier: order.carrier ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function paymentView(payment: {
  reference: string;
  provider: string;
  amount: { amount: number; currency: string };
  status: string;
  verifiedAt?: string;
  createdAt: string;
}) {
  return {
    reference: payment.reference,
    provider: payment.provider,
    amount: asMoney(payment.amount),
    status: payment.status,
    verifiedAt: payment.verifiedAt ?? null,
    createdAt: payment.createdAt,
  };
}

/**
 * A testimonial as a visitor reads it.
 *
 * No id, no consent date, no approval flag — those are operational facts about
 * the row, and a public response has no use for them.
 */
const testimonialView = (t: TestimonialRow) => ({
  quote: t.quote,
  authorName: t.authorName,
  authorRole: t.authorRole ?? null,
  company: t.company ?? null,
  country: t.country ?? null,
});

/** The same row for the administrator who has to manage it. */
const adminTestimonialView = (t: TestimonialRow) => ({
  ...testimonialView(t),
  id: t.id,
  locale: t.locale,
  approved: t.approved,
  consentAt: t.consentAt ?? null,
  position: t.position,
  createdAt: t.createdAt,
});

/* --- Procurement shapes ---------------------------------------------------- */

const SUPPLIER_STATUSES = ["active", "paused", "blocked", "unverified"] as const;
const isSupplierStatus = (value: string): value is (typeof SUPPLIER_STATUSES)[number] =>
  (SUPPLIER_STATUSES as readonly string[]).includes(value);

/**
 * How much the agent may commit without a person.
 *
 * §10 names a threshold and this is where it lives — one environment variable,
 * read in the deployment's own currency. Defaulted low rather than high: an
 * unconfigured deployment should escalate too often, not spend too much.
 */
function autoApprovalLimit(source: Record<string, string | undefined>, currency: CurrencyCode): Money {
  const raw = Number.parseInt((source["BRANDORA_AUTO_APPROVAL_LIMIT"] ?? "").trim(), 10);
  return money(Number.isFinite(raw) && raw > 0 ? raw : 0, currency);
}

/** How long a recorded supplier price is treated as current. */
const PRICE_FRESH_DAYS = 30;

/**
 * How much to trust a recorded price.
 *
 * `confirmed` only when a supplier's quote was re-checked inside the window
 * *and* every component of the landed cost could actually be calculated. A
 * total with an unknown in it is an estimate however recently it was quoted,
 * and §10 sends an estimate to a person.
 */
function priceConfidenceOf(lastCheckedAt: string, unknowns: readonly string[], at: Date): PriceConfidence {
  if (unknowns.length > 0) return "estimated";
  const checked = Date.parse(lastCheckedAt);
  if (!Number.isFinite(checked)) return "needs-confirmation";
  const days = (at.getTime() - checked) / 86_400_000;
  return days <= PRICE_FRESH_DAYS ? "confirmed" : "needs-confirmation";
}

/** A decimal within bounds, or nothing. Used for coordinates. */
function optionalNumber(
  body: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number | undefined {
  const raw = body[field];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < min || raw > max) {
    throw new ValidationError(field, `expected a number between ${min} and ${max}`);
  }
  return raw;
}

function optionalInteger(
  body: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number | undefined {
  const raw = body[field];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new ValidationError(field, `expected a whole number between ${min} and ${max}`);
  }
  return raw;
}

/** Several optional integers at once, each with its own bounds. */
function optionalIntegers<K extends string>(
  body: Record<string, unknown>,
  fields: Record<K, [number, number]>,
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const [field, bounds] of Object.entries(fields) as [K, [number, number]][]) {
    const value = optionalInteger(body, field, bounds[0], bounds[1]);
    if (value !== undefined) out[field] = value;
  }
  return out;
}

function readStringArray(body: Record<string, unknown>, field: string): string[] | undefined {
  const raw = body[field];
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new ValidationError(field, "expected a list of strings");
  return raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().slice(0, 200))
    .filter((entry) => entry !== "")
    .slice(0, 40);
}

/**
 * A supplier, read off an admin request.
 *
 * `required` distinguishes a create from a patch: on a patch an absent field is
 * left alone, so a form that posts only the status cannot blank a supplier's
 * contact details.
 */
function readSupplierInput(body: Record<string, unknown>, required: true): SupplierInput;
function readSupplierInput(body: Record<string, unknown>, required: false): Partial<SupplierInput>;
function readSupplierInput(body: Record<string, unknown>, required: boolean): Partial<SupplierInput> {
  const status = optionalString(body, "status", 20);
  if (status !== undefined && !isSupplierStatus(status)) {
    throw new ValidationError("status", `expected one of ${SUPPLIER_STATUSES.join(", ")}`);
  }

  const text = (field: string, max: number) => optionalString(body, field, max);
  const input: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) input[key] = value;
  };

  if (required) {
    input["name"] = requireString(body, "name", 200);
    input["platform"] = requireString(body, "platform", 60);
  } else {
    set("name", text("name", 200));
    set("platform", text("platform", 60));
  }

  set("externalId", text("externalId", 200));
  set("externalUrl", text("externalUrl", 500));
  set("country", text("country", 2));
  set("city", text("city", 120));
  // Coordinates, so the network map can plot this supplier. Bounded to real
  // latitudes and longitudes; anything else is not a place.
  set("latitude", optionalNumber(body, "latitude", -90, 90));
  set("longitude", optionalNumber(body, "longitude", -180, 180));
  set("contactName", text("contactName", 200));
  set("contactEmail", text("contactEmail", 320));
  set("contactPhone", text("contactPhone", 40));
  set("categories", readStringArray(body, "categories"));
  set("certifications", readStringArray(body, "certifications"));
  set("customization", readStringArray(body, "customization"));
  set("minimumOrder", optionalInteger(body, "minimumOrder", 1, 1_000_000));
  set("leadTimeDays", optionalInteger(body, "leadTimeDays", 1, 365));
  set("status", status);
  set("riskFlag", text("riskFlag", 200));
  set("notes", text("notes", 2_000));

  return input as Partial<SupplierInput>;
}

function readShipmentInput(body: Record<string, unknown>): Omit<ShipmentInput, "orderId"> {
  const status = optionalString(body, "status", 30);
  const allowed = ["preparing", "shipped", "in-transit", "customs", "out-for-delivery", "delivered", "exception"];
  if (status !== undefined && !allowed.includes(status)) {
    throw new ValidationError("status", `expected one of ${allowed.join(", ")}`);
  }

  const input: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) input[key] = value;
  };

  set("carrier", optionalString(body, "carrier", 120));
  set("trackingNumber", optionalString(body, "trackingNumber", 120));
  set("trackingUrl", optionalString(body, "trackingUrl", 500));
  set("status", status);
  // §38: only ever a date a carrier gave. There is no branch of this function
  // that computes one from a lead time.
  set("estimatedDelivery", optionalString(body, "estimatedDelivery", 40));
  set("actualDelivery", optionalString(body, "actualDelivery", 40));
  set("exceptionNote", optionalString(body, "exceptionNote", 500));

  return input as Omit<ShipmentInput, "orderId">;
}

/** A supplier as an administrator reads it. Counts, never a rating. */
const supplierView = (supplier: SupplierRow) => ({
  id: supplier.id,
  name: supplier.name,
  platform: supplier.platform,
  externalUrl: supplier.externalUrl ?? null,
  country: supplier.country ?? null,
  city: supplier.city ?? null,
  latitude: supplier.latitude ?? null,
  longitude: supplier.longitude ?? null,
  contact: {
    name: supplier.contactName ?? null,
    email: supplier.contactEmail ?? null,
    phone: supplier.contactPhone ?? null,
  },
  categories: supplier.categories,
  certifications: supplier.certifications,
  customization: supplier.customization,
  minimumOrder: supplier.minimumOrder,
  leadTimeDays: supplier.leadTimeDays ?? null,
  status: supplier.status,
  riskFlag: supplier.riskFlag ?? null,
  // What happened, so a score can be recomputed rather than trusted.
  record: {
    completedOrders: supplier.completedOrders,
    lateOrders: supplier.lateOrders,
    defectReports: supplier.defectReports,
    disputes: supplier.disputes,
  },
  verifiedAt: supplier.verifiedAt ?? null,
  notes: supplier.notes ?? null,
  createdAt: supplier.createdAt,
});

const offerView = (offer: SupplierOfferRow) => ({
  id: offer.id,
  supplierId: offer.supplierId,
  productId: offer.productId,
  fromQuantity: offer.fromQuantity,
  unitCost: asMoney(offer.unitCost),
  customizationCost: asMoney(offer.customizationCost),
  setupCost: asMoney(offer.setupCost),
  shippingCost: offer.shippingCost ? asMoney(offer.shippingCost) : null,
  minimumOrder: offer.minimumOrder,
  availableQuantity: offer.availableQuantity,
  productionDays: offer.productionDays ?? null,
  customization: offer.customization,
  externalProductUrl: offer.externalProductUrl ?? null,
  // How old the price is. A shortlist built on a year-old quote is a guess.
  lastCheckedAt: offer.lastCheckedAt,
});

const qualityView = (check: QualityCheckRow) => ({
  id: check.id,
  orderId: check.orderId,
  kind: check.kind,
  outcome: check.outcome,
  inspectedBy: check.inspectedBy,
  defects: check.defects,
  evidence: check.evidence,
  notes: check.notes ?? null,
  // Null until somebody actually looked.
  inspectedAt: check.inspectedAt ?? null,
  createdAt: check.createdAt,
});

const shipmentView = (shipment: ShipmentRow) => ({
  id: shipment.id,
  orderId: shipment.orderId,
  carrier: shipment.carrier ?? null,
  trackingNumber: shipment.trackingNumber ?? null,
  trackingUrl: shipment.trackingUrl ?? null,
  status: shipment.status,
  // Null means not quoted. It never means soon.
  estimatedDelivery: shipment.estimatedDelivery ?? null,
  actualDelivery: shipment.actualDelivery ?? null,
  exceptionNote: shipment.exceptionNote ?? null,
  createdAt: shipment.createdAt,
});

/**
 * The procurement report, on the wire.
 *
 * Money is formatted here and nowhere else, by the same helper every other
 * amount goes through — the browser must never divide by 100 to make a franc.
 */
const procurementView = (report: ProcurementReport) => ({
  understood: {
    ...report.understood,
    targetUnitPrice: report.understood.targetUnitPrice ? asMoney(report.understood.targetUnitPrice) : null,
    maxBudget: report.understood.maxBudget ? asMoney(report.understood.maxBudget) : null,
  },
  missing: report.missing,
  considered: report.considered,
  options: report.options.map((option) => ({
    ...option,
    unitCost: asMoney(option.unitCost),
    landedPerUnit: asMoney(option.landedPerUnit),
    landedTotal: asMoney(option.landedTotal),
  })),
  recommendation: report.recommendation,
  costOfRecommendation: report.costOfRecommendation,
  nextStep: report.nextStep,
  notes: report.notes,
});

/**
 * A queued notification, for the admin queue view.
 *
 * `body` is deliberately absent: this is a list of what is waiting, and the
 * message to a customer can carry their order details. `attempts` and
 * `lastError` are what an administrator actually needs to see.
 */
function notificationView(notification: {
  id: string;
  kind: string;
  channel: string;
  subject: string;
  status: string;
  attempts: number;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
}) {
  return {
    id: notification.id,
    kind: notification.kind,
    channel: notification.channel,
    subject: notification.subject,
    status: notification.status,
    attempts: notification.attempts,
    lastError: notification.lastError ?? null,
    sentAt: notification.sentAt ?? null,
    createdAt: notification.createdAt,
  };
}

function identityView(profile: { palette: unknown; typography: unknown; logoBrief: string }) {
  return { palette: profile.palette, typography: profile.typography, logoBrief: profile.logoBrief };
}

/**
 * Look up the distinct owners of a list of rows.
 *
 * `findById` per row is the shape that turns a fast admin page into a slow one
 * the week the business gets busy, and it is invisible until then.
 */
async function emailsFor(repos: Repositories, userIds: readonly string[]): Promise<Map<string, string>> {
  const distinct = [...new Set(userIds)];
  const users = await Promise.all(distinct.map((id) => repos.users.findById(id)));
  return new Map(users.filter((user) => user !== null).map((user) => [user.id, user.email]));
}

/** Where "Resume" should land. One definition, so every surface agrees. */
function nextStepFor(status: string, hasStrategy: boolean, packageItems: number): string {
  if (!hasStrategy) return status === "draft" ? "interview" : "generate";
  if (packageItems === 0) return "products";
  return "quote";
}

/* --- Reading an interview off an untrusted body ---------------------------- */

function readAnswers(source: Record<string, unknown> | unknown): InterviewAnswer[] {
  const container = (source ?? {}) as Record<string, unknown>;
  const raw = requireArray(container, "answers", 40);

  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ValidationError(`answers[${index}]`, "must be an object");
    }
    const record = entry as Record<string, unknown>;
    const field = record["field"];
    if (typeof field !== "string") throw new ValidationError(`answers[${index}].field`, "is required");

    const value = record["value"];
    if (Array.isArray(value)) {
      const values = value.filter((v): v is string => typeof v === "string").slice(0, 20);
      return { field: field as never, value: values, inferred: record["inferred"] === true };
    }
    if (typeof value !== "string") {
      throw new ValidationError(`answers[${index}].value`, "must be text or a list of text");
    }
    if (value.length > 2_000) {
      throw new ValidationError(`answers[${index}].value`, "must be at most 2000 characters");
    }
    return { field: field as never, value, inferred: record["inferred"] === true };
  });
}

/** Whether the answers satisfy the engine, without throwing on a partial save. */
function isComplete(answers: readonly InterviewAnswer[]): boolean {
  try {
    buildBrief(answers);
    return true;
  } catch {
    return false;
  }
}

/* --- References ------------------------------------------------------------ */

/**
 * Insert with a readable reference, retrying past a collision.
 *
 * The sequence is advisory; the UNIQUE index is authoritative. Two customers
 * checking out in the same millisecond both compute the same number, and the
 * loser retries rather than failing.
 */
async function insertQuoteWithUniqueReference(
  repos: Repositories,
  at: Date,
  input: Omit<Parameters<Repositories["quotes"]["create"]>[0], "reference">,
) {
  const prefix = `BRA-${at.getUTCFullYear()}-`;
  let sequence = await repos.quotes.nextSequence(prefix);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await repos.quotes.create({ ...input, reference: quoteReference(at, sequence) });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      sequence += 1;
    }
  }
  throw new ValidationError("reference", "could not allocate a quote reference");
}

async function insertOrderWithUniqueReference(
  repos: Repositories,
  at: Date,
  input: Omit<Parameters<Repositories["orders"]["create"]>[0], "reference">,
) {
  const prefix = `ORD-${at.getUTCFullYear()}-`;
  let sequence = await repos.orders.nextSequence(prefix);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await repos.orders.create({
        ...input,
        reference: `${prefix}${String(sequence).padStart(4, "0")}`,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      sequence += 1;
    }
  }
  throw new ValidationError("reference", "could not allocate an order reference");
}

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
