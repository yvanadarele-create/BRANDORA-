#!/usr/bin/env node
/**
 * Integrity check for the Brandora front end (apps/brandora).
 *
 * Runs with no browser and no server, so it works in CI. It catches the class of
 * breakage that a rename or a file move introduces — a dead asset reference, a
 * duplicate id, a page that lost its metadata — and three Brandora-specific
 * rules that matter more than any of those:
 *
 *   - No page may reference a secret environment variable (§29).
 *   - Every page must offer both the language switcher and the theme toggle,
 *     because §23 and §7 are promises about the whole application, not the
 *     landing page.
 *   - The generated data the pages fetch must actually exist, or the site loads
 *     to an empty catalogue and a spinner.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../apps/brandora");

const problems = [];
const pages = readdirSync(root).filter((file) => file.endsWith(".html"));

if (pages.length === 0) problems.push("no HTML pages found in apps/brandora");

/**
 * Names of secrets that must never appear in anything served to a browser.
 *
 * The name is not the secret, but a name in a file under the static root means
 * someone was reading that variable in code the CDN serves — and the value is
 * one edit away. Every secret the application reads belongs on this list; the
 * list was previously short enough that a Paystack key or the session-signing
 * secret could have been referenced here and the build would have passed.
 */
const FORBIDDEN = [
  "ALIEXPRESS_APP_KEY",
  "ALIEXPRESS_APP_SECRET",
  "ALIEXPRESS_ACCESS_TOKEN",
  "ALIEXPRESS_REFRESH_TOKEN",
  "ANTHROPIC_API_KEY",
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "BRANDORA_AUTH_SECRET",
  "BRANDORA_DATABASE_URL",
];

/**
 * And the shapes of the values themselves.
 *
 * Matching names catches the careful mistake. This catches the careless one:
 * a key pasted straight into a script while debugging, which carries no
 * variable name at all and which the list above would wave through.
 */
const SECRET_SHAPES = [
  [/\bsk-ant-[A-Za-z0-9_-]{16,}/, "an Anthropic API key"],
  [/\bsk_(live|test)_[A-Za-z0-9]{16,}/, "a Paystack/Stripe secret key"],
  [/\bre_[A-Za-z0-9]{16,}/, "a Resend API key"],
  [/\bpostgres(ql)?:\/\/[^\s'"]*:[^\s'"@]+@/, "a Postgres URL with a password in it"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key id"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "a private key"],
];

/**
 * Pages that are deliberately in one language, and so carry no switcher.
 *
 * The §23 rule below — every page offers all three languages — is a promise
 * about the *application*, and it stays in force for every screen a customer
 * uses. A single-market campaign page is a different object: `lancement.html`
 * is French throughout, aimed at the launch market, and a switcher there would
 * offer two languages the page does not have. That is a broken control, not a
 * translated page.
 *
 * Listed by name rather than inferred from `lang="fr"`, so a page can only ever
 * lose the switcher on purpose. Adding one here is a decision; forgetting the
 * switcher is still a build failure everywhere else.
 */
const FRENCH_ONLY = new Set(["lancement.html"]);

for (const page of pages) {
  const html = readFileSync(join(root, page), "utf8");
  const where = `apps/brandora/${page}`;

  if (!/<html[^>]+lang=/.test(html)) problems.push(`${where}: <html> missing lang`);
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${where}: missing <title>`);
  if (!/<meta\s+name="description"/.test(html)) problems.push(`${where}: missing meta description`);
  if (!/<meta\s+name="viewport"/.test(html)) problems.push(`${where}: missing viewport`);

  if (!FRENCH_ONLY.has(page) && !/data-locale-switch/.test(html)) {
    problems.push(`${where}: no language switcher (§23)`);
  }
  if (!/data-theme-toggle/.test(html)) problems.push(`${where}: no dark/light toggle (§7)`);
  if (!/class="skip-link"/.test(html)) problems.push(`${where}: no skip link`);

  for (const secret of FORBIDDEN) {
    if (html.includes(secret)) problems.push(`${where}: references ${secret} — secrets never reach the browser (§29)`);
  }

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  for (const duplicate of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) {
    problems.push(`${where}: duplicate id #${duplicate}`);
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(ref)) continue;
    const [pathPart] = ref.split("#");
    if (!pathPart) continue;
    const target = join(root, pathPart.split("?")[0]);
    if (!existsSync(target)) problems.push(`${where}: broken reference to ${ref}`);
  }
}

/* --- Generated data the pages fetch at runtime ---------------------------- */

const GENERATED = [
  "data/catalog.json",
  "data/interview.json",
  "locales/en.json",
  "locales/fr.json",
  "locales/es.json",
  "assets/js/generated/color.js",
  "assets/js/generated/identity.js",
];

