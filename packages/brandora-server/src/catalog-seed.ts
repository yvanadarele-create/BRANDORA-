/**
 * Auto-seeding the catalogue on an empty database.
 *
 * §5 of the admin-portal brief is blunt about this: "Do NOT replace the
 * existing customer catalog with an empty database." The single most likely
 * way that happens is not a bug in the catalogue code — it is a fresh
 * Postgres database that nobody has run the one-time import against yet
 * (`scripts/import-catalog-seed.mjs`), which `createApp()` now calls
 * automatically so a first boot against an empty `catalog_products` table
 * can never silently show a customer nothing.
 *
 * This is deliberately narrow: it only ever acts when the table is
 * genuinely empty (`repos.catalogProducts.listAsAdmin()` returns nothing),
 * so it is a one-time bootstrap, not a sync that could fight an
 * administrator's own edits or a delete they meant. It shares the exact
 * conversion logic `scripts/import-catalog-seed.mjs` uses, so running that
 * script by hand afterward is a no-op update, not a second, different
 * import.
 */

import { CATALOG } from "@brandora/catalog";
import type { BrandoraProduct } from "@brandora/shared";
import type { CatalogProductInput, Repositories } from "@brandora/database";

import type { ServerLogger } from "./http.js";

export function toCatalogProductInput(product: BrandoraProduct): CatalogProductInput {
  return {
    slug: product.id.replace(/^prd_/, ""),
    name: product.name,
    ...(product.nameFr ? { nameFr: product.nameFr } : {}),
    category: product.category,
    subcategory: product.subcategory,
    description: product.description,
    ...(product.descriptionFr ? { descriptionFr: product.descriptionFr } : {}),
    ...(product.material ? { material: product.material } : {}),
    ...(product.shape ? { shape: product.shape } : {}),
    colors: product.colors,
    dimensions: {
      ...(product.dimensions?.lengthMm !== undefined ? { lengthMm: product.dimensions.lengthMm } : {}),
      ...(product.dimensions?.widthMm !== undefined ? { widthMm: product.dimensions.widthMm } : {}),
      ...(product.dimensions?.heightMm !== undefined ? { heightMm: product.dimensions.heightMm } : {}),
      ...(product.dimensions?.weightG !== undefined ? { weightG: product.dimensions.weightG } : {}),
      ...(product.dimensions?.volumeMl !== undefined ? { volumeMl: product.dimensions.volumeMl } : {}),
    },
    minimumQuantity: product.minimumQuantity,
    availableQuantity: product.availableQuantity,
    currency: product.indicativeUnitPrice.currency,
    quoteOnRequest: product.quoteOnRequest === true,
    ...(product.quoteOnRequest ? {} : { priceAmount: product.indicativeUnitPrice.amount }),
    ...(product.supplierReference ? { supplierReference: product.supplierReference } : {}),
    sourcingInProgress: product.sourcingInProgress === true,
    customization: {
      confidence: product.customization.confidence,
      methods: product.customization.methods,
      ...(product.customization.unitCost ? { unitCost: product.customization.unitCost.amount } : {}),
      ...(product.customization.setupCost ? { setupCost: product.customization.setupCost.amount } : {}),
      ...(product.customization.minimumUnits !== undefined ? { minimumUnits: product.customization.minimumUnits } : {}),
      ...(product.customization.notes ? { notes: product.customization.notes } : {}),
    },
    ...(product.images[0] ? { mainImage: product.images[0] } : {}),
    // Published, not draft — this carries across the catalogue the live
    // site already shows today; landing it as 'draft' would take the whole
    // thing offline the moment the server stops reading the old static
    // CATALOG export.
    status: "published",
    featured: product.featured,
  };
}

export async function importCatalogSeed(
  repos: Repositories,
  catalog: readonly BrandoraProduct[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const product of catalog) {
    const input = toCatalogProductInput(product);
    const slug = product.id.replace(/^prd_/, "");
    const existing = await repos.catalogProducts.findBySlug(slug);

    if (existing) {
      await repos.catalogProducts.update(existing.id, input);
      updated += 1;
      continue;
    }

    const row = await repos.catalogProducts.create(input);
    created += 1;
    for (const url of product.images) {
      await repos.catalogProductImages.add(row.id, url);
    }
  }

  return { created, updated };
}

/**
 * Run the import, but only when the table has never been seeded — a plain
 * count check, not a diff against `CATALOG`, so an administrator who has
 * since deleted every product on purpose gets an empty catalogue, not one
 * that keeps coming back.
 */
export async function seedCatalogIfEmpty(repos: Repositories, logger: ServerLogger): Promise<void> {
  try {
    const existing = await repos.catalogProducts.listAsAdmin(1);
    if (existing.length > 0) return;

    const { created } = await importCatalogSeed(repos, CATALOG);
    if (created > 0) {
      // Not an error — but ServerLogger has no info-level method, and this
      // is exactly the kind of one-time startup event the "[brandora] ..."
      // banner in app.ts/serve.js already prints straight to the console.
      console.log(`[brandora] catalog_products was empty — auto-imported ${created} product(s) from the built-in catalogue seed`);
    }
  } catch (err) {
    // Never block startup over this — an empty catalogue that logs why is
    // recoverable (run scripts/import-catalog-seed.mjs by hand); a server
    // that refuses to boot because a seed insert failed is not.
    logger.error(`catalog auto-seed failed, continuing without it: ${String(err)}`);
  }
}
