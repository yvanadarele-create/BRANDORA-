/**
 * Nothing ships in the catalogue that a supplier has not actually confirmed.
 *
 * Twenty products once shipped with prices nobody had quoted and badges reading
 * "Confirmed: carries your logo" for capabilities nobody had confirmed. They
 * looked exactly like real products, because that is what a plausible
 * placeholder is — and a founder repeating one of those prices to their own
 * customer is the harm.
 *
 * So this fails the build when the shipped catalogue contains anything that
 * cannot stand behind itself:
 *
 *   1. A product with no supplier reference. Brandora's whole claim is that
 *      it connects people to manufacturers it has verified; a product with no
 *      manufacturer behind it is the claim being made falsely.
 *   2. A product claiming `verified` customization without one.
 *
 * An empty catalogue passes. Empty is honest — the page says it is being
 * prepared, which is true. What is forbidden is *full and invented*.
 *
 * Run:  node scripts/check-catalog.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, "../apps/brandora/data/catalog.json");

if (!existsSync(file)) {
  console.error("apps/brandora/data/catalog.json is missing — run the catalogue build.");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const products = Array.isArray(payload) ? payload : (payload.products ?? []);
const problems = [];

for (const product of products) {
  const where = `${product.id ?? "(no id)"} "${product.name ?? ""}"`;

  const supplier = product.supplierReference ?? product.supplier ?? null;
  if (!supplier) {
    problems.push(
      `${where}: no supplier reference. A product in the catalogue is a promise that ` +
        `Brandora can actually have it made; without a manufacturer behind it that promise is invented.`,
    );
  }

  if (product.customization?.confidence === "verified" && !supplier) {
    problems.push(
      `${where}: claims verified customization ("Confirmed: carries your logo") with no supplier ` +
        `to have confirmed it. This is the exact sentence that must never be guessed.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`\nCatalogue check failed — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(
    "\nIf these are examples for testing, they belong in EXAMPLE_CATALOG in\n" +
      "packages/brandora-catalog/src/seed.ts, which is never served.\n",
  );
  process.exit(1);
}

console.log(
  products.length === 0
    ? "Catalogue check passed — the catalogue is empty, and says so on the page."
    : `Catalogue check passed — ${products.length} product(s), each with a supplier behind it.`,
);
