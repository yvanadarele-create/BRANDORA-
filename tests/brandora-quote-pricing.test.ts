/**
 * The pricing engine.
 *
 * Every margin assertion here recomputes the margin from the returned figures
 * rather than reading `grossMargin` back. If the formula and the breakdown ever
 * disagree, the disagreement is the bug, and a test that trusts the engine's
 * own summary would report a healthy 30% while the breakdown said otherwise.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { money } from "@brandora/shared";
import {
  type PricingPolicy,
  bandFor,
  defaultPolicy,
  priceQuote,
} from "@brandora/server";

const XOF = "XOF" as const;

/** A policy with no rounding, so the arithmetic is exact and legible. */
const policy: PricingPolicy = {
  ...defaultPolicy(XOF),
  roundingStep: 0,
  paymentFeeRate: 0.015,
};

/** Everything known, so nothing is flagged for a missing component. */
const complete = (product: number, customization = 0) => ({
  currency: XOF,
  product: money(product, XOF),
  customization: money(customization, XOF),
  internationalFreight: money(20_000, XOF),
  customsAndHandling: money(8_000, XOF),
  localDelivery: money(3_000, XOF),
});

/** The margin a customer's money actually produces. */
const realised = (result: ReturnType<typeof priceQuote>) =>
  (result.customerPrice.amount - result.cost.total.amount) / result.customerPrice.amount;

describe("gross margin, not markup", () => {
  it("hits the target margin, recomputed from the breakdown", () => {
    const result = priceQuote(complete(400_000), policy);

    assert.equal(result.targetMargin, 0.27, "a 431k cost is a medium order");
    assert.ok(
      Math.abs(realised(result) - 0.27) < 0.001,
      `realised ${(realised(result) * 100).toFixed(2)}% should be 27%`,
    );
  });

  it("is the margin formula, not the markup one", () => {
    // cost ÷ (1 − m) and cost × (1 + m) differ by more than rounding, and the
    // old engine used the second. 100000 at 30%: 142857 against 130000.
    const flat: PricingPolicy = {
      ...policy,
      paymentFeeRate: 0,
      contingencyRate: 0,
      bands: [{ upToCost: null, targetMargin: 0.3, label: "flat" }],
      minimumMargin: 0,
      minimumOrderValue: money(0, XOF),
      minimumGrossProfit: money(0, XOF),
    };
    const result = priceQuote(
      { currency: XOF, product: money(100_000, XOF), internationalFreight: money(0, XOF),
        customsAndHandling: money(0, XOF), localDelivery: money(0, XOF) },
      flat,
    );

    assert.equal(result.customerPrice.amount, 142_858, "100000 ÷ 0.7, rounded up");
    assert.notEqual(result.customerPrice.amount, 130_000, "that would be markup");
  });

  it("the worked example from the brief: 80 at 30% is 114.29", () => {
    const dollars: PricingPolicy = {
      ...policy,
      currency: "USD",
      paymentFeeRate: 0,
      contingencyRate: 0,
      bands: [{ upToCost: null, targetMargin: 0.3, label: "flat" }],
      minimumMargin: 0,
      minimumOrderValue: money(0, "USD"),
      minimumGrossProfit: money(0, "USD"),
      roundingStep: 0,
    };
    const result = priceQuote(
      { currency: "USD", product: money(8_000, "USD"), internationalFreight: money(0, "USD"),
        customsAndHandling: money(0, "USD"), localDelivery: money(0, "USD") },
      dollars,
    );
    // USD has cents, so 8000 minor units is $80.00 and 11429 is $114.29.
    assert.equal(result.customerPrice.amount, 11_429);
  });
});

