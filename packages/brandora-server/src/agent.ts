/**
 * The Brandora procurement agent.
 *
 * `procurement.ts` is the arithmetic — matching, landed cost, scoring, the
 * authorisation rule. This file is the agent around it: it turns a sentence
 * into a structured request, gathers real candidates, and writes the report.
 *
 * The division of labour is the whole design, and it is the same one that keeps
 * Ask Brandora honest.
 *
 * **The model reads. It does not know anything.** It is used for exactly one
 * job — turning "I need 500 matte black 250ml cups delivered to Abidjan by
 * March, under 400 francs each" into fields. It never sees a supplier, never
 * proposes one, and never produces a number that reaches the customer. A model
 * asked to *find* a supplier will invent one with a plausible name, a plausible
 * MOQ and a plausible price, and every one of those is a promise Brandora
 * cannot keep.
 *
 * **The database answers.** Candidates come from `suppliers` and
 * `supplier_offers`. If there are none, the report says there are none. §"never
 * fabricate supplier information, prices, certifications, inventory, lead times
 * or capabilities" is not enforced by telling the model not to — it is enforced
 * by the model never being asked.
 *
 * **The report is rendered, not written.** Every figure in the output comes
 * from `shortlist()`. The model's prose, where it appears at all, is labelled
 * as a summary and sits beside the numbers rather than containing them.
 *
 * And the principle the ranking exists to express: **the best supplier is not
 * the cheapest supplier.** `SCORE_WEIGHTS` puts match and reliability above
 * price on purpose, and the report always states where the recommendation sits
 * against the cheapest option — including when they differ, which is when
 * someone is most likely to overrule it.
 */

import type { Money } from "@brandora/shared";
import { BrandoraError, formatMoney, money } from "@brandora/shared";
import type { StrategyProvider } from "@brandora/brand-engine";
import type { Repositories, SupplierRow } from "@brandora/database";

import {
  type Candidate,
  type LandedCost,
  type MatchLevel,
  type OfferFacts,
  type ProcurementRequest,
  type RiskLevel,
  type RiskSignal,
  type ShortlistEntry,
  type SupplierFacts,
  missingEssentials,
  riskSignals,
  shortlist,
} from "./procurement.js";

export const MAX_BRIEF_LENGTH = 2_000;

/* --- Turning prose into a request ------------------------------------------ */

const EXTRACTION_SYSTEM = `You convert a purchasing request written in plain language into JSON.

You are a parser. You do not know anything about suppliers, products, prices or shipping, and you must not add anything the person did not say.

Return ONLY a JSON object with these keys. Omit any key the person did not give you — do NOT guess, and do NOT fill in a typical or sensible value:

{
  "productType": string,        // what they want to buy, e.g. "paper cup", "kraft box"
  "category": string,           // packaging | tableware | brand-materials | merchandise
  "material": string,
  "colour": string,
  "finish": string,             // e.g. "matte", "gloss"
  "capacityMl": number,
  "quantity": number,
  "targetUnitPriceMinor": number,   // per-unit price they named, as a whole number in the currency below
  "maxBudgetMinor": number,         // total budget they named, as a whole number
  "currency": string,               // ISO code, only if they named a currency
  "destinationCountry": string,     // ISO-2 country code
  "destinationCity": string,
  "requiredBy": string,             // ISO date, only if they gave a date
  "maxProductionDays": number,
  "customization": string[],        // e.g. ["logo print"], only if they asked for branding
  "certifications": string[],       // only if they required one
  "notes": string                   // anything else they said that a buyer would need
}

Rules:
- Never invent a quantity. "some cups" has no quantity.
- Never invent a destination. If they did not say where it ships, omit it.
- Amounts are whole numbers in the smallest unit of the currency. FCFA/XOF has no decimal places: "400 francs" is 400, not 40000.
- If they wrote a number of units and a number of francs in the same sentence, the units are the quantity.
- Output the JSON object and nothing else. No explanation, no code fence.`;

/** Read a `Money` out of the model's JSON, or nothing. */
function readMoney(
  source: Record<string, unknown>,
  key: string,
  currency: string | undefined,
  fallbackCurrency: string,
): Money | undefined {
  const raw = source[key];
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return undefined;
  const code = (typeof currency === "string" && currency.length === 3 ? currency : fallbackCurrency).toUpperCase();
  try {
    return money(Math.round(raw), code as Money["currency"]);
  } catch {
    return undefined;
  }
}

