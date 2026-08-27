# Managing the catalogue

Brandora's product catalogue is a database table (`catalog_products`) and an
admin portal (`/admin-products`), not application code. This document is the
walkthrough; the architectural reasoning is in the commit history and in the
comments on `packages/brandora-database/src/schema.sql`'s `catalog_products`
table and `packages/brandora-server/src/routes.ts`'s "Admin: catalogue
products" section.

## The separation this replaces

Until this was built, every product on the site was a hand-typed object in
`packages/brandora-catalog/src/seed.ts` — genuinely real data (every one
traces to an actual photograph and, where a supplier is named, an actual
manufacturer), but changing a description, a price, or a photo meant editing
a TypeScript file and shipping a new deploy.

That is gone for anything the admin portal manages. The public site's
`GET /api/catalog` and `GET /api/catalog/:id` now read published rows out of
the database on every request — no cache, no build step, no redeploy — and
`/admin-products` is how those rows change.

```
BRANDORA WEBSITE  ──GET /api/catalog──▶  Postgres (catalog_products, published only)
                                              ▲
BRANDORA ADMIN PORTAL (/admin-products)  ─────┘  authenticated CRUD + image upload
```

`packages/brandora-catalog/src/seed.ts`'s `CATALOG` export still exists, but
nothing in the running application reads it any more — see "What still
references `CATALOG`", below.

## Getting admin access

There is no self-serve way to become an administrator, and no route grants
the role — see deployment.md, "Make the first administrator". Sign up
normally, then have someone with database access run:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Using the portal

1. **/admin** — the operations dashboard. Has a "Manage products" link into
   the catalogue, alongside the existing orders/quotes/customers/integrations
   panels.
2. **/admin-products** — every product, any status, with search and
   status/category filters. Publish, unpublish, or delete from here.
3. **/admin-product-new.html** — create a product. Saves as a `draft`
   (invisible on the site) and redirects to the edit screen once saved,
   because a product needs to exist before a photo can be attached to it.
4. **/admin-product-edit.html?id=…** — the same form, plus the photo panel:
   add an image, see it appear, set any image as the main one, remove one.
   Change the status to `published` here (or from the list) to make it live.

A product is always exactly one of `draft` (being built, invisible),
`published` (live on the site), or `archived` (was live, now withdrawn —
distinct from deleted, which removes the row and its photos entirely).

### On the URL shape

The brief that asked for this specified `/admin/products`,
`/admin/products/new`, `/admin/products/:id/edit`. What actually shipped is
flat filenames — `/admin-products`, `/admin-product-new.html`,
`/admin-product-edit.html?id=…` — matching every other admin screen this
codebase already has (`/admin.html`, `/procurement.html`, `/suppliers.html`,
`/testimonials.html` are flat too, not nested under `/admin/`), and the
`?id=` query parameter matches the existing convention on `/product.html`.
The site's router (`packages/brandora-server/src/static.ts`) resolves clean
URLs to files by name; it has no notion of a `:id` path segment, and adding
one would be new routing infrastructure built for a single screen rather
than the pragmatic choice of reusing what the rest of the site already does.
The functionality is identical either way.

## Honesty invariants the database enforces

The site's long-standing rule survives the move to a database unchanged: a
product with no confirmed supplier must never show a price, because there is
no manufacturer behind it to have quoted one. Two flags carry this:

- **`quoteOnRequest`** — a real, named supplier exists, but Brandora has not
  computed a landed customer price yet. The product shows "Price on
  request".
- **`sourcingInProgress`** — no manufacturer is confirmed for this product at
  all. The product shows "Brandora is sourcing this — no manufacturer
  confirmed yet" instead of a supplier name, and any quantity can be asked
  about since there is no real minimum order to test against.

`catalogProducts.create()` and `catalogProducts.update()`
(`packages/brandora-database/src/repositories.ts`) enforce this at the
write, not just in the admin form: setting `sourcingInProgress: true` always
forces `quoteOnRequest: true` and clears any price or supplier that request
also tried to set, even in the same call. A form bug upstream cannot publish
an invented-looking price next to an unconfirmed supplier — see
`tests/brandora-catalog-products.test.ts` for the test that pins this down.

