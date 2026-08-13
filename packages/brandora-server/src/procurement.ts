/**
 * The procurement engine.
 *
 * This is the part of the agent that is arithmetic rather than language. The
 * model reads a request and writes an explanation; everything in between —
 * which suppliers match, how well, what it will actually cost landed, which is
 * best, and whether a human has to approve it — is computed here, from stored
 * facts, deterministically.
 *
 * That split is the whole design. A language model asked to "compare suppliers"
 * will produce a confident ranking it cannot justify and cannot reproduce. A
 * function that takes offers and returns scores can be tested, argued with, and
 * corrected — and when a supplier asks why they were not chosen, there is an
 * answer.
 *
 * Two rules are load-bearing:
 *
 * **The best supplier is not the cheapest supplier.** A low price paired with a
 * defect history is a more expensive order than a higher price that arrives.
 * `scoreSupplier` weights price at 25 and quality-plus-reliability at 40, and
 * `RISK_PENALTY` can take a cheap, unproven supplier below an expensive proven
 * one.
 *
 * **An estimate is never a quotation.** Everything this file produces is
 * labelled `estimated` until a supplier confirms it. `PriceConfidence` exists
 * so that distinction survives into the interface, where a customer reads it.
 */

import {
  type Money,
  ValidationError,
  add,
  money,
  multiply,
  zero,
} from "@brandora/shared";

/* --- The request ------------------------------------------------------------ */

/**
 * A procurement request, after the model has turned prose into structure.
 *
 * Every field is optional except the ones without which nothing can be
 * evaluated. Missing information is *missing*, not defaulted: inventing a
 * destination country produces a landed cost for a country nobody named.
 */
export interface ProcurementRequest {
  category?: string;
  productType: string;
  material?: string;
  colour?: string;
  finish?: string;
  capacityMl?: number;
  quantity: number;
  targetUnitPrice?: Money;
  maxBudget?: Money;
  destinationCountry?: string;
  destinationCity?: string;
  requiredBy?: string;
  maxProductionDays?: number;
  customization?: string[];
  certifications?: string[];
  notes?: string;
}

/** What the agent must ask before it can evaluate anything. */
export function missingEssentials(request: Partial<ProcurementRequest>): string[] {
  const missing: string[] = [];
  if (!request.productType || request.productType.trim() === "") missing.push("what product");
  if (!request.quantity || request.quantity <= 0) missing.push("how many");
  if (!request.destinationCountry) missing.push("where it ships to");
  return missing;
}

/* --- Suppliers and offers --------------------------------------------------- */

export interface SupplierFacts {
  id: string;
  name: string;
  platform: string;
  country?: string;
  categories: readonly string[];
  certifications: readonly string[];
  customization: readonly string[];
  leadTimeDays?: number;
  /** Recorded outcomes, not opinions. */
  completedOrders: number;
  lateOrders: number;
  defectReports: number;
  disputes: number;
  status: "active" | "paused" | "blocked" | "unverified";
  riskFlag?: string;
}

export interface OfferFacts {
  supplierId: string;
  productId: string;
  fromQuantity: number;
  unitCost: Money;
  customizationCost: Money;
  setupCost: Money;
  minimumOrder: number;
  availableQuantity: number;
  productionDays?: number;
  shippingCost?: Money;
  customization: readonly string[];
  lastCheckedAt: string;
}

export const MATCH_LEVELS = ["exact", "close", "partial", "unsuitable"] as const;
export type MatchLevel = (typeof MATCH_LEVELS)[number];

export const PRICE_CONFIDENCE = ["confirmed", "estimated", "needs-confirmation"] as const;
export type PriceConfidence = (typeof PRICE_CONFIDENCE)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/* --- Matching --------------------------------------------------------------- */

export interface MatchResult {
  level: MatchLevel;
  score: number;
  matched: string[];
  missed: string[];
}

/**
 * How well an offer answers the request.
 *
 * A partial match is never reported as exact. That sounds obvious and is the
 * single most common way a sourcing tool wastes a customer's money: they
 * approve "exact", the sample arrives in the wrong material, and the whole
 * production run is already paid for.
 */
