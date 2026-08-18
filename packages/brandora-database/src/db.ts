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

/**
 * A JSON column that must come back as an array.
 *
 * `fromJson` casts whatever it parsed to `T` and trusts the caller's type
 * argument, which is fine until the stored value is not the shape the column is
 * supposed to hold. A strategy whose `personality` was written as the string
 * "warm, reliable" instead of `["warm","reliable"]` parses back as a string,
 * satisfies `fromJson<string[]>` as far as the compiler is concerned, and then
 * throws `personality.join is not a function` the first time anything reads it.
 *
 * That failure is permanent: the row is on disk, so every load of the brand
 * book 500s until somebody edits the database. A model returning a string where
 * an array was asked for is exactly the malformed response this layer exists to
 * absorb, so the shape is checked rather than assumed.
 *
 * A single string is wrapped rather than discarded — "warm, reliable" is data
 * somebody meant, and losing it silently is its own bug.
 */
export function fromJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  const parsed = fromJson<unknown>(value, null);
  if (Array.isArray(parsed)) return parsed as T[];
  if (typeof parsed === "string" && parsed.trim() !== "") {
    return parsed.split(/\s*[,;·]\s*/).filter(Boolean) as unknown as T[];
  }
  return fallback;
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
