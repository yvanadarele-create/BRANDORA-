import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import { openSqlite } from "@brandora/database";
import { createRepositories, type Repositories } from "@brandora/database";

describe("catalogProducts — the table /admin-products manages", () => {
  let repos: Repositories;

  before(async () => {
    const db = openSqlite(":memory:");
    await db.migrate();
    repos = createRepositories(db);
  });

  test("create() slugifies the name when no slug is given", async () => {
    const product = await repos.catalogProducts.create({
      name: "Kraft Coffee Pouch, Large",
      category: "packaging",
      subcategory: "pouches",
      description: "A pouch.",
    });
    assert.equal(product.slug, "kraft-coffee-pouch-large");
  });

  test("create() defaults to draft, unfeatured, XOF", async () => {
    const product = await repos.catalogProducts.create({
      name: "Test Draft Product",
      category: "packaging",
      subcategory: "boxes",
      description: "A box.",
    });
    assert.equal(product.status, "draft");
    assert.equal(product.featured, false);
    assert.equal(product.currency, "XOF");
  });

  test("sourcingInProgress:true on create() forces quoteOnRequest and blanks the price and supplier, even if the caller also sent a price", async () => {
    const product = await repos.catalogProducts.create({
      name: "Invented Price Attempt",
      category: "packaging",
      subcategory: "boxes",
      description: "A box.",
      sourcingInProgress: true,
      quoteOnRequest: false, // deliberately contradicts sourcingInProgress
      priceAmount: 45000, // deliberately supplied alongside it
      supplierReference: { supplierId: "sup_x", name: "Somebody" },
    });
    assert.equal(product.sourcingInProgress, true);
    assert.equal(product.quoteOnRequest, true, "sourcingInProgress must force quoteOnRequest");
    assert.equal(product.priceAmount, undefined, "a sourcing-in-progress product must never carry a price");
    assert.equal(product.supplierReference, undefined, "a sourcing-in-progress product must never carry a supplier");
  });

  test("update() to sourcingInProgress:true clears a price and supplier already on the row", async () => {
    const product = await repos.catalogProducts.create({
      name: "Confirmed Then Reverted",
      category: "packaging",
      subcategory: "boxes",
      description: "A box.",
      priceAmount: 12000,
      supplierReference: { supplierId: "sup_y", name: "Real Supplier" },
    });
    assert.equal(product.priceAmount, 12000);

    const updated = await repos.catalogProducts.update(product.id, {
      sourcingInProgress: true,
      // Same trap as the create() test: a price sent in the very same patch
      // that turns sourcingInProgress on must still not survive.
      priceAmount: 99999,
    });
    assert.ok(updated);
    assert.equal(updated!.sourcingInProgress, true);
    assert.equal(updated!.quoteOnRequest, true);
    assert.equal(updated!.priceAmount, undefined);
    assert.equal(updated!.supplierReference, undefined);
  });

  test("update() only touches the fields present in the patch", async () => {
    const product = await repos.catalogProducts.create({
      name: "Original Name",
      category: "packaging",
      subcategory: "boxes",
      description: "Original description.",
      material: "Kraft",
    });
    const updated = await repos.catalogProducts.update(product.id, { status: "published" });
    assert.equal(updated!.name, "Original Name");
    assert.equal(updated!.description, "Original description.");
    assert.equal(updated!.material, "Kraft");
    assert.equal(updated!.status, "published");
  });

  test("listPublished() returns only published rows; listAsAdmin() returns every status", async () => {
    await repos.catalogProducts.create({ name: "Draft One", category: "packaging", subcategory: "boxes", description: "d", status: "draft" });
    const pub = await repos.catalogProducts.create({ name: "Published One", category: "packaging", subcategory: "boxes", description: "d", status: "published" });
    await repos.catalogProducts.create({ name: "Archived One", category: "packaging", subcategory: "boxes", description: "d", status: "archived" });

    const published = await repos.catalogProducts.listPublished();
    assert.ok(published.every((p) => p.status === "published"));
    assert.ok(published.some((p) => p.id === pub.id));

    const admin = await repos.catalogProducts.listAsAdmin();
    const statuses = new Set(admin.map((p) => p.status));
    assert.ok(statuses.has("draft") && statuses.has("published") && statuses.has("archived"));
  });

  test("remove() deletes the product and cascades its images", async () => {
    const product = await repos.catalogProducts.create({ name: "To Delete", category: "packaging", subcategory: "boxes", description: "d" });
    await repos.catalogProductImages.add(product.id, "https://example.test/a.webp");
    await repos.catalogProductImages.add(product.id, "https://example.test/b.webp");
    assert.equal((await repos.catalogProductImages.listFor(product.id)).length, 2);

    await repos.catalogProducts.remove(product.id);
    assert.equal(await repos.catalogProducts.findById(product.id), null);
    assert.equal((await repos.catalogProductImages.listFor(product.id)).length, 0);
  });
});

describe("catalogProductImages", () => {
  let repos: Repositories;
  let productId: string;

  before(async () => {
    const db = openSqlite(":memory:");
    await db.migrate();
    repos = createRepositories(db);
    productId = (await repos.catalogProducts.create({ name: "Image Host", category: "packaging", subcategory: "boxes", description: "d" })).id;
  });

  test("add() assigns increasing positions in upload order", async () => {
    const a = await repos.catalogProductImages.add(productId, "https://example.test/a.webp");
    const b = await repos.catalogProductImages.add(productId, "https://example.test/b.webp");
    assert.equal(a.position, 0);
    assert.equal(b.position, 1);
    const listed = await repos.catalogProductImages.listFor(productId);
    assert.deepEqual(listed.map((i) => i.url), ["https://example.test/a.webp", "https://example.test/b.webp"]);
  });

  test("remove() only removes the named image, scoped to its product", async () => {
    const before = await repos.catalogProductImages.listFor(productId);
    await repos.catalogProductImages.remove(productId, before[0]!.id);
    const after = await repos.catalogProductImages.listFor(productId);
    assert.equal(after.length, before.length - 1);
    assert.ok(!after.some((i) => i.id === before[0]!.id));
  });
});