const readString = (source: Record<string, unknown>, key: string): string | undefined => {
  const raw = source[key];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
};

const readNumber = (source: Record<string, unknown>, key: string): number | undefined => {
  const raw = source[key];
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : undefined;
};

const readStrings = (source: Record<string, unknown>, key: string): string[] | undefined => {
  const raw = source[key];
  if (!Array.isArray(raw)) return undefined;
  const values = raw.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  return values.length > 0 ? values.map((value) => value.trim()) : undefined;
};

/**
 * Parse the model's JSON into a request.
 *
 * Everything is read defensively and nothing is defaulted. A field the model
 * did not return, or returned as the wrong type, is *absent* — which
 * `missingEssentials` then reports as a question to ask, rather than the agent
 * quietly sourcing to a country nobody named.
 */
export function parseExtraction(raw: string, fallbackCurrency = "XOF"): Partial<ProcurementRequest> {
  // Models wrap JSON in a fence more often than not, whatever they are told.
  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new BrandoraError("internal", "procurement: extraction returned no JSON object", 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new BrandoraError("internal", "procurement: extraction returned unparseable JSON", 502);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new BrandoraError("internal", "procurement: extraction returned a non-object", 502);
  }

  const source = parsed as Record<string, unknown>;
  const currency = readString(source, "currency");
  const country = readString(source, "destinationCountry");

  const request: Partial<ProcurementRequest> = {};
  const assign = <K extends keyof ProcurementRequest>(key: K, value: ProcurementRequest[K] | undefined) => {
    if (value !== undefined) request[key] = value;
  };

  assign("productType", readString(source, "productType"));
  assign("category", readString(source, "category"));
  assign("material", readString(source, "material"));
  assign("colour", readString(source, "colour"));
  assign("finish", readString(source, "finish"));
  assign("capacityMl", readNumber(source, "capacityMl"));
  assign("quantity", readNumber(source, "quantity"));
  assign("targetUnitPrice", readMoney(source, "targetUnitPriceMinor", currency, fallbackCurrency));
  assign("maxBudget", readMoney(source, "maxBudgetMinor", currency, fallbackCurrency));
  // Two letters, upper case. A model that answers "Ivory Coast" gives a string
  // no shipping table can look up, so it is dropped rather than stored.
  assign("destinationCountry", country && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : undefined);
  assign("destinationCity", readString(source, "destinationCity"));
  assign("requiredBy", readString(source, "requiredBy"));
  assign("maxProductionDays", readNumber(source, "maxProductionDays"));
  assign("customization", readStrings(source, "customization"));
  assign("certifications", readStrings(source, "certifications"));
  assign("notes", readString(source, "notes"));

  return request;
}

export async function extractRequest(
  brief: string,
  provider: StrategyProvider,
  fallbackCurrency = "XOF",
): Promise<Partial<ProcurementRequest>> {
  const trimmed = brief.trim();
  if (trimmed === "") {
    throw new BrandoraError("input.invalid", "procurement: empty brief", 400);
  }
  if (trimmed.length > MAX_BRIEF_LENGTH) {
    throw new BrandoraError("input.invalid", `procurement: brief over ${MAX_BRIEF_LENGTH} characters`, 400);
  }

  const raw = await provider.complete({
    system: EXTRACTION_SYSTEM,
    user: trimmed,
    maxTokens: 800,
  });

  return parseExtraction(raw, fallbackCurrency);
}

/* --- Gathering candidates --------------------------------------------------- */

/** A supplier row as the engine wants it. Recorded counts only, no opinions. */
export function toSupplierFacts(row: SupplierRow): SupplierFacts {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    ...(row.country ? { country: row.country } : {}),
    categories: row.categories,
    certifications: row.certifications,
    customization: row.customization,
    ...(row.leadTimeDays !== undefined ? { leadTimeDays: row.leadTimeDays } : {}),
    completedOrders: row.completedOrders,
    lateOrders: row.lateOrders,
    defectReports: row.defectReports,
    disputes: row.disputes,
    status: row.status,
    ...(row.riskFlag ? { riskFlag: row.riskFlag } : {}),
  };
}

export interface CatalogueProduct {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  material?: string | undefined;
  colors: readonly string[];
  dimensions?: { volumeMl?: number | undefined } | undefined;
}

