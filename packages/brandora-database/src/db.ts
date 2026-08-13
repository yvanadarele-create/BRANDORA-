/**
 * Opening a database, and the conversions every repository needs.
 *
 * Which backend you get is decided by the environment, once, here:
 * `BRANDORA_DATABASE_URL` means Postgres; its absence means SQLite at
 * `BRANDORA_DATABASE_PATH`. Nothing above this file knows or asks.
 */

import { type CurrencyCode, type Money, isCurrency, money } from "@brandora/shared";

import type { SqlDriver } from "./driver.js";
import { PostgresDriver } from "./postgres.js";
import { SqliteDriver } from "./sqlite.js";

export interface OpenOptions {
  /** A Postgres connection string. Takes precedence over `path`. */
  url?: string | undefined;
  /** A SQLite file, or `:memory:`. Used when no URL is given. */
  path?: string | undefined;
  warn?: (message: string) => void;
}

/**
 * Open the database this deployment is configured for, schema applied.
 *
 * `:memory:` gives every test an isolated database with nothing to clean up,
 * which keeps the suite parallel-safe and free of shared fixture state.
 */
export async function openDatabase(options: OpenOptions = {}): Promise<SqlDriver> {
  if (options.url && options.url.trim() !== "") {
    const driver = await PostgresDriver.connect({
      connectionString: options.url.trim(),
      ...(options.warn ? { warn: options.warn } : {}),
    });
    await driver.migrate();
    return driver;
  }
  return SqliteDriver.open(options.path ?? ":memory:");
}

/** A SQLite database, for tests and for a single-process deployment. */
export const openSqlite = (location = ":memory:"): SqlDriver => SqliteDriver.open(location);

/** Run `fn` in a transaction, rolling back if it throws. */
export const transaction = <T>(db: SqlDriver, fn: (tx: SqlDriver) => Promise<T>): Promise<T> =>
  db.transaction(fn);

export const nowIso = (): string => new Date().toISOString();

export const toJson = (value: unknown): string => JSON.stringify(value ?? null);

export function fromJson<T>(value: unknown, fallback: T): T {
  // Postgres `json`/`jsonb` columns come back already parsed; SQLite hands back
  // the string it stored. Both are handled rather than one being assumed, or
  // the same row would read differently on the two backends.
  if (value !== null && typeof value === "object") return value as T;
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export const text = (value: unknown): string => (typeof value === "string" ? value : String(value ?? ""));

export const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

/**
 * A whole number from a column.
 *
 * Handles `bigint` because Postgres returns `COUNT(*)` as one, and `Number(123n)`
 * is fine while `123n + 1` is a TypeError three lines later.
 */
export const int = (value: unknown): number => {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Rebuild a Money from its two columns.
 *
 * Amount and currency are always stored and read together. A helper that
 * returned just the integer would be the first step toward an amount travelling
 * without its currency, which is how a 1 500 XOF price becomes a 1 500 USD one.
 */
export function readMoney(amount: unknown, currency: unknown): Money {
  const code = text(currency).toUpperCase();
  const resolved: CurrencyCode = isCurrency(code) ? code : "XOF";
  return money(int(amount), resolved);
}
