/**
 * Ask Brandora.
 *
 * These tests are almost entirely about one failure: the model making something
 * up. A fabricated price or minimum order is a promise Brandora cannot keep,
 * and the customer finds out at the quote — so the tests feed it deliberately
 * badly-behaved replies and check what reaches the customer.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_QUESTION_LENGTH,
  ask,
  buildAssistantPrompt,
  citedIds,
  readQuantity,
  stripCitations,
} from "@brandora/server";
import { EXAMPLE_CATALOG } from "@brandora/catalog";
import type { StrategyProvider } from "@brandora/brand-engine";

const BRAND = {
  name: "Maison Doré",
  description: "A home bakery selling butter cookies to offices in Abidjan.",
  industry: "bakery",
  positioning: "accessible-premium",
  targetCustomer: "Office workers ordering for their team",
  personality: ["warm", "elegant"],
  promise: "Baked the morning you receive them.",
  toneOfVoice: "Warm, direct, never fussy.",
  palette: [{ name: "Primary", hex: "#913059", role: "primary" }],
  typography: { primary: "Playfair Display", secondary: "Inter" },
};

/** A provider that says exactly what the test tells it to. */
class ScriptedProvider implements StrategyProvider {
  lastPrompt: { system: string; user: string } | null = null;
  constructor(private readonly reply: string) {}
  async complete(input: { system: string; user: string }): Promise<string> {
    this.lastPrompt = { system: input.system, user: input.user };
    return this.reply;
  }
}

const askWith = (reply: string, question = "What products fit my brand?") =>
  ask({ question, brand: BRAND, catalog: EXAMPLE_CATALOG, provider: new ScriptedProvider(reply) });

/* --- Reading the question --------------------------------------------------- */

describe("reading a quantity out of a question", () => {
  it("finds the quantity in the question the spec names", () => {
    assert.equal(readQuantity("I need 30 premium cups."), 30);
    assert.equal(readQuantity("Find me 30 premium cups"), 30);
  });

  it("handles the ways people write numbers", () => {
    assert.equal(readQuantity("I want 1,500 stickers"), 1500);
    assert.equal(readQuantity("order 250 boxes please"), 250);
    assert.equal(readQuantity("get me 40 units"), 40);
  });

  it("does not mistake a price or a year for a quantity", () => {
    assert.equal(readQuantity("what fits a 50000 FCFA budget?"), null);
    assert.equal(readQuantity("what should I launch first?"), null);
    assert.equal(readQuantity("is this ready for 2026?"), null);
  });
});

/* --- The prompt ------------------------------------------------------------- */

describe("the prompt the model is given", () => {
  it("carries the brand and only real catalogue rows", async () => {
    const provider = new ScriptedProvider("Anything.");
    await ask({ question: "What fits my brand?", brand: BRAND, catalog: EXAMPLE_CATALOG, provider });

    const prompt = provider.lastPrompt;
    assert.ok(prompt);
    assert.match(prompt.user, /Maison Doré/);
    assert.match(prompt.user, /accessible.premium/);

    // Every id offered to the model exists in the catalogue.
    const offered = [...prompt.user.matchAll(/\[(prd_[a-z0-9_]+)\]/gi)].map((m) => m[1]);
    assert.ok(offered.length > 0, "no products were offered to the model");
    for (const id of offered) {
      assert.ok(EXAMPLE_CATALOG.some((product) => product.id === id), `${id} is not a real product`);
    }
  });

  it("tells the model the rules that keep it honest", () => {
    const { system } = buildAssistantPrompt("q", BRAND, []);
    assert.match(system, /[Nn]ever invent/);
    assert.match(system, /delivery date/i);
    assert.match(system, /supplier/i);
    assert.match(system, /CONFIRMED/);
  });

  it("states each product's real price, minimum and branding confidence", async () => {
    const provider = new ScriptedProvider("ok");
    await ask({ question: "cups?", brand: BRAND, catalog: EXAMPLE_CATALOG, provider });
    const line = provider.lastPrompt?.user.split("\n").find((l) => l.startsWith("[prd_"));
    assert.ok(line);
    assert.match(line, /per unit/);
    assert.match(line, /minimum \d+/);
    assert.match(line, /branding (CONFIRMED|UNCONFIRMED)|cannot be branded/);
  });
});

/* --- Citations -------------------------------------------------------------- */

