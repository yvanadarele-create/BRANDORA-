/**
 * Ask Brandora.
 *
 * The assistant is the layer that connects the rest of the product, and the one
 * place where a language model is most tempted to make something up. §"the
 * assistant should not invent supplier/product information" is not a style
 * note — a fabricated price or a fabricated minimum order is a promise Brandora
 * cannot keep, and the customer finds out at the quote.
 *
 * Three things keep it honest, in increasing order of how much they matter.
 *
 * **It is given facts, not access.** The prompt carries a fixed list of real
 * catalogue rows, selected server-side by the same matching engine the
 * catalogue page uses. The model cannot reach the database, so it cannot
 * retrieve a product that does not exist.
 *
 * **It is told to cite.** Every product it recommends must be named by its
 * Brandora id, drawn from the list it was given.
 *
 * **The interface does not render its numbers.** This is the load-bearing one.
 * The reply comes back as prose plus a set of ids; the ids are looked up in the
 * catalogue and the *product cards the customer sees are built from our data*.
 * If the model writes "1 200 FCFA" for a cup that costs 165, the sentence is
 * wrong but the price on screen is still right — and `unreferencedClaims`
 * catches the ids it cited that were never offered to it.
 */

import type { BrandoraProduct } from "@brandora/shared";
import { BrandoraError, formatMoney } from "@brandora/shared";
import type { StrategyProvider } from "@brandora/brand-engine";

import { type RankedProduct, recommendProducts } from "./pricing.js";

export interface BrandFacts {
  name: string;
  description: string;
  industry: string;
  positioning: string;
  targetCustomer: string;
  personality: readonly string[];
  promise: string;
  toneOfVoice: string;
  palette: readonly { name: string; hex: string; role: string }[];
  typography: { primary: string; secondary: string } | null;
}

export interface AssistantAnswer {
  /** The model's prose. Never the source of a figure on screen. */
  answer: string;
  /** Products it cited, resolved from the catalogue. */
  products: BrandoraProduct[];
  /** The quantity the question implied, if any. */
  quantity: number | null;
  /**
   * Ids the model cited that were not in the list it was given.
   *
   * Should always be empty. It is returned rather than hidden so a wrong answer
   * is visible in the log instead of shipping quietly to a customer.
   */
  unreferencedClaims: string[];
}

/**
 * Pull a quantity out of a question.
 *
 * "I need 30 premium cups" is the shape §12 names, and the number changes which
 * products can be ordered at all — so it is worth reading before matching
 * rather than after. A bare year or price is not a quantity; the pattern only
 * accepts a number that a unit word follows or precedes.
 */
export function readQuantity(question: string): number | null {
  const patterns = [
    /(\d[\d\s.,]*)\s*(?:units?|pieces?|pcs?|cups?|boxes?|bags?|bottles?|labels?|stickers?|cards?|items?)/i,
    /(?:need|want|order|buy|find me|get me)\s+(\d[\d\s.,]*)/i,
  ];

  for (const pattern of patterns) {
    const raw = pattern.exec(question)?.[1];
    if (!raw) continue;
    const parsed = Number.parseInt(raw.replace(/[\s.,]/g, ""), 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 1_000_000) return parsed;
  }
  return null;
}

const SYSTEM = `You are Brandora's assistant. You help a small business owner choose physical products for their brand — packaging, tableware, brand materials, merchandise.

You are given the customer's brand and a list of REAL products from Brandora's catalogue. These are the only products that exist.

Rules, in order of importance:
1. Only ever recommend a product from the CATALOGUE list. Never invent a product, a supplier, a price, a minimum order, a lead time or a delivery date.
2. Cite every product you recommend by its exact id in square brackets, like [prd_cup_kraft_250]. Cite it the first time you mention it.
3. If nothing in the list fits what they asked for, say so plainly and say what is close. Do not stretch a product to fit.
4. Only say a product can carry their logo when the list says branding is CONFIRMED. If it says unconfirmed, say Brandora checks before they pay.
5. Never state a delivery date or shipping time. Brandora has not quoted one.
6. If the customer named a quantity, only recommend products marked "CAN be ordered at" that quantity. A product marked CANNOT is still worth mentioning — say plainly that it starts at its minimum, so they can decide — but never present it as something they can order today.
7. Do not mention supplier names, supplier costs, or Brandora's margin.

How to write:
- Short sentences. Write for the founder, not a marketing department.
- Explain WHY a product suits their brand, using their positioning and personality.
- Two to four products is a good answer. Ten is not.
- No headings, no bullet-point walls. Two or three short paragraphs.`;

/**
 * One catalogue row, as the model sees it.
 *
 * When the question named a quantity, whether the product can actually be
 * ordered at it is stated outright. The matching engine *ranks* rather than
 * filters — right for the catalogue page, where §35 says a product you cannot
 * order at thirty should be demoted and labelled rather than hidden — but a
 * model handed an unlabelled list will cheerfully recommend a sticker with a
 * minimum of fifty to someone who asked for thirty, and the customer discovers
 * it at the package. Labelled, the model can say the useful thing instead:
 * "these suit you, and they start at fifty".
 */
