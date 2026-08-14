/**
 * The procurement agent.
 *
 * Two claims are worth testing and everything here serves one of them.
 *
 * **It cannot invent a supplier.** The model is used to read a sentence and for
 * nothing else. These tests hand it deliberately badly-behaved replies —
 * inventing a quantity, inventing a destination, naming a supplier — and check
 * what reaches the report. Candidates come from the database, so a database
 * with no suppliers produces a report that says so, not a plausible list.
 *
 * **The best supplier is not the cheapest supplier.** The ranking is supposed
 * to prefer a reliable exact match over a cheap partial one, and to *say so*
 * whenever it does — because the moment the recommendation is not the cheapest
 * row is the moment somebody overrules it.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type CatalogueProduct,
  type ProcurementRequest,
  buildReport,
  gatherCandidates,
  parseExtraction,
  shortlist,
  sourceFromBrief,
} from "@brandora/server";
import { type Repositories, createRepositories, openSqlite } from "@brandora/database";
import type { StrategyProvider } from "@brandora/brand-engine";

class ScriptedProvider implements StrategyProvider {
  lastPrompt: { system: string; user: string } | null = null;
  constructor(private readonly reply: string) {}
  async complete(input: { system: string; user: string }): Promise<string> {
    this.lastPrompt = { system: input.system, user: input.user };
    return this.reply;
  }
}

const CATALOGUE: CatalogueProduct[] = [
  {
    id: "prd_cup_kraft_250",
    name: "Kraft paper cup",
    category: "tableware",
    subcategory: "cup",
    material: "kraft paper",
    colors: ["kraft"],
    dimensions: { volumeMl: 250 },
  },
  {
    id: "prd_bag_kraft_small",
    name: "Kraft paper bag",
    category: "packaging",
    subcategory: "bag",
    material: "kraft paper",
    colors: ["kraft"],
  },
];

const fresh = () => new Date().toISOString();

/* --- Reading the brief ------------------------------------------------------ */

describe("turning a sentence into a request", () => {
  it("reads what the customer actually said", () => {
    const request = parseExtraction(
      JSON.stringify({
        productType: "kraft paper cup",
        material: "kraft paper",
        capacityMl: 250,
        quantity: 500,
        targetUnitPriceMinor: 400,
        currency: "XOF",
        destinationCountry: "CI",
        destinationCity: "Abidjan",
        customization: ["logo print"],
      }),
    );

    assert.equal(request.productType, "kraft paper cup");
    assert.equal(request.quantity, 500);
    assert.equal(request.destinationCountry, "CI");
    // 400 francs is 400. XOF has no decimal places, and a × 100 here is the
    // single most expensive bug available in this codebase.
    assert.equal(request.targetUnitPrice?.amount, 400);
    assert.equal(request.targetUnitPrice?.currency, "XOF");
    assert.deepEqual(request.customization, ["logo print"]);
  });

  it("survives a model that wraps its JSON in a fence", () => {
    const request = parseExtraction('```json\n{"productType":"cup","quantity":30}\n```');
    assert.equal(request.productType, "cup");
    assert.equal(request.quantity, 30);
  });

  it("drops a field the model returned as the wrong type", () => {
    const request = parseExtraction(
      JSON.stringify({ productType: "cup", quantity: "lots", capacityMl: null, customization: "print" }),
    );
    assert.equal(request.productType, "cup");
    // Absent, not zero, not defaulted. missingEssentials then asks for it.
    assert.equal(request.quantity, undefined);
    assert.equal(request.capacityMl, undefined);
    assert.equal(request.customization, undefined);
  });

  it("drops a country the model wrote out in words", () => {
    // "Ivory Coast" is a string no shipping table can look up. Dropped rather
    // than stored, so the agent asks instead of quoting for nowhere.
    const request = parseExtraction(JSON.stringify({ productType: "cup", destinationCountry: "Ivory Coast" }));
    assert.equal(request.destinationCountry, undefined);
    assert.equal(parseExtraction(JSON.stringify({ destinationCountry: "ci" })).destinationCountry, "CI");
  });

  it("refuses a reply with no JSON in it at all", () => {
    assert.throws(() => parseExtraction("I would recommend Shenzhen Cup Factory."));
  });
});

/* --- Nothing to source from ------------------------------------------------- */

