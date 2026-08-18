/**
 * What Brandora charges, and what Brandora keeps.
 *
 * ## The bug this replaces
 *
 * The previous engine added a rate to the goods and called it a margin:
 * `service = goods × 0.35`. That is a *markup*, it was applied to the goods
 * only, and the local-logistics line — a real cost — sat in the total as if it
 * were revenue. Configured at 35%, it returned 18.3% on a thirty-unit order,
 * 22.6% at two hundred and 23.5% at two thousand. The gap was worst on exactly
 * the small bakery order Brandora is built for.
 *
 * ## Markup and margin are not the same number
 *
 *   markup:       price = cost × (1 + r)      →  r = 0.35 gives 25.9% margin
 *   gross margin: price = cost ÷ (1 − r)      →  r = 0.35 gives 35.0% margin
 *
 * This module uses the second, on the *landed* cost — everything Brandora pays
 * out to put the box in the customer's hands.
 *
 * ## Where the payment fee goes
 *
 * The processor takes its cut of what the customer pays, not of what the goods
 * cost, so the fee is a function of the answer. Computing it on cost
 * understates it every time. Solving for price:
 *
 *   price × (1 − m) = cost_ex_fee + price × f
 *   price = cost_ex_fee ÷ (1 − m − f)
 *
 * which returns exactly `m` as the realised margin, fee included. There is a
 * test that recomputes it from the output rather than trusting this comment.
 *
 * ## Unknown is not zero
 *
 * A freight cost nobody has quoted is not free freight. Any missing component
 * is named in `unknowns`, left out of the total, and forces the quote to
 * `REVIEW_REQUIRED` — because a landed cost with an invented freight number is
 * worse than one that admits it does not know: the first gets approved.
 */

import {
  type CurrencyCode,
  type Money,
  ValidationError,
  add,
  money,
  multiply,
  roundUpTo,
  zero,
} from "@brandora/shared";

/* --- What an order costs Brandora ------------------------------------------ */

/**
 * A cost component that may not be known yet.
 *
 * `undefined` and zero are deliberately different things. Zero is "confirmed,
 * and it is nothing" — a supplier who threw in the printing plates. `undefined`
 * is "nobody has told us", and the two must never price the same.
 */
export type MaybeCost = Money | undefined;

export interface QuoteCostInput {
  currency: CurrencyCode;
  /** What the manufacturer charges for the goods themselves. Required. */
  product: Money;
  /** Printing, plates, custom colours. Zero when nothing was customised. */
  customization?: Money;
  /** Manufacturer → destination. */
  internationalFreight?: MaybeCost;
  /** Customs, duty, clearance, port handling. */
  customsAndHandling?: MaybeCost;
  /** Brandora → the customer's door. */
  localDelivery?: MaybeCost;
}

/* --- The rules an administrator sets --------------------------------------- */

export interface MarginBand {
  /**
   * The upper bound of this band, in minor units of the settings currency.
   * `null` means "everything above the previous band".
   */
  upToCost: number | null;
  targetMargin: number;
  label: string;
}

export interface PricingPolicy {
  currency: CurrencyCode;
  /**
   * Bands, smallest first. A small order carries more fixed cost per unit and
   * more risk, so it carries a higher target margin — which is why this is a
   * table rather than one number.
   */
  bands: readonly MarginBand[];
  /** Applied instead of the band when the customer has ordered before. */
  repeatCustomerMargin?: number;
  /** Below this realised margin the quote is never sent automatically. */
  minimumMargin: number;
  /** Below this customer price the quote is never sent automatically. */
  minimumOrderValue: Money;
  /** Below this gross profit the quote is never sent automatically. */
  minimumGrossProfit: Money;
  /** Reserve against damage, replacement and logistics surprises. */
  contingencyRate: number;
  /** What the processor takes from the customer's payment. */
  paymentFeeRate: number;
  /** Round the customer price up to a tidy figure. 0 disables. */
  roundingStep?: number;
  /** Sample cost comes off the production order when true. */
  sampleCreditedToProduction?: boolean;
}

/* --- The answer ------------------------------------------------------------- */

export interface QuoteCostBreakdown {
  product: Money;
  customization: Money;
  internationalFreight: Money;
  customsAndHandling: Money;
  localDelivery: Money;
  contingency: Money;
  paymentFee: Money;
  /** Everything above. What the order actually costs Brandora. */
  total: Money;
}