function describeProduct(
  product: BrandoraProduct,
  entry: RankedProduct | undefined,
  quantity: number | null,
): string {
  const customization =
    product.customization.confidence === "verified"
      ? `branding CONFIRMED (${product.customization.methods.join(", ")})`
      : product.customization.confidence === "unavailable"
        ? "cannot be branded"
        : "branding UNCONFIRMED";

  const reasons = entry?.reasons.length ? ` | matches: ${entry.reasons.join("; ")}` : "";

  const orderable =
    quantity === null
      ? ""
      : product.minimumQuantity <= quantity && product.availableQuantity >= quantity
        ? ` | CAN be ordered at ${quantity}`
        : ` | CANNOT be ordered at ${quantity} (minimum ${product.minimumQuantity})`;

  // A quote-on-request product's indicativeUnitPrice is zero, not free — the
  // model must never read that zero as a price and repeat it to a customer.
  const priceText = product.quoteOnRequest
    ? "QUOTE ON REQUEST, no fixed unit price yet — do not state a number, tell the customer to ask for a quote"
    : `${formatMoney(product.indicativeUnitPrice)} per unit`;
  const supplierText = product.supplierReference ? `| supplier: ${product.supplierReference.name} ` : "";

  return [
    `[${product.id}]`,
    product.name,
    `— ${product.category}/${product.subcategory}`,
    `| ${priceText}`,
    supplierText,
    `| minimum ${product.minimumQuantity}`,
    `| ${product.availableQuantity} available`,
    `| ${customization}`,
    product.material ? `| ${product.material}` : "",
    orderable,
    reasons,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildAssistantPrompt(
  question: string,
  brand: BrandFacts,
  candidates: readonly RankedProduct[],
  quantity: number | null = null,
): { system: string; user: string } {
  const palette = brand.palette.map((swatch) => `${swatch.name} ${swatch.hex}`).join(", ");

  const user = [
    "BRAND",
    `Name: ${brand.name}`,
    `What they do: ${brand.description}`,
    `Industry: ${brand.industry}`,
    `Positioning: ${brand.positioning.replace("-", " ")}`,
    `Their customer: ${brand.targetCustomer}`,
    `Personality: ${brand.personality.join(", ")}`,
    `Promise: ${brand.promise}`,
    `Tone: ${brand.toneOfVoice}`,
    palette ? `Colours: ${palette}` : "",
    brand.typography ? `Typefaces: ${brand.typography.primary} and ${brand.typography.secondary}` : "",
    "",
    "CATALOGUE — the only products that exist",
    ...candidates.map((entry) => describeProduct(entry.product, entry, quantity)),
    "",
    "QUESTION",
    question,
  ]
    .filter(Boolean)
    .join("\n");

  return { system: SYSTEM, user };
}

/** Product ids the model cited, in the order it cited them. */
export function citedIds(answer: string): string[] {
  const ids = [...answer.matchAll(/\[(prd_[a-z0-9_]+)\]/gi)].map((match) => match[1] as string);
  return [...new Set(ids)];
}

/**
 * Strip the citation brackets for display.
 *
 * The ids are how the interface finds the real products; a customer does not
 * need to read `prd_cup_kraft_250` in the middle of a sentence.
 */
export function stripCitations(answer: string): string {
  return answer
    .replace(/\s*\[prd_[a-z0-9_]+\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export interface AskOptions {
  question: string;
  brand: BrandFacts;
  catalog: readonly BrandoraProduct[];
  provider: StrategyProvider;
  /** How many catalogue rows the model is shown. */
  candidateLimit?: number;
  /** Used when the question names no quantity. */
  defaultQuantity?: number;
}

export const MAX_QUESTION_LENGTH = 1_000;

export async function ask(options: AskOptions): Promise<AssistantAnswer> {
  const question = options.question.trim();
  if (question === "") {
    throw new BrandoraError("input.invalid", "assistant: empty question", 400);
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new BrandoraError("input.invalid", `assistant: question over ${MAX_QUESTION_LENGTH} characters`, 400);
  }

  const quantity = readQuantity(question);
  const ranked = recommendProducts(
    {
      positioning: options.brand.positioning,
      personality: options.brand.personality,
      industry: `${options.brand.industry} ${options.brand.description}`,
      quantity: quantity ?? options.defaultQuantity ?? 30,
    },
    options.catalog,
    options.candidateLimit ?? 14,
  );

  // Nothing to talk about. Said plainly rather than sent to the model to be
  // dressed up — a model given no products will invent some.
  if (ranked.length === 0) {
    return {
      answer:
        "Nothing in the catalogue matches that yet. Tell me a bit more about what you sell, or try a different quantity.",
      products: [],
      quantity,
      unreferencedClaims: [],
    };
  }

  const prompt = buildAssistantPrompt(question, options.brand, ranked, quantity);
  const raw = await options.provider.complete({ ...prompt, maxTokens: 1_200 });

  const offered = new Map(ranked.map((entry) => [entry.product.id, entry.product]));
  const cited = citedIds(raw);

  return {
    answer: stripCitations(raw),
    products: cited.map((id) => offered.get(id)).filter((product): product is BrandoraProduct => !!product),
    quantity,
    // A model citing an id it was never given is the failure mode this whole
    // file is built around. Surfaced, not swallowed.
    unreferencedClaims: cited.filter((id) => !offered.has(id)),
  };
}
