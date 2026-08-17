/**
 * The Postgres driver.
 *
 * This is what production runs on, and the reason is the deployment target: a
 * serverless function's filesystem is discarded between invocations, so a
 * file-backed database there loses the account it created a moment earlier.
 * Postgres is a server, and does not care which instance the request landed on.
 *
 * Two things about serverless that shape this file:
 *
 * **The pool is tiny and module-scoped.** A serverless instance handles one
 * request at a time, so a large pool would open connections nothing uses while
 * counting against the server's limit — and Postgres runs out of connections
 * long before it runs out of anything else. The pool is created once per cold
 * start and reused across invocations on the same warm instance.
 *
 * **The connection string must be a pooled one.** Every managed provider offers
 * a pgbouncer endpoint alongside the direct one. Pointing hundreds of function
 * instances at a direct endpoint exhausts `max_connections`, and the symptom is
 * not a slow site — it is `too many clients already` on a fraction of requests,
 * which reads like a random outage. `assertPooledUrl` warns when the URL looks
 * direct, because the failure appears under load and never in testing.
 */

import type { Pool, PoolClient } from "pg";

import { type Row, type SqlDriver, toPositional } from "./driver.js";
import { SCHEMA_SQL } from "./schema.generated.js";

/**
 * The schema as individual statements.
 *
 * `pg` will not accept a multi-statement string through a parameterised query,
 * so the file is split. Comments are stripped *before* splitting rather than
 * after: the schema's prose is full of semicolons, and splitting first would
 * cut statements in half at a comma splice.
 */
export function schemaStatements(): string[] {
  return stripComments(SCHEMA_SQL)
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => `${statement};`);
}

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

/**
 * Warn when the URL looks like a direct connection.
 *
 * Not an error: a single long-lived process on a direct endpoint is correct,
 * and refusing to start would break that deployment to protect a different one.
 * The log line is what someone reads when the errors start.
 */
export function assertPooledUrl(url: string, warn: (message: string) => void): void {
  // A loopback database is a developer's own; there is no fleet of function
  // instances to exhaust its connections, so the warning would be noise.
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url);
  const looksPooled = /-pooler|pgbouncer|pool|6543/.test(url);
  if (!looksPooled && !isLocal) {
    warn(
      "BRANDORA_DATABASE_URL does not look like a pooled endpoint. On serverless this " +
        "exhausts Postgres connections under load — use your provider's pooled/pgbouncer URL.",
    );
  }
}

/**
 * Columns added to tables that already exist somewhere.
 *
 * `CREATE TABLE IF NOT EXISTS` is idempotent, which is exactly why it is not
 * enough on its own: on a database where the table is already there, the whole
 * statement is skipped and a column added to the schema file never appears. A
 * fresh deployment would have the column and a live one would not, and the
 * mismatch shows up as a query failing in production against a schema that
 * looks correct in the repository.
 *
 * Postgres has `ADD COLUMN IF NOT EXISTS`, so these are safe to run on every
 * boot and safe to run concurrently. SQLite does not have it — and does not
 * need it, because every SQLite database here is created from scratch by the
 * test that uses it.
 *
 * Additive only. A column that needs dropping or retyping is a real migration
 * with a real ordering problem, and it does not belong in a list that runs
 * unattended on every cold start.
 */
const ADDITIVE_COLUMNS: readonly string[] = [
  "ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS name TEXT;",
  "ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS business TEXT;",
  "ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS interest TEXT;",
  "ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS quantity INTEGER;",

  // Where the conversation with a supplier stands.
  "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS relationship TEXT NOT NULL DEFAULT 'new';",
  "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_contact_at TEXT;",
  "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS next_action TEXT;",

  // Listed, quoted or negotiated — and who said it.
  "ALTER TABLE supplier_offers ADD COLUMN IF NOT EXISTS contact_id TEXT;",
  "ALTER TABLE supplier_offers ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'listed';",
  "ALTER TABLE supplier_offers ADD COLUMN IF NOT EXISTS source_url TEXT;",
  "ALTER TABLE supplier_offers ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';",
  "ALTER TABLE supplier_offers ADD COLUMN IF NOT EXISTS notes TEXT;",
];

/**
 * Constraints that need *widening* on a database that already exists.
 *
 * `CREATE TABLE IF NOT EXISTS` skips the table, so a CHECK list that gained a
 * value in the schema file never reaches a live database — and the symptom is
 * an insert rejected in production against a schema that looks correct in the
 * repository. Adding `made-in-china` to the platform list is exactly that case.
 *
 * Only ever widening. Each of these accepts strictly more than it did before,
 * so no row that is currently valid can become invalid — which is what makes it
 * safe to run unattended on every cold start. A constraint that *narrows* is a
 * real migration with rows to fix first, and does not belong here.
 */
