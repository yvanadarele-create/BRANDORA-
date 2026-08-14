/**
 * The SQLite driver.
 *
 * `node:sqlite` is built into Node 22: no dependency, no native build step, no
 * connection pool to misconfigure. It backs the test suite, where `:memory:`
 * gives every test its own database with nothing to clean up, and local
 * development, where a file is simpler than running a server.
 *
 * It is not what production uses — see `driver.ts` for why.
 *
 * The methods are async because the interface is. The work underneath is
 * synchronous, and pretending otherwise would be dishonest; what matters is
 * that a caller cannot tell which backend it is talking to.
 */

import { DatabaseSync } from "node:sqlite";

import type { Row, SqlDriver } from "./driver.js";
import { SCHEMA_SQL } from "./schema.generated.js";

/**
 * The schema, as a string.
 *
 * Imported rather than read off disk. See scripts/copy-schema.mjs: a path
 * computed at runtime is invisible to a serverless bundler's import tracing,
 * and the schema going missing from the bundle is an ENOENT at the first cold
 * start rather than a build failure.
 */
export const readSchema = (): string => SCHEMA_SQL;

export class SqliteDriver implements SqlDriver {
  readonly dialect = "sqlite" as const;

  constructor(private readonly db: DatabaseSync) {}

  /**
   * Open a database and apply the schema.
   *
   * Foreign keys are off by default in SQLite, which means a schema full of
   * REFERENCES clauses enforces nothing until this runs. Turning them on is not
   * optional tuning; without it the constraints are decoration.
   */
  static open(location = ":memory:"): SqliteDriver {
    const db = new DatabaseSync(location);
    db.exec("PRAGMA foreign_keys = ON;");
    if (location !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
    db.exec(readSchema());
    return new SqliteDriver(db);
  }

  async all(sql: string, params: readonly unknown[] = []): Promise<Row[]> {
    return this.db.prepare(sql).all(...(params as never[])) as Row[];
  }

  async get(sql: string, params: readonly unknown[] = []): Promise<Row | null> {
    return (this.db.prepare(sql).get(...(params as never[])) as Row | undefined) ?? null;
  }

  async run(sql: string, params: readonly unknown[] = []): Promise<void> {
    this.db.prepare(sql).run(...(params as never[]));
  }

  async transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN");
    try {
      const out = await fn(this);
      this.db.exec("COMMIT");
      return out;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  async migrate(): Promise<void> {
    this.db.exec(readSchema());
  }

  async close(): Promise<void> {
    this.db.close();
  }

  /** The underlying handle, for the few tests that assert on SQLite itself. */
  get handle(): DatabaseSync {
    return this.db;
  }
}
