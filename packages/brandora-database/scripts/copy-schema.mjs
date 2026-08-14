/**
 * Compile schema.sql into a TypeScript module.
 *
 * This used to copy the file next to the compiled output, and both drivers read
 * it back with `readFileSync(resolve(here, "schema.sql"))`. That works
 * everywhere a process can see its own directory, and fails on Vercel.
 *
 * A serverless function is not the repository. Vercel decides what goes into
 * the bundle by statically tracing `import` and `require` from the entrypoint;
 * a path computed at runtime from `import.meta.url` is invisible to that
 * analysis, so `schema.sql` would simply not be there. The failure arrives at
 * the first cold start as an ENOENT from inside `migrate()`, long after the
 * build went green — the worst possible place to learn about it.
 *
 * Generating a module instead means the schema is reached by an ordinary
 * `import`. The bundler traces it like any other dependency and there is no
 * filesystem read left to fail. `schema.sql` stays the source of truth: it is
 * still the file you edit, still highlighted as SQL, still readable in a diff.
 *
 * Runs before `tsc`, so the generated file is compiled with everything else.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");

const sql = readFileSync(join(src, "schema.sql"), "utf8");

// A backtick, a backslash or a `${` inside the SQL would end the template
// literal or start an interpolation. None appears in the schema today; escaping
// anyway costs nothing and means adding a regex CHECK constraint later cannot
// silently produce a generated file that does not parse.
const escaped = sql.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const generated = `/**
 * GENERATED FILE — do not edit.
 *
 * Written from src/schema.sql by scripts/copy-schema.mjs. Edit the .sql file.
 *
 * It exists so the schema travels as code rather than as a file to be located
 * at runtime: a serverless bundler traces imports, not computed paths.
 */

export const SCHEMA_SQL = \`${escaped}\`;
`;

// Only rewrite when it changed, so a no-op build does not churn the file's
// mtime and invalidate every downstream cache.
const target = join(src, "schema.generated.ts");
let existing = "";
try {
  existing = readFileSync(target, "utf8");
} catch {
  existing = "";
}
if (existing !== generated) writeFileSync(target, generated, "utf8");

process.stdout.write(`database: schema.generated.ts is ${sql.length} bytes of SQL\n`);