export function matchOffer(
  request: ProcurementRequest,
  offer: OfferFacts,
  product: { name: string; category: string; subcategory: string; material?: string; colors: readonly string[]; dimensions?: { volumeMl?: number } },
): MatchResult {
  const matched: string[] = [];
  const missed: string[] = [];

  const wanted = request.productType.toLowerCase();
  const describes = `${product.name} ${product.category} ${product.subcategory}`.toLowerCase();
  const typeMatches = wanted.split(/\s+/).filter(Boolean).some((word) => describes.includes(word));
  if (typeMatches) matched.push("product type");
  else missed.push("product type");

  if (request.material) {
    if ((product.material ?? "").toLowerCase().includes(request.material.toLowerCase())) {
      matched.push("material");
    } else missed.push("material");
  }

  if (request.colour) {
    if (product.colors.some((colour) => colour.toLowerCase().includes(request.colour!.toLowerCase()))) {
      matched.push("colour");
    } else missed.push("colour");
  }

  if (request.capacityMl) {
    const actual = product.dimensions?.volumeMl;
    // Within a tenth is the same cup in practice; a different number on a
    // datasheet is not a different product to the person drinking from it.
    if (actual && Math.abs(actual - request.capacityMl) / request.capacityMl <= 0.1) {
      matched.push("capacity");
    } else missed.push("capacity");
  }

  if (request.customization?.length) {
    const offered = offer.customization.map((method) => method.toLowerCase());
    const all = request.customization.every((method) => offered.includes(method.toLowerCase()));
    if (all) matched.push("customisation");
    else missed.push("customisation");
  }

  // Quantity is not a preference. A supplier who cannot make the number asked
  // for has not matched, however well everything else lines up.
  const quantityWorks =
    offer.minimumOrder <= request.quantity && offer.availableQuantity >= request.quantity;
  if (quantityWorks) matched.push("quantity");
  else missed.push(`quantity (minimum ${offer.minimumOrder})`);

  const total = matched.length + missed.length;
  const score = total === 0 ? 0 : Math.round((matched.length / total) * 100);

  const level: MatchLevel = !typeMatches || !quantityWorks
    ? "unsuitable"
    : missed.length === 0
      ? "exact"
      : missed.length === 1
        ? "close"
        : "partial";

  return { level, score, matched, missed };
}

/* --- Landed cost ------------------------------------------------------------ */

export interface LandedCostInput {
  offer: OfferFacts;
  quantity: number;
  /** Duty as a rate on goods, when the destination is known. */
  dutyRate?: number;
  taxRate?: number;
  platformFeeRate?: number;
  paymentFeeRate?: number;
}

export interface LandedCost {
  productCost: Money;
  customizationCost: Money;
  setupCost: Money;
  shippingCost: Money;
  duties: Money;
  taxes: Money;
  fees: Money;
  total: Money;
  perUnit: Money;
  confidence: PriceConfidence;
  /** What was left out because nobody has quoted it. */
  unknowns: string[];
}

/**
 * What the order will actually cost to get here.
 *
 * Components nobody has quoted are recorded in `unknowns` and left out of the
 * total rather than guessed. A landed cost with an invented freight number is
 * worse than one that says freight is not yet quoted: the first gets approved.
 */