for (const file of GENERATED) {
  if (!existsSync(join(root, file))) {
    problems.push(`apps/brandora/${file} is missing — run the package builds that emit it`);
  }
}

/* --- Scripts must not carry secrets either -------------------------------- */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    // .css and .mjs are here because a secret does not care what extension it
    // was pasted into, and everything under this root is served verbatim.
    else if (/\.(js|mjs|json|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * `api/` is a function directory, not static content.
 *
 * Vercel compiles everything under `api/` into serverless functions and never
 * serves it to a browser, so code there is *supposed* to read environment
 * variables by name — that is what a backend is. Applying the name list to it
 * would fail the build for `api/index.js` doing its job.
 *
 * The value shapes still apply. A key pasted into a function is not exposed to
 * customers, but it is committed to git, and a repository is a place secrets
 * leak from. Names are exempt here; values never are, anywhere.
 */
const isServerFunction = (file) => /(^|[/\\])api[/\\]/.test(file.slice(root.length));

for (const file of [...walk(root), ...pages.map((page) => join(root, page))]) {
  const contents = readFileSync(file, "utf8");
  for (const [shape, what] of SECRET_SHAPES) {
    if (shape.test(contents)) problems.push(`${file}: looks like it contains ${what} (§29)`);
  }
  if (isServerFunction(file)) continue;
  for (const secret of FORBIDDEN) {
    if (contents.includes(secret)) problems.push(`${file}: references ${secret} (§29)`);
  }
}

/* --- Every helper used is a helper imported -------------------------------- */

/**
 * Catch `t is not defined` before a customer does.
 *
 * There is no bundler here — page scripts are ES modules the browser loads
 * directly — so a helper used without being imported is not a build error. It
 * is a ReferenceError at runtime, thrown at module evaluation, which stops the
 * *entire script*. The symptom is not a missing word: it is a page where
 * nothing works and the console says one line. That is precisely what happened
 * to the homepage while these translations were being wired, and it survived a
 * syntax check, a type check and 500 unit tests, because none of them evaluate
 * a browser module.
 *
 * So: for each helper `api.js` exports, if a script calls it, the script must
 * import it. Cheap, and it fails the build rather than the homepage.
 */
const apiSource = readFileSync(join(root, "assets/js/api.js"), "utf8");
const HELPERS = [...apiSource.matchAll(/^export (?:async )?function (\w+)|^export const (\w+)/gm)]
  .map((match) => match[1] ?? match[2])
  .filter(Boolean);

for (const file of walk(join(root, "assets/js"))) {
  if (file.endsWith("/api.js") || file.includes("/generated/")) continue;
  const source = readFileSync(file, "utf8");
  if (!/from '\.\/api\.js'/.test(source)) continue;

  const importBlock = /import\s*\{([\s\S]*?)\}\s*from\s*'\.\/api\.js'/.exec(source);
  const imported = new Set(
    (importBlock?.[1] ?? "")
      .split(",")
      .map((name) => name.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean),
  );

  for (const helper of HELPERS) {
    // A call, not a mention: `t(` and not `t` inside a longer identifier, and
    // not a property access like `state.t`.
    const called = new RegExp(`(^|[^\\w.$])${helper}\\s*\\(`, "m");
    if (!called.test(source)) continue;
    // Declared locally instead — legitimate, and how this file used to work.
    if (new RegExp(`(function|const|let|var)\\s+${helper}\\b`).test(source)) continue;
    if (!imported.has(helper)) {
      problems.push(
        `${file}: calls ${helper}() but does not import it from api.js — ` +
          `this is a ReferenceError that stops the whole script`,
      );
    }
  }
}

/* --- Translation coverage --------------------------------------------------- */

/*
 * Both halves, in the build, from now on.
 *
 * These ran as separate commands and were reported as passing while a French
 * visitor still read English — because only the script half had been measured
 * and the markup half had never been looked at. A check that has to be
 * remembered is a check that gets forgotten.
 */
for (const checker of ["check-i18n.mjs", "check-i18n-html.mjs"]) {
  const result = spawnSync(process.execPath, [join(here, checker)], { encoding: "utf8" });
  const output = `${result.stdout ?? ""}`.trim();
  if (!/^No untranslatable English/.test(output)) {
    problems.push(`${checker}: ${output.split("\n")[0]} — run \`node scripts/${checker} --list\``);
  }
}

/* --- Report --------------------------------------------------------------- */

if (problems.length > 0) {
  console.error(`\nBrandora front-end check failed with ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error("");
  process.exit(1);
}

console.log(`Brandora front-end check passed — ${pages.length} pages, ${GENERATED.length} generated files.`);
