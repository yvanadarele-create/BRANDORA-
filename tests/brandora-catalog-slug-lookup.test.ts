import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createApp } from "@brandora/server";
import { openSqlite } from "@brandora/database";

/**
 * `catalogById` (routes.ts) has to resolve a product two ways: by the
 * database's own generated id (what a dynamically-rendered page like
 * catalog.html hands back to itself) and by the product's stable slug
 * (what a *static*, committed page — the homepage gallery — has to hard-code,
 * since a database id is generated fresh in every environment and can never
 * safely appear in source). This is the one test suite that boots the real,
 * database-backed catalogue instead of the static `catalog:` fixture every
 * other test uses, because the behaviour under test only exists on that path.
 */

let base: string;
let server: Server;

before(async () => {
  const app = await createApp({
    db: openSqlite(":memory:"),
    env: { BRANDORA_AUTH_SECRET: "test-secret-01234567890123456789012345" },
    logger: { error: () => {} },
  });
  server = createServer(app.listener);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

after(() => new Promise<void>((done) => server.close(() => done())));

describe("looking a catalogue product up by slug, not only by database id", () => {
  it("resolves a known-good slug from the built-in seed", async () => {
    const response = await fetch(`${base}/api/catalog/box_bakery_gable`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { product: { name: string } };
    assert.match(body.product.name, /gable/i);
  });

  it("also resolves the database id the public list handed back", async () => {
    const list = await fetch(`${base}/api/catalog?quantity=1`);
    const { products } = (await list.json()) as { products: { id: string; name: string }[] };
    const target = products.find((p) => /gable/i.test(p.name))!;
    assert.ok(target);

    const response = await fetch(`${base}/api/catalog/${target.id}`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { product: { id: string } };
    assert.equal(body.product.id, target.id);
  });

  it("404s on a slug that does not exist, same as an unknown id", async () => {
    const response = await fetch(`${base}/api/catalog/not-a-real-slug`);
    assert.equal(response.status, 404);
  });
});