export function landedCost(input: LandedCostInput): LandedCost {
  const { offer, quantity } = input;
  const currency = offer.unitCost.currency;

  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new ValidationError("quantity", "must be a whole number above zero");
  }
  if (offer.customizationCost.currency !== currency || offer.setupCost.currency !== currency) {
    throw new ValidationError("currency", "an offer's costs must share one currency");
  }

  const unknowns: string[] = [];

  const productCost = multiply(offer.unitCost, quantity);
  const customizationCost = multiply(offer.customizationCost, quantity);
  const setupCost = offer.setupCost;

  let shippingCost = zero(currency);
  if (offer.shippingCost) shippingCost = offer.shippingCost;
  else unknowns.push("freight — the supplier has not quoted it");

  const goods = add(add(productCost, customizationCost), setupCost);

  let duties = zero(currency);
  if (input.dutyRate !== undefined) duties = multiply(goods, input.dutyRate);
  else unknowns.push("duty — the destination's rate is not configured");

  let taxes = zero(currency);
  if (input.taxRate !== undefined) taxes = multiply(goods, input.taxRate);
  else unknowns.push("tax — the destination's rate is not configured");

  const fees = add(
    multiply(goods, input.platformFeeRate ?? 0),
    multiply(goods, input.paymentFeeRate ?? 0),
  );

  const total = add(add(goods, shippingCost), add(add(duties, taxes), fees));

  return {
    productCost,
    customizationCost,
    setupCost,
    shippingCost,
    duties,
    taxes,
    fees,
    total,
    perUnit: money(Math.ceil(total.amount / quantity), currency),
    // Never `confirmed` from this function. Only a supplier's reply earns that.
    confidence: unknowns.length === 0 ? "estimated" : "needs-confirmation",
    unknowns,
  };
}

/* --- Supplier scoring -------------------------------------------------------- */

export interface SupplierScore {
  supplierId: string;
  total: number;
  match: number;
  quality: number;
  reliability: number;
  price: number;
  speed: number;
  risk: RiskLevel;
  reasons: string[];
  concerns: string[];
}

/**
 * The weights, stated once and in the open.
 *
 * Price is 25 of 100. Quality and reliability together are 40. That ordering is
 * the point: a supplier who is cheapest and late is not a saving, and this is
 * the number that has to encode it rather than a sentence in a prompt.
 */
export const SCORE_WEIGHTS = {
  match: 25,
  quality: 20,
  reliability: 20,
  price: 25,
  speed: 10,
} as const;

/** How far a high-risk supplier is pushed down, whatever else they score. */
export const RISK_PENALTY = 35;

export interface ScoreInput {
  supplier: SupplierFacts;
  match: MatchResult;
  cost: LandedCost;
  /** The cheapest per-unit landed cost among the candidates, for comparison. */
  bestPerUnit: Money;
  request: ProcurementRequest;
}