/**
 * Every offer that could answer this request, with its supplier and product.
 *
 * Reads the database, and only the database. A product the catalogue does not
 * carry has no candidates; a product with no supplier offers has none either,
 * and that is reported as "nobody is set up to make this yet" rather than
 * filled in by a model.
 *
 * Blocked suppliers are dropped here as well as in `shortlist`, so a blocked
 * supplier cannot appear even in a diagnostic count.
 */
export async function gatherCandidates(
  repos: Repositories,
  request: ProcurementRequest,
  catalogue: readonly CatalogueProduct[],
): Promise<Candidate[]> {
  const wanted = request.productType.toLowerCase();
  const relevant = catalogue.filter((product) => {
    const haystack = `${product.name} ${product.category} ${product.subcategory}`.toLowerCase();
    // Every word of the product type has to appear somewhere. "kraft cup"
    // should not match a kraft bag.
    return wanted.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
  });

  const byProduct = await Promise.all(
    relevant.map(async (product) => ({
      product,
      offers: await repos.supplierOffers.listForProduct(product.id, request.quantity),
    })),
  );

  const supplierIds = [...new Set(byProduct.flatMap((entry) => entry.offers.map((offer) => offer.supplierId)))];
  const suppliers = new Map(
    (await Promise.all(supplierIds.map((id) => repos.suppliers.findById(id))))
      .filter((row): row is SupplierRow => row !== null)
      .map((row) => [row.id, row]),
  );

  const candidates: Candidate[] = [];
  for (const { product, offers } of byProduct) {
    for (const offer of offers) {
      const supplier = suppliers.get(offer.supplierId);
      if (!supplier || supplier.status === "blocked") continue;

      const facts: OfferFacts = {
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
      };

      candidates.push({
        supplier: toSupplierFacts(supplier),
        offer: facts,
        product: {
          name: product.name,
          category: product.category,
          subcategory: product.subcategory,
          ...(product.material ? { material: product.material } : {}),
          colors: product.colors,
          ...(product.dimensions?.volumeMl !== undefined
            ? { dimensions: { volumeMl: product.dimensions.volumeMl } }
            : {}),
        },
      });
    }
  }

  return candidates;
}

/* --- The report ------------------------------------------------------------- */

export interface SupplierOption {
  rank: number;
  supplierId: string;
  supplierName: string;
  platform: string;
  country: string | null;
  match: { level: MatchLevel; matched: string[]; missed: string[] };
  unitCost: Money;
  landedPerUnit: Money;
  landedTotal: Money;
  /** Costs that could not be calculated, named rather than assumed to be zero. */
  unknowns: string[];
  productionDays: number | null;
  minimumOrder: number;
  availableQuantity: number;
  priceLastCheckedAt: string;
  score: {
    total: number;
    breakdown: { match: number; quality: number; reliability: number; price: number; speed: number };
    reasons: string[];
    concerns: string[];
  };
  risk: { level: RiskLevel; signals: RiskSignal[] };
  /** True for the option with the lowest landed per-unit cost. */
  cheapest: boolean;
  recommended: boolean;
}

export interface ProcurementReport {
  /** What the agent understood, after parsing — never after guessing. */
  understood: ProcurementRequest | Partial<ProcurementRequest>;
  /** Questions that must be answered before anything can be evaluated. */
  missing: string[];
  /** The shortlist, best first. Empty when nothing in the database fits. */
  options: SupplierOption[];
  /** Why the top option is the top option, in words, from our own figures. */
  recommendation: string | null;
  /**
   * The sentence the whole ranking exists for.
   *
   * Present whenever the recommendation is not the cheapest option, because
   * that is exactly the moment somebody overrules it.
   */
  costOfRecommendation: string | null;
  /** What the agent proposes to do next, and whether it may do it alone. */
  nextStep: string;
  /** How many candidates existed before matching dropped the unsuitable ones. */
  considered: number;
  notes: string[];
}

/**
 * How much more the first costs than the second, as a percentage of the first.
 *
 * Stated this way round on purpose. "130 is 88% below 245" is false — 130 is
 * 47% below 245, and 245 is 88% above 130 — and getting that backwards in a
 * sentence a buyer uses to overrule the ranking is worse than not printing it.
 */
const percentAbove = (dearer: Money, cheaper: Money): number =>
  dearer.amount === 0 ? 0 : Math.round(((dearer.amount - cheaper.amount) / dearer.amount) * 100);

