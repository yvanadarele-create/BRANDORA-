/**
 * The email a "Demander un devis" submission on a product page turns into.
 *
 * Kept as a pure function, deliberately separate from the route that calls
 * it (packages/brandora-server/src/routes.ts) and the transport that
 * eventually sends it (packages/brandora-server/src/notifications.ts) — the
 * question "is the payload built correctly from what the visitor typed" has
 * nothing to do with HTTP or a network call, and a pure function is the
 * cheapest, most direct way to test that it never drops a field.
 *
 * No account is required to submit this form — see the MVP simplification
 * brief's §6. Every field the request needs to be actionable therefore
 * travels with the request itself rather than being read off a session.
 */

import { ValidationError } from "@brandora/shared";

export interface QuoteRequestInput {
  productId: string;
  productName: string;
  customerName: string;
  companyName?: string;
  email: string;
  phone?: string;
  /** Required — a quote without a quantity is not a quote. */
  quantity: number;
  material?: string;
  shape?: string;
  dimensions?: string;
  customization?: string;
  destination?: string;
  message?: string;
  logoFilename?: string;
}

export interface QuoteRequestEmail {
  subject: string;
  body: string;
}

const MAX_FIELD_LENGTH = 2_000;

function clean(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length > MAX_FIELD_LENGTH) {
    throw new ValidationError(field, `must be ${MAX_FIELD_LENGTH} characters or fewer`);
  }
  return trimmed === "" ? undefined : trimmed;
}

const line = (label: string, value: string | undefined) => `${label}: ${value ?? "not specified"}`;

/**
 * Build the email — and validate the fields the email cannot make sense
 * without. `quantity` and a real customer name/email throw rather than
 * defaulting to something plausible-looking, for the same reason the rest of
 * this application never invents a fact nobody gave it.
 */
export function buildQuoteRequestEmail(input: QuoteRequestInput): QuoteRequestEmail {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new ValidationError("quantity", "must be a positive whole number");
  }

  const customerName = clean(input.customerName, "customerName");
  if (!customerName) throw new ValidationError("customerName", "is required");

  const email = clean(input.email, "email");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ValidationError("email", "does not look like an email address");
  }

  const companyName = clean(input.companyName, "companyName");
  const phone = clean(input.phone, "phone");
  const material = clean(input.material, "material");
  const shape = clean(input.shape, "shape");
  const dimensions = clean(input.dimensions, "dimensions");
  const customization = clean(input.customization, "customization");
  const destination = clean(input.destination, "destination");
  const message = clean(input.message, "message");

  const lines = [
    "NEW BRANDORA QUOTE REQUEST",
    "",
    line("Customer", customerName),
    line("Company", companyName),
    line("Email", email),
    line("Phone", phone),
    "",
    "PRODUCT",
    line("Product", input.productName),
    line("Quantity", String(input.quantity)),
    "",
    "SPECIFICATIONS",
    line("Material", material),
    line("Shape", shape),
    line("Dimensions", dimensions),
    line("Customization", customization),
    "",
    line("Destination", destination),
    line("Additional message", message),
    "",
    "ATTACHMENTS",
    `Logo/design uploaded: ${input.logoFilename ? `YES (${input.logoFilename})` : "NO"}`,
    "",
    `Reply directly to ${email} to follow up.`,
  ];

  return {
    subject: `Quote request: ${input.productName} — ${customerName}`,
    body: lines.join("\n"),
  };
}
