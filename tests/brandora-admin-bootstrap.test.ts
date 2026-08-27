import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { type Repositories, createRepositories, type SqlDriver, openSqlite } from "@brandora/database";
import { bootstrapAdmin } from "@brandora/server";

let repos: Repositories;
let db: SqlDriver;

beforeEach(() => {
  db = openSqlite(":memory:");
  repos = createRepositories(db);
});

const silentLogger = { error: () => {} };

describe("admin auto-bootstrap", () => {
  it("does nothing when BRANDORA_ADMIN_EMAIL is unset", async () => {
    const user = await repos.users.create({ email: "founder@example.com", name: "Ada" });
    await bootstrapAdmin(repos, silentLogger, {});
    const after = await repos.users.findById(user.id);
    assert.equal(after?.role, "customer");
  });

  it("does nothing when nobody has signed up with that address yet", async () => {
    await bootstrapAdmin(repos, silentLogger, { BRANDORA_ADMIN_EMAIL: "not-signed-up@example.com" });
    assert.equal(await repos.users.findByEmail("not-signed-up@example.com"), null);
  });

  it("promotes an existing account to admin, without touching its password", async () => {
    const user = await repos.users.create({ email: "owner@example.com", name: "Owner" });
    await repos.users.setCredentials(user.id, "some-hash", "some-salt");

    await bootstrapAdmin(repos, silentLogger, { BRANDORA_ADMIN_EMAIL: "owner@example.com" });

    const after = await repos.users.findById(user.id);
    assert.equal(after?.role, "admin");
    const credentials = await repos.users.credentialsFor(user.id);
    assert.equal(credentials?.passwordHash, "some-hash", "the password must never be touched");
  });

  it("is idempotent — running it again on an already-promoted admin is a no-op", async () => {
    const user = await repos.users.create({ email: "owner@example.com", name: "Owner" });
    await bootstrapAdmin(repos, silentLogger, { BRANDORA_ADMIN_EMAIL: "owner@example.com" });
    await bootstrapAdmin(repos, silentLogger, { BRANDORA_ADMIN_EMAIL: "owner@example.com" });
    const after = await repos.users.findById(user.id);
    assert.equal(after?.role, "admin");
  });

  it("matches the configured email case-insensitively", async () => {
    const user = await repos.users.create({ email: "owner@example.com", name: "Owner" });
    await bootstrapAdmin(repos, silentLogger, { BRANDORA_ADMIN_EMAIL: "Owner@Example.com" });
    const after = await repos.users.findById(user.id);
    assert.equal(after?.role, "admin");
  });
});