describe("the agent asks rather than guessing", () => {
  it("names what is missing instead of filling it in", async () => {
    const db = openSqlite(":memory:");
    const report = await sourceFromBrief({
      repos: createRepositories(db),
      brief: "I need some cups",
      provider: new ScriptedProvider(JSON.stringify({ productType: "cup" })),
      catalogue: CATALOGUE,
    });

    assert.deepEqual(report.missing, ["how many", "where it ships to"]);
    assert.deepEqual(report.options, []);
    assert.match(report.nextStep, /Ask the customer/);
    await db.close();
  });

  it("says nobody offers it rather than producing a supplier", async () => {
    const db = openSqlite(":memory:");
    const report = await sourceFromBrief({
      repos: createRepositories(db),
      // The model names a supplier, a price and a lead time. None of it is read.
      provider: new ScriptedProvider(
        JSON.stringify({
          productType: "kraft paper cup",
          quantity: 500,
          destinationCountry: "CI",
          notes: "Shenzhen Cup Factory can do these at 180 XOF in 12 days",
        }),
      ),
      brief: "500 kraft cups to Abidjan",
      catalogue: CATALOGUE,
    });

    assert.deepEqual(report.options, []);
    assert.equal(report.considered, 0);
    assert.match(report.nextStep, /No supplier in Brandora's database offers this/);
    // The model's sentence is carried as a note on what was *asked for*, and
    // nothing in the report presents it as a supplier, a price or a lead time.
    assert.equal(report.recommendation, null);
    assert.equal(JSON.stringify(report.options).includes("Shenzhen"), false);
    await db.close();
  });
});

/* --- Candidates come from the database -------------------------------------- */

async function withSuppliers(): Promise<{ repos: Repositories; close(): Promise<void> }> {
  const db = openSqlite(":memory:");
  const repos = createRepositories(db);
  return { repos, close: () => db.close() };
}

describe("candidates are read, never generated", () => {
  it("gathers only offers recorded against a real product", async () => {
    const { repos, close } = await withSuppliers();
    const supplier = await repos.suppliers.create({ name: "Yiwu Pack", platform: "alibaba", categories: ["tableware"] });
    await repos.supplierOffers.save({
      supplierId: supplier.id, productId: "prd_cup_kraft_250",
      unitCost: 160, currency: "XOF", minimumOrder: 100, availableQuantity: 50_000,
      productionDays: 10, shippingCost: 90_000, lastCheckedAt: fresh(),
    });
    // An offer for something not in the catalogue is invisible to the agent.
    await repos.supplierOffers.save({
      supplierId: supplier.id, productId: "prd_not_in_catalogue",
      unitCost: 1, currency: "XOF", lastCheckedAt: fresh(),
    });

    const request: ProcurementRequest = {
      productType: "kraft paper cup", quantity: 500, destinationCountry: "CI",
    };
    const candidates = await gatherCandidates(repos, request, CATALOGUE);

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.offer.productId, "prd_cup_kraft_250");
    await close();
  });

  it("does not match a kraft bag to a request for a kraft cup", async () => {
    const { repos, close } = await withSuppliers();
    const supplier = await repos.suppliers.create({ name: "Bags Only", platform: "alibaba" });
    await repos.supplierOffers.save({
      supplierId: supplier.id, productId: "prd_bag_kraft_small",
      unitCost: 90, currency: "XOF", lastCheckedAt: fresh(),
    });

    const candidates = await gatherCandidates(
      repos,
      { productType: "kraft cup", quantity: 500, destinationCountry: "CI" },
      CATALOGUE,
    );
    assert.deepEqual(candidates, []);
    await close();
  });

  it("never returns a blocked supplier", async () => {
    const { repos, close } = await withSuppliers();
    const supplier = await repos.suppliers.create({ name: "Blocked Co", platform: "alibaba" });
    await repos.supplierOffers.save({
      supplierId: supplier.id, productId: "prd_cup_kraft_250",
      unitCost: 10, currency: "XOF", minimumOrder: 1, availableQuantity: 99_999, lastCheckedAt: fresh(),
    });
    await repos.suppliers.setStatus(supplier.id, "blocked", "chargeback");

    const candidates = await gatherCandidates(
      repos,
      { productType: "kraft paper cup", quantity: 500, destinationCountry: "CI" },
      CATALOGUE,
    );
    // Cheapest by far, and still not an option. A blocked supplier is not a
    // worse choice, it is not a choice.
    assert.deepEqual(candidates, []);
    await close();
  });

  it("does not offer a supplier whose minimum the quantity does not meet", async () => {
    const { repos, close } = await withSuppliers();
    const supplier = await repos.suppliers.create({ name: "Big MOQ", platform: "alibaba" });
    await repos.supplierOffers.save({
      supplierId: supplier.id, productId: "prd_cup_kraft_250",
      unitCost: 80, currency: "XOF", minimumOrder: 10_000, availableQuantity: 99_999, lastCheckedAt: fresh(),
    });

    const candidates = await gatherCandidates(
      repos,
      { productType: "kraft paper cup", quantity: 500, destinationCountry: "CI" },
      CATALOGUE,
    );
    assert.deepEqual(candidates, []);
    await close();
  });
});

