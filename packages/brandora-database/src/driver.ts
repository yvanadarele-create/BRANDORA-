/**
 * The database, behind one small interface.
 *
 * Brandora runs on Postgres in production and on SQLite in the test suite. That
 * is not indecision — it is the only way to have both properties that matter:
 *
 *   - **Production persists.** A serverless function's local disk is discarded
 *     between invocations, so a file-backed database there loses an account
 *     between the request that created it and the next one. Postgres is a
 *     server; it does not care where the function ran.
 *   - **Tests are hermetic and fast.** `:memory:` SQLite gives every test its
 *     own database with nothing to clean up and no external service to run. A
 *     suite that needs a Postgres container is a suite people stop running.
 *
 * The cost of two backends is that the SQL has to be portable, which is checked
 * rather than hoped: `tests/brandora-postgres.test.ts` runs the same repository
 * assertions against both drivers whenever a Postgres URL is available, and the
 * schema is emitted from one source for both dialects.
 *
 * Everything here is async, including SQLite. A synchronous interface would
 * make the SQLite implementation slightly tidier and the Postgres one
 * impossible.
 */

export type Row = Record<string, unknown>;

export type Dialect = "sqlite" | "postgres";

export interface SqlDriver {
  readonly dialect: Dialect;
  all(sql: string, params?: readonly unknown[]): Promise<Row[]>;
  get(sql: string, params?: readonly unknown[]): Promise<Row | null>;
  run(sql: string, params?: readonly unknown[]): Promise<void>;
  /**
   * Run `fn` against a connection held for the duration, rolling back if it
   * throws. The callback receives its own driver: on Postgres a transaction is
   * bound to one pooled client, and statements issued on any other connection
   * are simply not in it.
   */
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
  /** Apply the schema. Every statement is `IF NOT EXISTS`, so it is idempotent. */
  migrate(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Rewrite `?` placeholders as `$1, $2, …`.
 *
 * Every query in this package is written with `?`, because that is the form
 * both dialects' documentation uses and it keeps the SQL readable. Postgres
 * wants positional markers, so they are converted at the edge.
 *
 * Deliberately naive about quoting: it would corrupt a query containing a `?`
 * inside a string literal. No query in this package has one, and a test asserts
 * that stays true — a smarter parser here would be a SQL tokeniser nobody
 * needs.
 */
export function toPositional(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${(index += 1)}`);
}
