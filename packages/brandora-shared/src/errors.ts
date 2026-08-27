/**
 * Errors, and the wall between what a customer sees and what an admin sees.
 *
 * Spec §73 is blunt about this: a customer must never be shown
 * "AliExpress error 403928…". They are shown a sentence they can act on; the
 * technical detail is kept on the error object for the admin view and the logs.
 *
 * The second job of this file is making sure a credential can never ride out
 * inside an error message. Supplier APIs habitually echo the request — including
 * the signed query string — back in their failure bodies, so anything that has
 * touched a supplier response goes through `redact()` before it is logged.
 */

/** Message keys, resolved through @brandora/i18n so errors translate too (§23). */
export const CUSTOMER_MESSAGES = {
  "sourcing.unavailable": "We couldn't retrieve this product right now. Please try another option.",
  "sourcing.no-results": "We couldn't find a match for that yet. Try a different quantity or style.",
  "freight.unavailable": "Delivery estimate unavailable",
  "brand.generation-failed": "We couldn't finish your brand just now. Your answers are saved — try again.",
  // The next four are *sequencing* messages, and they exist because the
  // alternative was worse. These conditions used to raise a ValidationError,
  // which resolves to "Something in that form didn't look right" — told to
  // someone whose form was perfectly fine and who is simply one step earlier in
  // the journey than the request assumed. An error that misdescribes the
  // problem sends people to re-check work that was never wrong.
  "brand.interview-incomplete": "Answer the remaining questions first, then we can build your brand.",
  "brand.not-generated": "Build your brand first — this works from what it says.",
  "package.empty": "Add at least one product before asking for a quote.",
  "payment.not-started": "No payment has been started for this order yet.",
  "quote.expired": "This quote has expired. We can prepare a fresh one for you.",
  "order.not-found": "We couldn't find that order.",
  // NotFoundError covers brands, quotes, suppliers and products as well as
  // orders, and it answered "We couldn't find that order." for all of them —
  // so someone opening a brand link that is not theirs was told about an order
  // they had never placed. Deliberately vague about *what* was not found:
  // saying "that brand does not exist" to someone probing ids confirms which
  // ids do, which is the whole reason these are 404 and not 403.
  "not-found": "We couldn't find that.",
  "auth.required": "Please sign in to continue.",
  // Deliberately identical for "no such account" and "wrong password": a
  // message that distinguishes them tells an attacker which addresses have
  // accounts. The route already burns matching time for the same reason.
  "auth.invalid": "That email address or password is not right.",
  "auth.weak-password": "Please choose a longer password — at least 10 characters.",
  "auth.forbidden": "You don't have access to this.",
  // Deliberately identical for missing, expired and already-used — the same
  // enumeration reasoning as auth.invalid above: distinguishing them tells
  // whoever is holding a dead link something about a token they should not
  // be able to probe.
  "auth.reset-invalid": "This reset link is invalid or has expired. Request a new one.",
  "auth.email-taken": "That email address is already in use by another account.",
  "input.invalid": "Something in that form didn't look right. Please check and try again.",
  "rate.limited": "That's a lot of requests. Please wait a moment and try again.",
  "internal": "Something went wrong on our side. We're on it.",
  "storage.not-configured": "Image storage isn't set up yet. The product was saved without this photo.",
  "storage.upload-failed": "Unable to upload image. Please check the file type and size, then try again.",
  "storage.delete-failed": "Unable to remove that image right now. Please try again.",
} as const;

export type CustomerMessageKey = keyof typeof CUSTOMER_MESSAGES;

export class BrandoraError extends Error {
  readonly customerMessageKey: CustomerMessageKey;
  readonly status: number;
  /** Admin-only. Never serialise this toward a browser. */
  readonly technicalDetail: string;
  /**
   * A one-word category of what went wrong, safe to send to anyone.
   *
   * Not the detail — `ai-auth`, not "ANTHROPIC_API_KEY is invalid". The
   * difference matters twice over. To a customer both are equally useless, so
   * nothing is lost. To the person who deployed this, "the brand generator's
   * credentials were rejected" and "the brand generator timed out" are days
   * apart in what they do next, and until now both arrived as the same
   * sentence with the reason visible only in a server log they had no idea to
   * open.
   *
   * Nothing here names a variable, a value, a host or a stack frame. What it
   * concedes to an attacker is that Brandora uses a model provider and that
   * its key is currently misconfigured — which is not something they can act
   * on, and is already obvious from the feature not working.
   */
  readonly reason: string | undefined;

  constructor(
    customerMessageKey: CustomerMessageKey,
    technicalDetail: string,
    status = 500,
    options?: { cause?: unknown; reason?: string },
  ) {
    super(CUSTOMER_MESSAGES[customerMessageKey], options);
    this.name = "BrandoraError";
    this.customerMessageKey = customerMessageKey;
    this.status = status;
    this.technicalDetail = redact(technicalDetail);
    this.reason = options?.reason;
  }

  /** Exactly what may cross the wire to a customer. */
  toCustomerJSON(): { error: CustomerMessageKey; message: string; reason?: string } {
    return {
      error: this.customerMessageKey,
      message: CUSTOMER_MESSAGES[this.customerMessageKey],
      ...(this.reason ? { reason: this.reason } : {}),
    };
  }

  /** The admin view, already redacted. */
  toAdminJSON(): { error: CustomerMessageKey; status: number; detail: string } {
    return { error: this.customerMessageKey, status: this.status, detail: this.technicalDetail };
  }
}

export class ValidationError extends BrandoraError {
  constructor(readonly field: string, detail: string) {
    super("input.invalid", `${field}: ${detail}`, 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends BrandoraError {
  constructor(kind: string, id: string) {
    // `kind` and `id` go to the technical detail, for the log and the admin
    // view. The customer sentence stays generic on purpose.
    super(kind === "order" ? "order.not-found" : "not-found", `${kind} ${id} not found`, 404);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends BrandoraError {
  constructor(detail: string) {
    super("auth.forbidden", detail, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * Strip anything credential-shaped from a string bound for a log or an admin
 * screen.
 *
 * Deliberately pattern-based rather than a list of known secrets: the module
 * that holds the real values must never be imported here, or a stack trace from
 * this file could carry them. Matching on shape catches the signed query strings
 * and bearer tokens that supplier errors echo back, including ones nobody
 * thought to register.
 */
export function redact(input: string): string {
  return input
    .replace(/\b(app_?secret|access_?token|refresh_?token|api_?key|password|sign|secret)\b(\s*[=:]\s*|%3D)"?([A-Za-z0-9._~+/-]{8,})"?/gi, "$1$2[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi, "Bearer [redacted]")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[redacted]");
}

/**
 * Normalise anything thrown into a BrandoraError.
 *
 * The catch-all deliberately does not reuse the thrown message as the customer
 * message — that is exactly how a raw supplier error reaches a customer.
 */
export function toBrandoraError(err: unknown, fallback: CustomerMessageKey = "internal"): BrandoraError {
  if (err instanceof BrandoraError) return err;
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return new BrandoraError(fallback, detail, 500, { cause: err });
}