describe("the payment fee comes out of the customer's payment", () => {
  it("still lands on the target margin once the fee is taken", () => {
    const result = priceQuote(complete(400_000), policy);

    // The fee is a share of the price, not of the cost. Charging it on cost
    // understates it and quietly eats the margin.
    const expectedFee = Math.round(result.customerPrice.amount * policy.paymentFeeRate);
    assert.ok(
      Math.abs(result.cost.paymentFee.amount - expectedFee) <= 1,
      `fee ${result.cost.paymentFee.amount} should be ${expectedFee}`,
    );
    assert.ok(Math.abs(realised(result) - result.targetMargin) < 0.001);
  });

  it("a higher fee raises the price rather than eating the margin", () => {
    const cheap = priceQuote(complete(400_000), { ...policy, paymentFeeRate: 0 });
    const dear = priceQuote(complete(400_000), { ...policy, paymentFeeRate: 0.05 });

    assert.ok(dear.customerPrice.amount > cheap.customerPrice.amount);
    assert.ok(Math.abs(realised(dear) - realised(cheap)) < 0.002, "the margin holds");
  });
});

describe("bands", () => {
  it("a small order carries the higher margin", () => {
    // `complete()` carries 31 000 of logistics on its own, so a "small" order
    // needs a small *landed* cost, not merely a small product cost. That is the
    // point of banding on cost rather than on the goods.
    const small = priceQuote(
      { currency: XOF, product: money(9_000, XOF), internationalFreight: money(2_000, XOF),
        customsAndHandling: money(1_000, XOF), localDelivery: money(3_000, XOF) },
      policy,
    );
    const large = priceQuote(complete(2_000_000), policy);

    assert.equal(small.bandLabel, "small order");
    assert.equal(large.bandLabel, "large order");
    assert.ok(small.targetMargin > large.targetMargin);
  });

  it("a repeat customer overrides the band", () => {
    const once = priceQuote(complete(9_000), policy);
    const again = priceQuote(complete(9_000), policy, { repeatCustomer: true });

    assert.equal(again.bandLabel, "repeat customer");
    assert.ok(again.customerPrice.amount < once.customerPrice.amount, "loyalty is cheaper");
  });

  it("bandFor picks by ceiling, and the last band catches everything", () => {
    const bands = policy.bands;
    assert.equal(bandFor(1, bands).label, "small order");
    assert.equal(bandFor(50_000, bands).label, "small order", "the boundary is inclusive");
    assert.equal(bandFor(50_001, bands).label, "medium order");
    assert.equal(bandFor(9_999_999_999, bands).label, "large order");
  });
});

describe("unknown is not zero", () => {
  it("a missing freight cost is named, not guessed", () => {
    const result = priceQuote(
      { currency: XOF, product: money(400_000, XOF), customsAndHandling: money(8_000, XOF),
        localDelivery: money(3_000, XOF) },
      policy,
    );

    assert.equal(result.unknowns.length, 1);
    assert.match(result.unknowns[0]!, /freight/);
    assert.equal(result.cost.internationalFreight.amount, 0, "excluded, not invented");
    assert.equal(result.status, "REVIEW_REQUIRED");
  });

  it("a confirmed zero is not an unknown", () => {
    // A supplier who threw in the plates is a fact. It must not read the same
    // as nobody having asked.
    const result = priceQuote(complete(400_000, 0), { ...policy, contingencyRate: 0 });
    assert.deepEqual(result.unknowns, []);
    assert.equal(result.status, "OK");
  });

  it("every missing component is listed, not just the first", () => {
    const result = priceQuote({ currency: XOF, product: money(400_000, XOF) }, policy);
    assert.equal(result.unknowns.length, 3);
    assert.equal(result.status, "REVIEW_REQUIRED");
  });
});

