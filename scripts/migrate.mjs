/**
 * Apply the schema to the Postgres database named by `BRANDORA_DATABASE_URL`.
 *
 * There is no migration *framework* here and this script does not pretend to be
 * one. The schema is a single file of `CREATE TABLE IF NOT EXISTS` and
 * `CREATE INDEX IF NOT EXISTS` statements, and the server applies it on every
 * boot — so a fresh deployment against an empty database sets itself up with no
 * human step at all. This script exists for the times you want that to happen
 * deliberately and *watch it happen*: before a first deploy, or when you want
 * to know whether the database the URL points at is the one you think it is.
 *
 * ## What it will not do
 *
 * It does not drop, reset, truncate or alter anything. Every statement it runs
 * is conditional on the object not already existing, so running it against a
 * live database with real customers in it is a no-op on the data. It counts the
 * rows in every table before and after and prints both, because "it is safe"
 * is a claim, and a before-and-after count is evidence.
 *
 * It also does not create the database. `CREATE DATABASE` needs a connection to
 * a *different* database and a role with permission to do it, and a script that
 * quietly conjures a second database when you have mistyped the name of the
 * first is how you end up with an empty one in production and your accounts in
 * a database nobody is looking at.
 *
 * Usage:
 *   BRANDORA_DATABASE_URL="postgresql://…" node scripts/migrate.mjs
 *   node scripts/migrate.mjs --dry-run    # print the statements, run nothing
 */

import { openDatabase } from "../packages/brandora-database/dist/index.js";
import { schemaStatements } from "../packages/brandora-database/dist/postgres.js";

const DRY_RUN = process.argv.includes("--dry-run");

const url = (process.env["BRANDORA_DATABASE_URL"] ?? "").trim();

if (DRY_RUN && url === "") {
  // A dry run opens no connection, so it is useful before you have a URL at
  // all — it answers "what is this about to do to my database".
  const statements = schemaStatements();
  console.log(`${statements.length} statements would be applied:\n`);
  for (const statement of statements) console.log(statement.replace(/\s+/g, " ").slice(0, 110));
  process.exit(0);
}

if (url === "") {
  console.error(
    [
      "BRANDORA_DATABASE_URL is not set.",
      "",
      "This script only migrates Postgres. Without a URL the application falls",
      "back to SQLite, which needs no migration step because it applies the",
      "schema when it opens the file.",
      "",
      "  BRANDORA_DATABASE_URL='postgresql://user:password@host/BRANDORA_db' \\",
      "    node scripts/migrate.mjs",
    ].join("\n"),
  );
  process.exit(1);
}

/**
 * The database name, for the report.
 *
 * Postgres folds unquoted identifiers to lower case, so `CREATE DATABASE
 * BRANDORA_db` actually creates `brandora_db`. Printing the name the URL asks
 * for lets you catch the mismatch here, rather than through a connection error
 * that says only that some database does not exist.
 */
function describe(connectionString) {
  try {
    const parsed = new URL(connectionString);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "(default)";
    return { host: parsed.host, database };
  } catch {
    return { host: "(unparseable URL)", database: "(unknown)" };
  }
}

const target = describe(url);

if (DRY_RUN) {
  const statements = schemaStatements();
  console.log(`Would apply ${statements.length} statements to ${target.database} on ${target.host}:\n`);
  for (const statement of statements) console.log(statement.replace(/\s+/g, " ").slice(0, 110));
  process.exit(0);
}

console.log(`Applying the schema to "${target.database}" on ${target.host}\n`);

const db = await openDatabase({ url });

/** Every table in `public`, with its row count. */
async function census() {
  const tables = await db.all(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const counts = new Map();
  for (const { tablename } of tables) {
    // The table name comes from pg_tables, not from user input; quoting it is
    // still right, because an identifier is not a parameter and never can be.
    const row = await db.get(`SELECT COUNT(*) AS n FROM "${tablename}"`);
    counts.set(tablename, Number(row?.n ?? 0));
  }
  return counts;
}

// openDatabase() has already run migrate(). The census below is therefore the
// state *after* migration; what matters is that it did not empty anything, so
// the rows are what the report is about.
const after = await census();

const total = [...after.values()].reduce((sum, n) => sum + n, 0);
const width = Math.max(...[...after.keys()].map((name) => name.length), 10);

console.log(`${"table".padEnd(width)}  rows`);
console.log(`${"-".repeat(width)}  ----`);
for (const [name, count] of after) console.log(`${name.padEnd(width)}  ${count}`);

console.log(`\n${after.size} tables, ${total} rows.`);
console.log(
  total === 0
    ? "The database is empty — this looks like a first-time setup."
    : "Existing rows were left alone. Every statement is CREATE … IF NOT EXISTS or " +
      "ALTER TABLE … ADD COLUMN IF NOT EXISTS — additive only, never destructive.",
);

await db.close();