const WIDENED_CONSTRAINTS: readonly string[] = [
  "ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_platform_check;",
  `ALTER TABLE suppliers ADD CONSTRAINT suppliers_platform_check
     CHECK (platform IN ('aliexpress','alibaba','made-in-china','local','direct'));`,
  "ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_relationship_check;",
  `ALTER TABLE suppliers ADD CONSTRAINT suppliers_relationship_check
     CHECK (relationship IN ('new','contacted','responded','awaiting-information',
                             'sample-requested','sample-received','negotiating',
                             'verified','approved','rejected','inactive'));`,
  "ALTER TABLE supplier_offers DROP CONSTRAINT IF EXISTS supplier_offers_price_type_check;",
  `ALTER TABLE supplier_offers ADD CONSTRAINT supplier_offers_price_type_check
     CHECK (price_type IN ('listed','quoted','negotiated'));`,
];

export interface PostgresOptions {
  connectionString: string;
  /** One connection per instance: a serverless invocation serves one request. */
  max?: number;
  /** Overrides the decision `wantsTls` makes from the URL. */
  ssl?: boolean;
  warn?: (message: string) => void;
}

/**
 * Whether to negotiate TLS.
 *
 * Decided from the URL rather than forced on. Every managed provider requires
 * TLS and every local Postgres is built without it, so a hardcoded `ssl: true`
 * fails local development with "the server does not support SSL connections" —
 * and a hardcoded `false` sends a production password over plaintext. The URL
 * already carries the answer: `sslmode` when it is stated, and otherwise the
 * host, since nothing on loopback is crossing a network worth protecting.
 */
export function wantsTls(url: string): boolean {
  const explicit = /[?&]sslmode=([a-z-]+)/i.exec(url)?.[1]?.toLowerCase();
  if (explicit) return explicit !== "disable";
  return !/@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/i.test(url);
}

export class PostgresDriver implements SqlDriver {
  readonly dialect = "postgres" as const;

  private constructor(
    private readonly pool: Pool,
    /** Set when this driver is bound to one client inside a transaction. */
    private readonly client: PoolClient | null = null,
  ) {}

  /**
   * `pg` is imported dynamically so the package works with it absent.
   *
   * The test suite runs on SQLite and should not require a Postgres client to
   * be installed to do it; and a build that fails on a missing optional
   * dependency fails at the least useful moment.
   */
  static async connect(options: PostgresOptions): Promise<PostgresDriver> {
    const warn = options.warn ?? ((message: string) => console.warn(`[brandora] ${message}`));
    assertPooledUrl(options.connectionString, warn);

    const pg = await import("pg").catch(() => {
      throw new Error(
        "BRANDORA_DATABASE_URL is set but the `pg` package is not installed. Run `pnpm add pg`.",
      );
    });

    const pool = new pg.default.Pool({
      connectionString: options.connectionString,
      max: options.max ?? 1,
      // `rejectUnauthorized: false` because managed providers commonly present
      // a chain Node does not carry a root for, and failing to connect at all
      // is worse than not pinning. The password is still encrypted in flight.
      ...((options.ssl ?? wantsTls(options.connectionString))
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });

    return new PostgresDriver(pool);
  }

  private async query(sql: string, params: readonly unknown[]): Promise<Row[]> {
    const text = toPositional(sql);
    const runner = this.client ?? this.pool;
    const result = await runner.query(text, params as unknown[]);
    return result.rows as Row[];
  }

  async all(sql: string, params: readonly unknown[] = []): Promise<Row[]> {
    return this.query(sql, params);
  }

  async get(sql: string, params: readonly unknown[] = []): Promise<Row | null> {
    const rows = await this.query(sql, params);
    return rows[0] ?? null;
  }

  async run(sql: string, params: readonly unknown[] = []): Promise<void> {
    await this.query(sql, params);
  }

  /**
   * A transaction is bound to one client for its whole life.
   *
   * Issuing BEGIN on a pool and COMMIT on whatever connection the pool hands
   * out next is a transaction that silently does nothing — and with a pooler in
   * front, it is not even reliably the same server session.
   */
  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    if (this.client) return fn(this);

    const client = await this.pool.connect();
    const bound = new PostgresDriver(this.pool, client);
    try {
      await client.query("BEGIN");
      const out = await fn(bound);
      await client.query("COMMIT");
      return out;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Apply the schema. Every statement is `IF NOT EXISTS`, so this is idempotent.
   *
   * The order is three phases, and it matters. Running the schema file top to
   * bottom and then the ALTERs looks right and is wrong: on a database where a
   * table already exists, `CREATE TABLE IF NOT EXISTS` is skipped, so a column
   * added to the schema file arrives only via `ADDITIVE_COLUMNS` — but the
   * index on that column sits in the schema file and runs first. It then fails
   * with `column "relationship" does not exist`, on exactly the live databases
   * this code exists to protect, and never on a fresh one where the tests run.
   *
   * So: tables, then columns, then everything that depends on a column being
   * there.
   */
  async migrate(): Promise<void> {
    const statements = schemaStatements();
    const dependsOnColumns = (sql: string): boolean => /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(sql);

    for (const statement of statements.filter((sql) => !dependsOnColumns(sql))) {
      await this.run(statement);
    }
    for (const statement of ADDITIVE_COLUMNS) {
      await this.run(statement);
    }
    for (const statement of statements.filter(dependsOnColumns)) {
      await this.run(statement);
    }
    for (const statement of WIDENED_CONSTRAINTS) {
      await this.run(statement);
    }
  }

  async close(): Promise<void> {
    if (this.client) return;
    await this.pool.end();
  }
}