describe("an unprofitable order is never accepted quietly", () => {
  it("below the minimum gross profit it is flagged for review", () => {
    const result = priceQuote(complete(1_000), {
      ...policy,
      minimumGrossProfit: money(1_000_000, XOF),
    });

    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.ok(result.flags.some((flag) => /gross profit/i.test(flag)), result.flags.join(" | "));
  });

  it("below the minimum order value it is flagged", () => {
    const result = priceQuote(complete(1_000), { ...policy, minimumOrderValue: money(500_000, XOF) });
    assert.ok(result.flags.some((flag) => /minimum order value/i.test(flag)));
  });

  it("below the minimum margin it is flagged", () => {
    const result = priceQuote(complete(400_000), { ...policy, minimumMargin: 0.9 });
    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.ok(result.flags.some((flag) => /margin/i.test(flag)));
  });

  it("a healthy order needs no review", () => {
    const result = priceQuote(complete(400_000), policy);
    assert.equal(result.status, "OK");
    assert.deepEqual(result.flags, []);
  });
});

describe("the contingency reserve", () => {
  it("is a cost, so it does not come out of the margin", () => {
    const without = priceQuote(complete(400_000), { ...policy, contingencyRate: 0 });
    const with5 = priceQuote(complete(400_000), { ...policy, contingencyRate: 0.05 });

    assert.ok(with5.cost.contingency.amount > 0);
    assert.ok(with5.customerPrice.amount > without.customerPrice.amount, "the customer covers it");
    assert.ok(
      Math.abs(realised(with5) - realised(without)) < 0.002,
      "and the margin is unchanged either way",
    );
  });

  it("is configurable rather than a hardcoded percentage", () => {
    const a = priceQuote(complete(400_000), { ...policy, contingencyRate: 0.02 });
    const b = priceQuote(complete(400_000), { ...policy, contingencyRate: 0.2 });
    assert.ok(b.cost.contingency.amount > a.cost.contingency.amount * 5);
  });
});

describe("the breakdown reconciles", () => {
  it("price minus every cost line equals the gross profit", () => {
    const result = priceQuote(complete(400_000, 25_000), policy);
    const { cost } = result;

    const summed =
      cost.product.amount +
      cost.customization.amount +
      cost.internationalFreight.amount +
      cost.customsAndHandling.amount +
      cost.localDelivery.amount +
      cost.contingency.amount +
      cost.paymentFee.amount;

    assert.equal(summed, cost.total.amount, "the lines must sum to the total");
    assert.equal(result.customerPrice.amount - cost.total.amount, result.grossProfit.amount);
  });

  it("zero customisation adds nothing", () => {
    const plain = priceQuote(complete(400_000, 0), policy);
    assert.equal(plain.cost.customization.amount, 0);
  });

  it("rounding up can only help the margin", () => {
    const rounded = priceQuote(complete(400_000), { ...policy, roundingStep: 1_000 });
    assert.equal(rounded.customerPrice.amount % 1_000, 0);
    assert.ok(realised(rounded) >= rounded.targetMargin - 0.001);
  });
});

describe("refusals", () => {
  /*
   * These assert on `technicalDetail`, not on `message`.
   *
   * A BrandoraError's message is the sentence a customer sees, and it is
   * deliberately the same generic line for every validation failure — that
   * wall is the point of the class. The reason an operator needs lives on
   * `technicalDetail`, so that is what a test about the reason must read.
   */
  const detailOf = (fn: () => unknown): string => {
    try {
      fn();
    } catch (err) {
      return (err as { technicalDetail?: string }).technicalDetail ?? String(err);
    }
    throw new Error("expected a throw, and nothing was thrown");
  };

  it("a margin plus fee of 100% or more is refused rather than dividing by zero", () => {
    const detail = detailOf(() =>
      priceQuote(complete(400_000), {
        ...policy,
        bands: [{ upToCost: null, targetMargin: 0.99, label: "impossible" }],
        paymentFeeRate: 0.02,
      }),
    );
    assert.match(detail, /leaves nothing to price against/);
  });

  it("a mismatched currency is refused", () => {
    const detail = detailOf(() => priceQuote({ ...complete(400_000), currency: "USD" }, policy));
    assert.match(detail, /policy is in XOF/);
  });
});