/* --- The best supplier is not the cheapest supplier ------------------------- */

describe("ranking", () => {
  const request: ProcurementRequest = {
    productType: "kraft paper cup",
    material: "kraft paper",
    capacityMl: 250,
    quantity: 1_000,
    destinationCountry: "CI",
  };

  /** Two suppliers: one cheap and unreliable, one dearer with a clean record. */
  async function twoSuppliers() {
    const { repos, close } = await withSuppliers();

    const cheap = await repos.suppliers.create({
      name: "Cheapest Ltd", platform: "alibaba", categories: ["tableware"], leadTimeDays: 40,
    });
    // Recorded outcomes: late on half its orders, disputes on a fifth.
    for (let i = 0; i < 10; i += 1) await repos.suppliers.recordOutcome(cheap.id, { completed: true });
    for (let i = 0; i < 5; i += 1) await repos.suppliers.recordOutcome(cheap.id, { late: true });
    for (let i = 0; i < 2; i += 1) await repos.suppliers.recordOutcome(cheap.id, { dispute: true });
    await repos.suppliers.markVerified(cheap.id);

    const solid = await repos.suppliers.create({
      name: "Steady Works", platform: "alibaba", categories: ["tableware"], leadTimeDays: 12,
    });
    for (let i = 0; i < 20; i += 1) await repos.suppliers.recordOutcome(solid.id, { completed: true });
    await repos.suppliers.markVerified(solid.id);

    await repos.supplierOffers.save({
      supplierId: cheap.id, productId: "prd_cup_kraft_250", unitCost: 100, currency: "XOF",
      minimumOrder: 100, availableQuantity: 100_000, productionDays: 40,
      shippingCost: 100_000, lastCheckedAt: fresh(),
    });
    await repos.supplierOffers.save({
      supplierId: solid.id, productId: "prd_cup_kraft_250", unitCost: 145, currency: "XOF",
      minimumOrder: 100, availableQuantity: 100_000, productionDays: 12,
      shippingCost: 100_000, lastCheckedAt: fresh(),
    });

    return { repos, close, cheap, solid };
  }

  it("prefers the reliable supplier over the cheaper one", async () => {
    const { repos, close, solid } = await twoSuppliers();
    const candidates = await gatherCandidates(repos, request, CATALOGUE);
    const entries = shortlist(request, candidates);

    assert.equal(entries.length, 2);
    assert.equal(
      entries[0]?.supplier.id,
      solid.id,
      "the cheapest supplier won despite being late on half its orders",
    );
    await close();
  });

  it("says out loud that the recommendation is not the cheapest", async () => {
    const { repos, close } = await twoSuppliers();
    const candidates = await gatherCandidates(repos, request, CATALOGUE);
    const report = buildReport(request, shortlist(request, candidates), candidates.length);

    assert.ok(report.costOfRecommendation, "the report hid the cheaper option");
    assert.match(report.costOfRecommendation, /Cheapest Ltd is cheaper/);
    assert.match(report.costOfRecommendation, /best supplier is not the cheapest supplier/);

    // And the cheaper row is still in the list, flagged, so nobody has to take
    // the recommendation on faith.
    const cheapest = report.options.find((option) => option.cheapest);
    assert.ok(cheapest);
    assert.equal(cheapest.supplierName, "Cheapest Ltd");
    assert.equal(cheapest.recommended, false);
    await close();
  });

  it("shows the score in parts, so it can be argued with", async () => {
    const { repos, close } = await twoSuppliers();
    const candidates = await gatherCandidates(repos, request, CATALOGUE);
    const report = buildReport(request, shortlist(request, candidates), candidates.length);

    const top = report.options[0];
    assert.ok(top);
    assert.equal(typeof top.score.breakdown.price, "number");
    assert.equal(typeof top.score.breakdown.reliability, "number");
    assert.ok(top.score.reasons.length > 0, "a recommendation with no reason is a black box");
    await close();
  });

  it("carries the risk signals it found, as things that happened", async () => {
    const { repos, close } = await twoSuppliers();
    const candidates = await gatherCandidates(repos, request, CATALOGUE);
    const report = buildReport(request, shortlist(request, candidates), candidates.length);

    const cheap = report.options.find((option) => option.supplierName === "Cheapest Ltd");
    assert.ok(cheap);
    const codes = cheap.risk.signals.map((signal) => signal.code);
    assert.ok(codes.includes("late"), `expected a late signal, got ${codes}`);
    assert.ok(codes.includes("disputes"), `expected a disputes signal, got ${codes}`);
    for (const signal of cheap.risk.signals) {
      assert.ok(signal.detail.length > 0, "a risk flag with no detail is a hunch");
    }
    await close();
  });

  it("proposes a sample rather than an order", async () => {
    const { repos, close } = await twoSuppliers();
    const candidates = await gatherCandidates(repos, request, CATALOGUE);
    const report = buildReport(request, shortlist(request, candidates), candidates.length);

    assert.match(report.nextStep, /sample/i);
    assert.match(report.nextStep, /Nothing is ordered until a person approves it/);
    await close();
  });

  it("names the costs it could not calculate instead of treating them as zero", async () => {
    const { repos, close } = await withSuppliers();
    const supplier = await repos.suppliers.create({ name: "No Freight", platform: "alibaba" });
    // No shipping cost recorded.
    await repos.supplierOffers.save({
      supplierId: supplier.id, productId: "prd_cup_kraft_250", unitCost: 160, currency: "XOF",
      minimumOrder: 100, availableQuantity: 100_000, lastCheckedAt: fresh(),
    });

    const candidates = await gatherCandidates(repos, request, CATALOGUE);
    const report = buildReport(request, shortlist(request, candidates), candidates.length);

    const option = report.options[0];
    assert.ok(option);
    assert.ok(option.unknowns.length > 0, "a missing freight cost was silently treated as zero");
    assert.ok(report.notes.some((note) => /incomplete, not final/.test(note)));
    await close();
  });

  it("returns at most five options", async () => {
    const { repos, close } = await withSuppliers();
    for (let i = 0; i < 9; i += 1) {
      const supplier = await repos.suppliers.create({ name: `Supplier ${i}`, platform: "alibaba" });
      await repos.supplierOffers.save({
        supplierId: supplier.id, productId: "prd_cup_kraft_250", unitCost: 100 + i, currency: "XOF",
        minimumOrder: 10, availableQuantity: 100_000, productionDays: 15,
        shippingCost: 80_000, lastCheckedAt: fresh(),
      });
    }

    const candidates = await gatherCandidates(repos, request, CATALOGUE);
    assert.equal(candidates.length, 9);
    const report = buildReport(request, shortlist(request, candidates), candidates.length);

    // §6: three to five, not everything. The count considered is still reported.
    assert.ok(report.options.length <= 5, `${report.options.length} options is a list nobody reads`);
    assert.equal(report.considered, 9);
    await close();
  });
});