export type QuoteStatus = "OK" | "REVIEW_REQUIRED";

export interface QuotePricing {
  cost: QuoteCostBreakdown;
  /** Components nobody has quoted. Excluded from the total, never guessed. */
  unknowns: string[];
  /** Which band applied, for the admin view. */
  bandLabel: string;
  targetMargin: number;
  customerPrice: Money;
  grossProfit: Money;
  /** Realised, recomputed from the figures above — not the target repeated. */
  grossMargin: number;
  status: QuoteStatus;
  /** Why it needs a human, in sentences an operator can act on. */
  flags: string[];
}

/** The band whose ceiling the cost falls under. */
export function bandFor(costTotal: number, bands: readonly MarginBand[]): MarginBand {
  for (const band of bands) {
    if (band.upToCost === null || costTotal <= band.upToCost) return band;
  }
  const last = bands[bands.length - 1];
  if (!last) throw new ValidationError("pricing", "no margin bands are configured");
  return last;
}

/**
 * Price an order from its costs.
 *
 * `repeatCustomer` selects the loyalty margin over the band. It is a fact about
 * the account, passed in rather than inferred here, because "has ordered
 * before" is a question about order history and this module knows nothing
 * about orders.
 */
export function priceQuote(
  input: QuoteCostInput,
  policy: PricingPolicy,
  options: { repeatCustomer?: boolean } = {},
): QuotePricing {
  const currency = input.currency;
  if (policy.currency !== currency) {
    throw new ValidationError("currency", `policy is in ${policy.currency}, order is in ${currency}`);
  }
  if (input.product.currency !== currency) {
    throw new ValidationError("currency", "the product cost must be in the order's currency");
  }

  const unknowns: string[] = [];

  /** Take a component, or record why it is missing and treat it as absent. */
  const componentOr = (value: MaybeCost, whatIsMissing: string): Money => {
    if (value === undefined) {
      unknowns.push(whatIsMissing);
      return zero(currency);
    }
    if (value.currency !== currency) {
      throw new ValidationError("currency", `${whatIsMissing} is in the wrong currency`);
    }
    return value;
  };

  const product = input.product;
  const customization = input.customization ?? zero(currency);
  const internationalFreight = componentOr(
    input.internationalFreight,
    "international freight — no carrier or supplier has quoted it",
  );
  const customsAndHandling = componentOr(
    input.customsAndHandling,
    "customs and handling — the destination's charges are not recorded",
  );
  const localDelivery = componentOr(
    input.localDelivery,
    "local delivery — no rate is configured for this destination",
  );

  const direct = add(
    add(product, customization),
    add(internationalFreight, add(customsAndHandling, localDelivery)),
  );

  // The reserve is a cost, not a margin. It sits inside what Brandora must
  // recover, so a replacement box does not come out of the profit.
  const contingency = multiply(direct, policy.contingencyRate);
  const costExFee = add(direct, contingency);

  const band = options.repeatCustomer && policy.repeatCustomerMargin !== undefined
    ? { upToCost: null, targetMargin: policy.repeatCustomerMargin, label: "repeat customer" }
    : bandFor(costExFee.amount, policy.bands);

  const targetMargin = band.targetMargin;
  const denominator = 1 - targetMargin - policy.paymentFeeRate;
  if (denominator <= 0) {
    throw new ValidationError(
      "pricing",
      `a target margin of ${targetMargin} with a ${policy.paymentFeeRate} payment fee leaves nothing to price against`,
    );
  }

  // Rounding goes *up*, so it can only ever help the margin.
  const rawPrice = Math.ceil(costExFee.amount / denominator);
  const customerPrice = roundUpTo(money(rawPrice, currency), policy.roundingStep ?? 0);

  const paymentFee = multiply(customerPrice, policy.paymentFeeRate);
  const total = add(costExFee, paymentFee);
  const grossProfit = money(customerPrice.amount - total.amount, currency);
  const grossMargin = customerPrice.amount === 0 ? 0 : grossProfit.amount / customerPrice.amount;

  /* --- Does a person need to look at this? ------------------------------- */

  const flags: string[] = [];

  if (unknowns.length > 0) {
    flags.push(
      `${unknowns.length} cost component(s) are not known, so this price does not cover the whole order.`,
    );
  }
  if (grossMargin < policy.minimumMargin) {
    flags.push(
      `Gross margin is ${(grossMargin * 100).toFixed(1)}%, below the ${(policy.minimumMargin * 100).toFixed(1)}% minimum.`,
    );
  }
  if (customerPrice.amount < policy.minimumOrderValue.amount) {
    flags.push(
      `The order is below the minimum order value of ${policy.minimumOrderValue.amount} ${currency}.`,
    );
  }
  if (grossProfit.amount < policy.minimumGrossProfit.amount) {
    flags.push(
      `Gross profit is ${grossProfit.amount} ${currency}, below the ${policy.minimumGrossProfit.amount} minimum.`,
    );
  }

  return {
    cost: {
      product,
      customization,
      internationalFreight,
      customsAndHandling,
      localDelivery,
      contingency,
      paymentFee,
      total,
    },
    unknowns,
    bandLabel: band.label,
    targetMargin,
    customerPrice,
    grossProfit,
    grossMargin,
    // An unprofitable order is never accepted on its own. A quote that a
    // person has not seen is a quote Brandora may not be able to honour.
    status: flags.length > 0 ? "REVIEW_REQUIRED" : "OK",
    flags,
  };
}