describe("citations", () => {
  it("finds the ids the model cited, without duplicates", () => {
    const answer = "Start with [prd_cup_kraft_250] and [prd_cup_kraft_250], then [prd_bag_kraft_small].";
    assert.deepEqual(citedIds(answer), ["prd_cup_kraft_250", "prd_bag_kraft_small"]);
  });

  it("removes the brackets from what the customer reads", () => {
    const answer = "Start with the kraft cup [prd_cup_kraft_250]. It suits you.";
    assert.equal(stripCitations(answer), "Start with the kraft cup. It suits you.");
  });
});

/* --- The guarantee ---------------------------------------------------------- */

describe("the assistant cannot put an invented product in front of a customer", () => {
  it("resolves cited products from the catalogue, not from the prose", async () => {
    const real = EXAMPLE_CATALOG.find((p) => p.id === "prd_cup_kraft_250");
    assert.ok(real);

    // The model quotes a price four times the real one.
    const result = await askWith(
      `The kraft cup [prd_cup_kraft_250] is perfect, at about 800 FCFA each with a minimum of 5.`,
    );

    assert.equal(result.products.length, 1);
    // What the interface renders is the catalogue's figure, not the model's.
    assert.equal(result.products[0]?.indicativeUnitPrice.amount, real.indicativeUnitPrice.amount);
    assert.notEqual(real.indicativeUnitPrice.amount, 800);
    assert.equal(result.products[0]?.minimumQuantity, real.minimumQuantity);
  });

  it("drops an id the model invented, and reports it", async () => {
    const result = await askWith(
      "Try [prd_cup_kraft_250] and our exclusive [prd_gold_leaf_tin_9000], which is beautiful.",
    );

    assert.deepEqual(
      result.products.map((product) => product.id),
      ["prd_cup_kraft_250"],
      "an invented product reached the customer",
    );
    assert.deepEqual(result.unreferencedClaims, ["prd_gold_leaf_tin_9000"]);
  });

  it("returns no products when the model cites none", async () => {
    const result = await askWith("You should look at some nice cups and boxes.");
    assert.deepEqual(result.products, []);
  });

  it("never invents when the catalogue offers nothing", async () => {
    const provider = new ScriptedProvider("I would recommend our premium gold tins at 5000 FCFA.");
    const result = await ask({
      question: "What fits my brand?",
      brand: BRAND,
      catalog: [],
      provider,
    });

    assert.deepEqual(result.products, []);
    assert.match(result.answer, /[Nn]othing in the catalogue matches/);
    // The model was never even asked — there was nothing to ground it in.
    assert.equal(provider.lastPrompt, null);
  });

  it("labels every product with whether it can be ordered at the stated quantity", async () => {
    const provider = new ScriptedProvider("ok");
    await ask({ question: "I need 30 cups", brand: BRAND, catalog: EXAMPLE_CATALOG, provider });

    const lines = (provider.lastPrompt?.user ?? "").split("\n").filter((l) => l.startsWith("[prd_"));
    assert.ok(lines.length > 0);

    for (const line of lines) {
      const id = /\[(prd_[a-z0-9_]+)\]/.exec(line)?.[1];
      const product = EXAMPLE_CATALOG.find((entry) => entry.id === id);
      assert.ok(product, `${id} is not a real product`);

      // §35: a product that cannot be ordered at thirty is not hidden — it is
      // labelled, so the model can say "these start at fifty" rather than
      // recommending something the customer cannot buy.
      const expected = product.minimumQuantity <= 30 && product.availableQuantity >= 30;
      assert.match(
        line,
        expected ? /CAN be ordered at 30/ : /CANNOT be ordered at 30 \(minimum \d+\)/,
        `${id} is mislabelled: ${line}`,
      );
    }
  });

  it("tells the model not to recommend what cannot be ordered at that quantity", () => {
    const { system } = buildAssistantPrompt("q", BRAND, [], 30);
    assert.match(system, /only recommend products marked "CAN be ordered at"/);
  });
});

/* --- Input handling --------------------------------------------------------- */

describe("input handling", () => {
  it("refuses an empty question", async () => {
    await assert.rejects(() => askWith("answer", "   "));
  });

  it("refuses a question long enough to be an attack", async () => {
    await assert.rejects(() => askWith("answer", "a".repeat(MAX_QUESTION_LENGTH + 1)));
  });

  it("accepts a question at the limit", async () => {
    const result = await askWith("Fine. [prd_cup_kraft_250]", "a".repeat(MAX_QUESTION_LENGTH));
    assert.equal(result.products.length, 1);
  });
});
