import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { CATALOG } from "@brandora/catalog";
import { type Repositories, createRepositories, type SqlDriver, openSqlite } from "@brandora/database";
import { seedCatalogIfEmpty, seedNewCatalogProducts } from "@brandora/server";

let repos: Repositories;
let db: SqlDriver;

beforeEach(() => {
  db = openSqlite(":memory:");
  repos = createRepositories(db);
});

const silentLogger = { error: () => {} };

describe("catalogue new-product sync", () => {
  it("also fills a completely empty table — every product is 'missing by slug'", async () => {
    await seedNewCatalogProducts(repos, silentLogger);
    const rows = await repos.catalogProducts.listAsAdmin(1000);
    assert.equal(rows.length, CATALOG.length);
  });

  it("adds every product missing by slug once the table has some rows", async () => {
    await seedCatalogIfEmpty(repos, silentLogger);
    const before = await repos.catalogProducts.listAsAdmin(1000);
    assert.equal(before.length, CATALOG.length);

    // Simulate the real situation: production already has the catalogue as
    // it stood before a new product was written into CATALOG. Remove one.
    const target = before.find((row) => row.name === CATALOG[0]!.name)!;
    await repos.catalogProducts.remove(target.id);

    const afterRemoval = await repos.catalogProducts.listAsAdmin(1000);
    assert.equal(afterRemoval.length, CATALOG.length - 1);

    await seedNewCatalogProducts(repos, silentLogger);
    const afterSync = await repos.catalogProducts.listAsAdmin(1000);
    assert.equal(afterSync.length, CATALOG.length, "the missing product should have come back");
  });

  it("never touches a row that already exists — an administrator's edit survives", async () => {
    await seedCatalogIfEmpty(repos, silentLogger);
    const rows = await repos.catalogProducts.listAsAdmin(1000);
    const edited = rows[0]!;

    await repos.catalogProducts.update(edited.id, { name: "A name an administrator chose" });

    await seedNewCatalogProducts(repos, silentLogger);

    const stillEdited = await repos.catalogProducts.findById(edited.id);
    assert.equal(stillEdited?.name, "A name an administrator chose");
  });

  it("is idempotent — running it twice in a row adds nothing the second time", async () => {
    await seedCatalogIfEmpty(repos, silentLogger);
    await seedNewCatalogProducts(repos, silentLogger);
    const once = await repos.catalogProducts.listAsAdmin(1000);

    await seedNewCatalogProducts(repos, silentLogger);
    const twice = await repos.catalogProducts.listAsAdmin(1000);

    assert.equal(twice.length, once.length);
  });
});
