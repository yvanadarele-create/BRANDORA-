/**
 * The email a "request a quote" click on a catalogue photo turns into.
 *
 * Kept as a pure function, deliberately separate from the route that calls
 * it (packages/brandora-server/src/routes.ts) and the transport that
 * eventually sends it (packages/brandora-server/src/notifications.ts) — the
 * question "is the payload built correctly from what the visitor typed" has
 * nothing to do with HTTP or a network call, and a pure function is the
 * cheapest, most direct way to test that it never drops a field.
 */

import { ValidationError } from "@brandora/shared";

export interface QuoteRequestInput {
  productId: string;
  productName: string;
  requesterName: string;
  requesterEmail: string;
  /** Minimum order quantity the visitor is asking about. Required — a quote without a quantity is not a quote. */
  moq: number;
  color?: string;
  material?: string;
  note?: string;
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

/**
 * Build the email — and validate the one field the email cannot make sense
 * without. `moq` throws rather than defaulting to some plausible-looking
 * number, for the same reason the rest of this application never invents a
 * quantity nobody typed.
 */
export function buildQuoteRequestEmail(input: QuoteRequestInput): QuoteRequestEmail {
  if (!Number.isInteger(input.moq) || input.moq <= 0) {
    throw new ValidationError("moq", "must be a positive whole number");
  }

  const color = clean(input.color, "color");
  const material = clean(input.material, "material");
  const note = clean(input.note, "note");
  const requesterName = clean(input.requesterName, "requesterName") ?? "A Brandora customer";

  const lines = [
    `New quote request from ${requesterName} (${input.requesterEmail}).`,
    "",
    `Product: ${input.productName}`,
    `Product id: ${input.productId}`,
    `Quantity requested: ${input.moq}`,
    color ? `Colour: ${color}` : "Colour: not specified",
    material ? `Material / texture: ${material}` : "Material / texture: not specified",
  ];

  if (input.logoFilename) {
    lines.push(`Logo file attached: ${input.logoFilename}`);
  } else {
    lines.push("No logo file attached.");
  }

  if (note) {
    lines.push("", "Note from the customer:", note);
  }

  lines.push("", `Reply directly to ${input.requesterEmail} to follow up.`);

  return {
    subject: `Quote request: ${input.productName}`,
    body: lines.join("\n"),
  };
}