/** "a, b and c" — not "a and b and c". */
function sentenceList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The name of an unknown, without its explanation.
 *
 * `landedCost` returns "freight — the supplier has not quoted it", which is
 * right on the option card and unreadable nested inside another em-dashed
 * clause. Here only the noun is wanted.
 */
const unknownName = (unknown: string): string => (unknown.split("—")[0] ?? unknown).trim();

/**
 * Turn a shortlist into the report a person reads.
 *
 * Every number here comes from `entries`. Nothing on this path calls a model,
 * which is why a fabricated price cannot reach the page even if one were
 * produced upstream.
 */
export function buildReport(
  request: Partial<ProcurementRequest>,
  entries: readonly ShortlistEntry[],
  considered: number,
): ProcurementReport {
  const missing = missingEssentials(request);

  if (missing.length > 0) {
    return {
      understood: request,
      missing,
      options: [],
      recommendation: null,
      costOfRecommendation: null,
      nextStep: `Ask the customer: ${missing.join(", ")}.`,
      considered,
      notes: [],
    };
  }

  if (entries.length === 0) {
    return {
      understood: request,
      missing: [],
      options: [],
      recommendation: null,
      costOfRecommendation: null,
      // Said plainly. The alternative — a model filling the gap — is how a
      // customer ends up with a quote from a supplier that does not exist.
      nextStep:
        considered === 0
          ? "No supplier in Brandora's database offers this yet. Source and record one before quoting."
          : "Every candidate was unsuitable at this quantity or specification. Widen the request or find a new supplier.",
      considered,
      notes: [],
    };
  }

  const cheapest = entries.reduce((best, entry) =>
    entry.cost.perUnit.amount < best.cost.perUnit.amount ? entry : best,
  );

  const options: SupplierOption[] = entries.map((entry, index) => {
    const signals = riskSignals({ supplier: entry.supplier });
    return {
      rank: index + 1,
      supplierId: entry.supplier.id,
      supplierName: entry.supplier.name,
      platform: entry.supplier.platform,
      country: entry.supplier.country ?? null,
      match: { level: entry.match.level, matched: entry.match.matched, missed: entry.match.missed },
      unitCost: entry.offer.unitCost,
      landedPerUnit: entry.cost.perUnit,
      landedTotal: entry.cost.total,
      unknowns: entry.cost.unknowns,
      productionDays: entry.offer.productionDays ?? null,
      minimumOrder: entry.offer.minimumOrder,
      availableQuantity: entry.offer.availableQuantity,
      priceLastCheckedAt: entry.offer.lastCheckedAt,
      score: {
        total: entry.score.total,
        // Shown in full, because a score nobody can take apart is a score
        // nobody can argue with — and the whole point of publishing the
        // weights is that a buyer can see price is 25 of 100.
        breakdown: {
          match: entry.score.match,
          quality: entry.score.quality,
          reliability: entry.score.reliability,
          price: entry.score.price,
          speed: entry.score.speed,
        },
        reasons: entry.score.reasons,
        concerns: entry.score.concerns,
      },
      risk: { level: entry.score.risk, signals },
      cheapest: entry.supplier.id === cheapest.supplier.id && entry.offer.productId === cheapest.offer.productId,
      recommended: index === 0,
    };
  });

  const top = entries[0]!;
  const recommendation = [
    `${top.supplier.name} — ${formatMoney(top.cost.perUnit)} per unit landed,`,
    `${formatMoney(top.cost.total)} in total.`,
    top.score.reasons.length > 0 ? `Chosen because ${top.score.reasons.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const isCheapest = top.supplier.id === cheapest.supplier.id && top.offer.productId === cheapest.offer.productId;
  const gap = percentAbove(top.cost.perUnit, cheapest.cost.perUnit);

  const costOfRecommendation = isCheapest
    ? null
    : [
        `${cheapest.supplier.name} is cheaper at ${formatMoney(cheapest.cost.perUnit)} per unit`,
        gap > 0 ? `— the recommendation costs ${gap}% more.` : ".",
        `It ranks lower on ${sentenceList(lowerOn(top, cheapest))}.`,
        // Comparing a complete total against one with a hole in it is not a
        // comparison. But only an *asymmetric* hole distorts the gap: duty and
        // tax are missing from every option when the destination's rates are
        // not configured, and saying "the gap may be nothing" there is noise
        // that trains an operator to skip the line that matters. Both problems
        // were found by putting a supplier with no recorded freight next to two
        // who had it.
        onlyIn(cheapest.cost.unknowns, top.cost.unknowns).length > 0
          ? `That figure is incomplete — ${sentenceList(
              onlyIn(cheapest.cost.unknowns, top.cost.unknowns).map(unknownName),
            )} is not recorded for it, but is for the recommendation — so the real gap is smaller than it looks, and may be nothing.`
          : "",
        "The best supplier is not the cheapest supplier: a run that arrives late or off-spec costs more than the difference.",
      ]
        .filter(Boolean)
        .join(" ");

  const notes: string[] = [];
  const stale = options.filter((option) => option.unknowns.length > 0);
  if (stale.length > 0) {
    // Short names here. Each option's own card carries the full explanation,
    // and repeating "the destination's rate is not configured" three times in
    // one sentence buries the count, which is the part that is new.
    notes.push(
      `${stale.length} of ${options.length} options have costs that could not be calculated (${sentenceList([
        ...new Set(stale.flatMap((option) => option.unknowns.map(unknownName))),
      ])}). Those totals are incomplete, not final.`,
    );
  }
  if (options.some((option) => option.risk.signals.length > 0)) {
    notes.push("At least one shortlisted supplier carries a risk signal — see the option for what it is.");
  }

  return {
    understood: request,
    missing: [],
    options,
    recommendation,
    costOfRecommendation,
    // §11: a sample comes before a production run, and this is the step the
    // agent proposes rather than one it takes.
    nextStep: `Request a quotation and a sample from ${top.supplier.name}. Nothing is ordered until a person approves it.`,
    considered,
    notes,
  };
}

/** Unknowns the first has and the second does not. */
const onlyIn = (a: readonly string[], b: readonly string[]): string[] =>
  a.filter((entry) => !b.includes(entry));

/** The dimensions on which the recommendation beat the cheaper option. */
function lowerOn(top: ShortlistEntry, cheaper: ShortlistEntry): string[] {
  const reasons: string[] = [];
  if (rankMatch(cheaper.match.level) > rankMatch(top.match.level)) reasons.push("how well it matches the request");
  if (cheaper.score.reliability < top.score.reliability) reasons.push("recorded reliability");
  if (cheaper.score.quality < top.score.quality) reasons.push("recorded quality");
  if (cheaper.score.speed < top.score.speed) reasons.push("production time");
  if (cheaper.score.risk !== "low" && top.score.risk === "low") reasons.push("risk");
  return reasons.length > 0 ? reasons : ["the combined score"];
}

const rankMatch = (level: MatchLevel): number =>
  level === "exact" ? 0 : level === "close" ? 1 : level === "partial" ? 2 : 3;

/* --- The whole run ---------------------------------------------------------- */

export interface SourcingOptions {
  repos: Repositories;
  brief: string;
  provider: StrategyProvider;
  catalogue: readonly CatalogueProduct[];
  currency?: string;
  dutyRate?: number;
  taxRate?: number;
  platformFeeRate?: number;
  paymentFeeRate?: number;
  limit?: number;
}

/**
 * Brief in, report out.
 *
 * The model is called once, at the start, to read the sentence. Everything
 * after that is the database and the arithmetic in `procurement.ts`.
 */
export async function sourceFromBrief(options: SourcingOptions): Promise<ProcurementReport> {
  const request = await extractRequest(options.brief, options.provider, options.currency ?? "XOF");

  if (missingEssentials(request).length > 0) return buildReport(request, [], 0);

  const complete = request as ProcurementRequest;
  const candidates = await gatherCandidates(options.repos, complete, options.catalogue);

  const entries = shortlist(complete, candidates, {
    ...(options.dutyRate !== undefined ? { dutyRate: options.dutyRate } : {}),
    ...(options.taxRate !== undefined ? { taxRate: options.taxRate } : {}),
    ...(options.platformFeeRate !== undefined ? { platformFeeRate: options.platformFeeRate } : {}),
    ...(options.paymentFeeRate !== undefined ? { paymentFeeRate: options.paymentFeeRate } : {}),
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
  });

  return buildReport(complete, entries, candidates.length);
}

/** Re-exported so callers do not have to reach into two modules. */
export type { LandedCost, ShortlistEntry };