export function scoreSupplier(input: ScoreInput): SupplierScore {
  const { supplier, match, cost, request } = input;
  const reasons: string[] = [];
  const concerns: string[] = [];

  /* Match ------------------------------------------------------------------ */
  const matchPoints = (match.score / 100) * SCORE_WEIGHTS.match;
  if (match.level === "exact") reasons.push("matches every stated requirement");
  else if (match.missed.length) concerns.push(`does not match: ${match.missed.join(", ")}`);

  /* Quality ---------------------------------------------------------------- */
  // No history is not good news and not bad news. An unproven supplier scores
  // the middle, and the sample-first policy is what resolves it.
  const shipped = supplier.completedOrders;
  const defectRate = shipped > 0 ? supplier.defectReports / shipped : null;
  const quality =
    defectRate === null
      ? SCORE_WEIGHTS.quality * 0.5
      : SCORE_WEIGHTS.quality * Math.max(0, 1 - defectRate * 4);

  if (defectRate === null) concerns.push("no delivery history with Brandora yet");
  else if (defectRate === 0 && shipped >= 5) reasons.push(`${shipped} orders, no defects reported`);
  else if (defectRate > 0.05) concerns.push(`defects reported on ${Math.round(defectRate * 100)}% of orders`);

  /* Reliability ------------------------------------------------------------ */
  const lateRate = shipped > 0 ? supplier.lateOrders / shipped : null;
  const reliability =
    lateRate === null
      ? SCORE_WEIGHTS.reliability * 0.5
      : SCORE_WEIGHTS.reliability * Math.max(0, 1 - lateRate * 3);

  if (lateRate !== null && lateRate === 0 && shipped >= 5) reasons.push("no late deliveries on record");
  else if (lateRate !== null && lateRate > 0.1) {
    concerns.push(`late on ${Math.round(lateRate * 100)}% of orders`);
  }
  if (supplier.disputes > 0) concerns.push(`${supplier.disputes} dispute(s) on record`);

  /* Price ------------------------------------------------------------------ */
  // Relative to the cheapest candidate, not absolute: 25 points for matching
  // the best price, falling away as the gap widens.
  const ratio = input.bestPerUnit.amount > 0 ? input.bestPerUnit.amount / cost.perUnit.amount : 1;
  const price = SCORE_WEIGHTS.price * Math.max(0, Math.min(1, ratio));
  if (ratio >= 0.999) reasons.push("lowest landed cost of the candidates");

  if (request.targetUnitPrice && cost.perUnit.amount > request.targetUnitPrice.amount) {
    concerns.push("above the target unit price");
  }
  if (request.maxBudget && cost.total.amount > request.maxBudget.amount) {
    concerns.push("above the stated budget");
  }

  /* Speed ------------------------------------------------------------------ */
  const days = supplier.leadTimeDays;
  let speed = SCORE_WEIGHTS.speed * 0.5;
  if (days !== undefined) {
    if (request.maxProductionDays !== undefined) {
      speed = days <= request.maxProductionDays ? SCORE_WEIGHTS.speed : 0;
      if (days > request.maxProductionDays) {
        concerns.push(`${days} days production, later than the ${request.maxProductionDays} asked for`);
      }
    } else {
      speed = SCORE_WEIGHTS.speed * Math.max(0, Math.min(1, 1 - (days - 7) / 60));
    }
  } else {
    concerns.push("production time not stated");
  }

  /* Risk ------------------------------------------------------------------- */
  const risk: RiskLevel =
    supplier.status === "blocked" || supplier.riskFlag
      ? "high"
      : supplier.status === "unverified" || shipped === 0 || supplier.disputes > 0
        ? "medium"
        : "low";

  if (supplier.riskFlag) concerns.push(`flagged: ${supplier.riskFlag}`);

  const raw = matchPoints + quality + reliability + price + speed;
  const total = Math.max(0, Math.round(risk === "high" ? raw - RISK_PENALTY : raw));

  return {
    supplierId: supplier.id,
    total,
    match: Math.round(matchPoints),
    quality: Math.round(quality),
    reliability: Math.round(reliability),
    price: Math.round(price),
    speed: Math.round(speed),
    risk,
    reasons,
    concerns,
  };
}

/* --- The shortlist ----------------------------------------------------------- */

export interface Candidate {
  supplier: SupplierFacts;
  offer: OfferFacts;
  product: { name: string; category: string; subcategory: string; material?: string; colors: readonly string[]; dimensions?: { volumeMl?: number } };
}

export interface ShortlistEntry {
  supplier: SupplierFacts;
  offer: OfferFacts;
  match: MatchResult;
  cost: LandedCost;
  score: SupplierScore;
}

export interface ShortlistOptions {
  dutyRate?: number;
  taxRate?: number;
  platformFeeRate?: number;
  paymentFeeRate?: number;
  /** §6: three to five, not everything. */
  limit?: number;
}

/**
 * Rank the candidates and return the few worth reading.
 *
 * Unsuitable offers are dropped rather than ranked last: a supplier who cannot
 * make the quantity is not a worse option, it is not an option, and listing
 * them invites someone to pick one.
 */
export function shortlist(
  request: ProcurementRequest,
  candidates: readonly Candidate[],
  options: ShortlistOptions = {},
): ShortlistEntry[] {
  const priced = candidates
    .filter((candidate) => candidate.supplier.status !== "blocked")
    .map((candidate) => ({
      candidate,
      match: matchOffer(request, candidate.offer, candidate.product),
      cost: landedCost({
        offer: candidate.offer,
        quantity: request.quantity,
        ...(options.dutyRate !== undefined ? { dutyRate: options.dutyRate } : {}),
        ...(options.taxRate !== undefined ? { taxRate: options.taxRate } : {}),
        ...(options.platformFeeRate !== undefined ? { platformFeeRate: options.platformFeeRate } : {}),
        ...(options.paymentFeeRate !== undefined ? { paymentFeeRate: options.paymentFeeRate } : {}),
      }),
    }))
    .filter((entry) => entry.match.level !== "unsuitable");

  if (priced.length === 0) return [];

  const bestPerUnit = priced.reduce(
    (best, entry) => (entry.cost.perUnit.amount < best.amount ? entry.cost.perUnit : best),
    priced[0]!.cost.perUnit,
  );

  return priced
    .map((entry) => ({
      supplier: entry.candidate.supplier,
      offer: entry.candidate.offer,
      match: entry.match,
      cost: entry.cost,
      score: scoreSupplier({
        supplier: entry.candidate.supplier,
        match: entry.match,
        cost: entry.cost,
        bestPerUnit,
        request,
      }),
    }))
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, options.limit ?? 5);
}

