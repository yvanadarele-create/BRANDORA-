/**
 * One-time import: load the real, photograph-grounded catalogue that used to
 * ship as the hard-coded `CATALOG` export in
 * packages/brandora-catalog/src/seed.ts into the database, so the site is
 * not empty the first time it reads products from `catalog_products`
 * instead of from that file.
 *
 * This is the cutover this admin portal exists to make possible — see
 * BRANDORA — PRIVATE PRODUCT MANAGEMENT PORTAL, §29 ("remove hard-coded
 * product data only after confirming the new system works") and §21
 * ("do not destroy existing product data during migration"). Running this
 * script is that migration step. `CATALOG` itself is untouched by it and
 * can be deleted from the codebase afterward, once the database is
 * confirmed to be serving correctly — this script is what carries its
 * content across first.
 *
 * Every field here already went through the honesty checks `CATALOG` itself
 * was built under (scripts/check-catalog.mjs, tests/brandora-catalog.test.ts):
 * a `quoteOnRequest`/`sourcingInProgress` product still has no price and no
 * supplier after import, because the source object it came from never had
 * one either. This script does not add or invent anything — it only moves
 * what already existed from one storage location to another.
 *
 * Idempotent by slug: running it twice updates matching rows rather than
 * duplicating them, so it is also the way to re-sync after a code-only
 * catalogue edit made before the admin portal existed.
 *
 * Images keep their existing site-relative paths
 * (/assets/img/sourcing/*.webp) rather than being re-uploaded to R2 — they
 * are already real files shipped with the site, and moving them to object
 * storage is not what this script is for. New photos an administrator
 * uploads afterward go through the admin UI's R2 path instead.
 *
 * Usage:
 *   BRANDORA_DATABASE_URL=… node scripts/import-catalog-seed.mjs
 *   node scripts/import-catalog-seed.mjs --dry-run
 *   BRANDORA_DATABASE_PATH=./data/brandora.db node scripts/import-catalog-seed.mjs   # local SQLite
 */

import { openDatabase, createRepositories } from "../packages/brandora-database/dist/index.js";
import { CATALOG } from "../packages/brandora-catalog/dist/index.js";

const DRY_RUN = process.argv.includes("--dry-run");

const url = (process.env["BRANDORA_DATABASE_URL"] ?? "").trim();
const path = (process.env["BRANDORA_DATABASE_PATH"] ?? "").trim();

if (!DRY_RUN && !url && !path) {
  console.error(
    "Set BRANDORA_DATABASE_URL (Postgres) or BRANDORA_DATABASE_PATH (SQLite) first, " +
      "or pass --dry-run to see what this would do without a database.",
  );
  process.exit(1);
}

function toInput(product) {
  return {
    slug: product.id.replace(/^prd_/, ""),
    name: product.name,
    nameFr: product.nameFr,
    category: product.category,
    subcategory: product.subcategory,
    description: product.description,
    descriptionFr: product.descriptionFr,
    material: product.material,
    shape: product.shape,
    colors: product.colors,
    dimensions: {
      lengthMm: product.dimensions?.lengthMm,
      widthMm: product.dimensions?.widthMm,
      heightMm: product.dimensions?.heightMm,
      weightG: product.dimensions?.weightG,
      volumeMl: product.dimensions?.volumeMl,
    },
    minimumQuantity: product.minimumQuantity,
    availableQuantity: product.availableQuantity,
    currency: product.indicativeUnitPrice.currency,
    quoteOnRequest: product.quoteOnRequest === true,
    ...(product.quoteOnRequest ? {} : { priceAmount: product.indicativeUnitPrice.amount }),
    supplierReference: product.supplierReference,
    sourcingInProgress: product.sourcingInProgress === true,
    customization: {
      confidence: product.customization.confidence,
      methods: product.customization.methods,
      ...(product.customization.unitCost ? { unitCost: product.customization.unitCost.amount } : {}),
      ...(product.customization.setupCost ? { setupCost: product.customization.setupCost.amount } : {}),
      ...(product.customization.minimumUnits !== undefined ? { minimumUnits: product.customization.minimumUnits } : {}),
      ...(product.customization.notes ? { notes: product.customization.notes } : {}),
    },
    mainImage: product.images[0],
    // Published, not draft — this is the catalogue the live site already
    // shows today; importing it into 'draft' would take the whole thing
    // offline the moment the server stops reading the static CATALOG export.
    status: "published",
    featured: product.featured,
  };
}

console.log(`Importing ${CATALOG.length} product(s) from packages/brandora-catalog/src/seed.ts...\n`);

if (DRY_RUN) {
  for (const product of CATALOG) {
    const input = toInput(product);
    console.log(`  ${input.slug} — "${input.name}" (${input.status}, images: ${product.images.length})`);
  }
  console.log("\n--dry-run: nothing written.");
  process.exit(0);
}

const db = await openDatabase({ url: url || undefined, path: path || undefined, warn: console.warn });
const repos = createRepositories(db);

let created = 0;
let updated = 0;

for (const product of CATALOG) {
  const input = toInput(product);
  const existing = await repos.catalogProducts.findBySlug(input.slug);

  const row = existing
    ? await repos.catalogProducts.update(existing.id, input)
    : await repos.catalogProducts.create(input);

  if (!existing) {
    created += 1;
    // Only set images on a fresh row — an existing one may already carry
    // photos an administrator uploaded since the last import, and this
    // script has no business discarding those.
    for (const url of product.images) {
      await repos.catalogProductImages.add(row.id, url);
    }
    if (product.images[0]) {
      await repos.catalogProducts.update(row.id, { mainImage: product.images[0] });
    }
  } else {
    updated += 1;
  }

  console.log(`  ${existing ? "updated" : "created"}  ${input.slug}`);
}

console.log(`\nDone — ${created} created, ${updated} updated.`);
await db.close();