/* --- Defaults --------------------------------------------------------------- */

/**
 * The starting policy.
 *
 * Real numbers, chosen from the brief rather than invented: small and riskier
 * orders carry 32%, medium 27%, large 22%, repeat customers 22%. They are the
 * *defaults*, editable by an administrator without a deploy — a margin that
 * only a developer can change is a margin nobody tunes.
 *
 * The payment fee is 0 here on purpose. Paystack's rate depends on the account
 * and the method, and putting a plausible 1.5% in as a placeholder is the same
 * mistake as an invented freight rate. It is entered once, from the contract.
 */
export function defaultPolicy(currency: CurrencyCode = "XOF"): PricingPolicy {
  return {
    currency,
    bands: [
      { upToCost: 50_000, targetMargin: 0.32, label: "small order" },
      { upToCost: 500_000, targetMargin: 0.27, label: "medium order" },
      { upToCost: null, targetMargin: 0.22, label: "large order" },
    ],
    repeatCustomerMargin: 0.22,
    minimumMargin: 0.18,
    minimumOrderValue: money(15_000, currency),
    minimumGrossProfit: money(5_000, currency),
    contingencyRate: 0.05,
    paymentFeeRate: 0,
    roundingStep: 100,
    sampleCreditedToProduction: true,
  };
}

/* --- Storage shape ---------------------------------------------------------- */

/**
 * The stored form of a policy: rates and plain integers, no Money objects.
 *
 * The database package cannot import this module, so the two shapes are
 * converted at the edge rather than shared. These two functions are that edge,
 * and they are inverses — a test asserts the round trip.
 */
export interface StoredPolicy {
  currency: CurrencyCode;
  bands: MarginBand[];
  repeatCustomerMargin?: number;
  minimumMargin: number;
  minimumOrderValue: number;
  minimumGrossProfit: number;
  contingencyRate: number;
  paymentFeeRate: number;
  roundingStep: number;
  sampleCreditedToProduction: boolean;
}

export function policyToRow(policy: PricingPolicy): StoredPolicy {
  return {
    currency: policy.currency,
    bands: [...policy.bands],
    ...(policy.repeatCustomerMargin !== undefined
      ? { repeatCustomerMargin: policy.repeatCustomerMargin }
      : {}),
    minimumMargin: policy.minimumMargin,
    minimumOrderValue: policy.minimumOrderValue.amount,
    minimumGrossProfit: policy.minimumGrossProfit.amount,
    contingencyRate: policy.contingencyRate,
    paymentFeeRate: policy.paymentFeeRate,
    roundingStep: policy.roundingStep ?? 0,
    sampleCreditedToProduction: policy.sampleCreditedToProduction ?? false,
  };
}

export function policyFromRow(row: StoredPolicy): PricingPolicy {
  return {
    currency: row.currency,
    bands: row.bands,
    ...(row.repeatCustomerMargin !== undefined
      ? { repeatCustomerMargin: row.repeatCustomerMargin }
      : {}),
    minimumMargin: row.minimumMargin,
    minimumOrderValue: money(row.minimumOrderValue, row.currency),
    minimumGrossProfit: money(row.minimumGrossProfit, row.currency),
    contingencyRate: row.contingencyRate,
    paymentFeeRate: row.paymentFeeRate,
    roundingStep: row.roundingStep,
    sampleCreditedToProduction: row.sampleCreditedToProduction,
  };
}