/* --- End to end ------------------------------------------------------------- */

describe("brief in, report out", () => {
  it("calls the model once, to read the sentence, and never for a number", async () => {
    const { repos, close } = await withSuppliers();
    const supplier = await repos.suppliers.create({ name: "Steady Works", platform: "alibaba" });
    await repos.supplierOffers.save({
      supplierId: supplier.id, productId: "prd_cup_kraft_250", unitCost: 145, currency: "XOF",
      minimumOrder: 100, availableQuantity: 100_000, productionDays: 12,
      shippingCost: 100_000, lastCheckedAt: fresh(),
    });

    // The model returns the right structure and a wildly wrong price alongside.
    const provider = new ScriptedProvider(
      JSON.stringify({
        productType: "kraft paper cup",
        quantity: 1_000,
        destinationCountry: "CI",
        targetUnitPriceMinor: 999_999,
      }),
    );

    const report = await sourceFromBrief({
      repos, brief: "1000 kraft cups to Abidjan", provider, catalogue: CATALOGUE,
    });

    assert.equal(report.options.length, 1);
    // The figure on the page is the recorded offer, not the model's.
    assert.equal(report.options[0]?.unitCost.amount, 145);
    // The model's number survives only as what the customer asked for.
    assert.equal(report.understood.targetUnitPrice?.amount, 999_999);
    // And it was asked exactly one thing: to parse.
    assert.match(provider.lastPrompt?.system ?? "", /You are a parser/);
    assert.equal((provider.lastPrompt?.system ?? "").includes("supplier"), true);
    assert.match(provider.lastPrompt?.system ?? "", /do not know anything about suppliers/);
    await close();
  });
});