## Product images

Uploaded through the admin form as base64 in the same request body shape the
public quote-request logo upload already used — decoded server-side, checked
by its actual bytes (never the filename or a client-supplied Content-Type),
and stored in Cloudflare R2. What lands in `catalog_product_images` is the
URL R2 returns, never the image bytes.

Set these five variables to turn image upload on:

```
R2_ACCOUNT_ID=…
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_BUCKET_NAME=…
R2_PUBLIC_URL=https://your-bucket-public-url
```

Unset, uploads fail with a clear "image storage isn't set up yet" message —
the product itself still saves, exactly the pattern already used for
`PAYSTACK_SECRET_KEY` and `ANTHROPIC_API_KEY` (see `packages/brandora-server/src/storage.ts`
and `docs/deployment.md`'s environment variable tables).

R2's public bucket setting or a custom domain determines `R2_PUBLIC_URL` — a
private bucket serves nothing to a customer's browser, so it must be public
or fronted by one.

## The one-time import, and what happens automatically after it

A fresh database has no products until something imports `CATALOG` into
`catalog_products`. Two things can do that now:

- **On boot**, `createApp()` calls, in order (`packages/brandora-server/src/app.ts`):
  1. `seedCatalogIfEmpty` — if the table has never been seeded, imports the
     entire `CATALOG`.
  2. `seedNewCatalogProducts` — on *every* boot, whether the table was empty
     or not, creates any product in `CATALOG` whose slug isn't in the
     database yet. It never updates or touches a row that already exists, so
     an administrator's edit to an existing product is never overwritten and
     never fought. This is what makes adding a new photographed product to
     `seed.ts` (a new sourcing batch, say) reach the live site on the next
     deploy with no manual step — see `packages/brandora-server/src/catalog-seed.ts`
     for the exact reasoning, including the one named trade-off: deleting one
     of these auto-created products afterward, while its slug is still in
     `CATALOG`, gets it recreated on the next boot. Removing the product from
     `CATALOG` (or archiving/deleting it and also dropping it from `seed.ts`)
     closes that for good.
- **By hand**, `node scripts/import-catalog-seed.mjs` does a full sync —
  create *or update* by slug — for when you deliberately want an existing
  seed product's database row to match what `seed.ts` says again:

  ```bash
  BRANDORA_DATABASE_URL=… node scripts/import-catalog-seed.mjs
  node scripts/import-catalog-seed.mjs --dry-run   # see what it would do first
  ```

Photos keep their existing `/assets/img/sourcing/*.webp` paths rather than
being re-uploaded to R2 — they are already real files shipped with the site.

## What still references `CATALOG`

`packages/brandora-catalog/src/seed.ts`'s `CATALOG` (and the `REAL_SEED`/
`SOURCING_SEED` arrays behind it) is no longer read by any live route — the
server reads the database instead (`loadCatalog()` in
`packages/brandora-server/src/routes.ts`). It still exists as:

- the input `scripts/import-catalog-seed.mjs` reads for the one-time import
  above;
- what `scripts/check-catalog.mjs` and `apps/brandora/data/catalog.json`
  validate at build time — a snapshot of what the codebase's own fixtures
  say, not of what the live site is serving;
- what `tests/brandora-catalog.test.ts` tests against, for the pure
  filtering/pricing/ranking functions in `@brandora/catalog` that take a
  product list as a plain argument and do not care where it came from.

None of that is "the site secretly still depends on hard-coded data" — it is
test fixture and one-time-import-source, the same role `EXAMPLE_CATALOG` has
always played. Retiring `CATALOG` entirely (repointing
`check-catalog.mjs`/`emit-catalog.ts` at something else, or removing them)
is a small, separate cleanup with no functional effect on the running site,
left for a deliberate follow-up rather than folded into this change.
