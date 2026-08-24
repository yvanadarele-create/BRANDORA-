/**
 * One-time import: load the real, photograph-grounded catalogue that used to
 * ship as the hard-coded `CATALOG` export in
 * packages/brandora-catalog/src/seed.ts into the database, so the site is
 * not empty the first time it reads products from `catalog_products`
 * instead of from that file.
 *
 * You should rarely need to run this by hand: `createApp()`
 * (packages/brandora-server/src/app.ts) already calls the same import
 * automatically on any boot where `catalog_products` is empty — see
 * packages/brandora-server/src/catalog-seed.ts, which is the one place this
 * mapping actually lives; this script is a thin CLI wrapper around it. Use
 * this directly when you want to *watch* the import happen (via
 * --dry-run), or to re-sync after editing seed.ts's `CATALOG` by hand.
 *
 * This is the cutover this admin portal exists to make possible — see
 * BRANDORA — PRIVATE PRODUCT MANAGEMENT PORTAL, §29 ("remove hard-coded
 * product data only after confirming the new system works") and §21
 * ("do not destroy existing product data during migration").
 *
 * Every field here already went through the honesty checks `CATALOG` itself
 * was built under (scripts/check-catalog.mjs, tests/brandora-catalog.test.ts):
 * a `quoteOnRequest`/`sourcingInProgress` product still has no price and no
 * supplier after import, because the source object it came from never had
 * one either. This script does not add or invent anything — it only moves
 * what already existed from one storage location to another.
 *
 * Idempotent by slug: running it twice updates matching rows rather than
 * duplicating them.
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
import { importCatalogSeed, toCatalogProductInput } from "../packages/brandora-server/dist/catalog-seed.js";

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

console.log(`Importing ${CATALOG.length} product(s) from packages/brandora-catalog/src/seed.ts...\n`);

if (DRY_RUN) {
  for (const product of CATALOG) {
    const input = toCatalogProductInput(product);
    console.log(`  ${input.slug} — "${input.name}" (${input.status}, images: ${product.images.length})`);
  }
  console.log("\n--dry-run: nothing written.");
  process.exit(0);
}

const db = await openDatabase({ url: url || undefined, path: path || undefined, warn: console.warn });
const repos = createRepositories(db);

const { created, updated } = await importCatalogSeed(repos, CATALOG);

console.log(`\nDone — ${created} created, ${updated} updated.`);
await db.close();