/* --- Authorization ----------------------------------------------------------- */

export interface AuthorizationDecision {
  autoApproved: boolean;
  requiresHuman: boolean;
  reason: string;
}

/**
 * Whether the agent may place this order itself.
 *
 * §10 sets a value threshold, and this adds the two conditions that matter as
 * much: a high-risk supplier and an unconfirmed price are both human decisions
 * whatever the amount. An agent authorised to spend $500 should still not spend
 * $12 with a supplier flagged for fraud.
 */
export function authorizeOrder(input: {
  total: Money;
  limit: Money;
  risk: RiskLevel;
  priceConfidence: PriceConfidence;
  sampleApproved?: boolean;
  newSupplier?: boolean;
}): AuthorizationDecision {
  if (input.total.currency !== input.limit.currency) {
    return {
      autoApproved: false,
      requiresHuman: true,
      reason: `the order is in ${input.total.currency} and the limit is set in ${input.limit.currency}`,
    };
  }
  if (input.risk === "high") {
    return { autoApproved: false, requiresHuman: true, reason: "the supplier is high risk" };
  }
  if (input.priceConfidence !== "confirmed") {
    return {
      autoApproved: false,
      requiresHuman: true,
      reason: "the price is an estimate — a supplier has not confirmed it",
    };
  }
  if (input.newSupplier && input.sampleApproved !== true) {
    return {
      autoApproved: false,
      requiresHuman: true,
      reason: "this supplier is new and no sample has been approved",
    };
  }
  if (input.total.amount > input.limit.amount) {
    return {
      autoApproved: false,
      requiresHuman: true,
      reason: `the order is above the ${input.limit.amount} ${input.limit.currency} auto-approval limit`,
    };
  }
  return {
    autoApproved: true,
    requiresHuman: false,
    reason: "within the limit, from a known supplier, at a confirmed price",
  };
}

/* --- Fraud and risk ---------------------------------------------------------- */

export interface RiskSignal {
  code: string;
  detail: string;
}

/**
 * Signals that a supplier should not be bought from automatically (§14).
 *
 * Each one is a thing that happened, not a hunch, so an operator reviewing the
 * flag can check it.
 */
export function riskSignals(input: {
  supplier: SupplierFacts;
  previousUnitCost?: Money;
  currentUnitCost?: Money;
}): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const { supplier } = input;

  if (supplier.status === "blocked") {
    signals.push({ code: "blocked", detail: "the supplier is blocked" });
  }
  if (supplier.riskFlag) {
    signals.push({ code: "flagged", detail: supplier.riskFlag });
  }
  if (supplier.completedOrders > 0 && supplier.disputes / supplier.completedOrders > 0.1) {
    signals.push({ code: "disputes", detail: "disputes on more than one order in ten" });
  }
  if (supplier.completedOrders > 0 && supplier.lateOrders / supplier.completedOrders > 0.3) {
    signals.push({ code: "late", detail: "late on more than three orders in ten" });
  }

  const previous = input.previousUnitCost;
  const current = input.currentUnitCost;
  if (previous && current && previous.currency === current.currency && previous.amount > 0) {
    const change = (current.amount - previous.amount) / previous.amount;
    // A third, either way, without an explanation is worth a person looking.
    if (Math.abs(change) >= 0.33) {
      signals.push({
        code: "price-jump",
        detail: `unit cost moved ${change > 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 100)}% since the last order`,
      });
    }
  }

  return signals;
}
