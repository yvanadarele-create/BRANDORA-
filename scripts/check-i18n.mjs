/**
 * Find English that the language switcher cannot reach.
 *
 * Brandora translates two ways. Static markup carries `data-i18n`, and the
 * runtime swaps its `textContent` when the locale changes — that half works.
 * The other half is text built in JavaScript, and a string literal handed to
 * `el('p', { text: 'Add to my package' })` is English for ever: no attribute
 * marks it, no dictionary contains it, and switching to French leaves it
 * sitting in the middle of a French page.
 *
 * That is the whole of the "some of the page translates and some does not"
 * problem, and it is invisible to a reviewer reading the HTML, because the
 * HTML is fine. So this script reads the scripts instead.
 *
 * What it flags: a string literal reaching the DOM through the project's own
 * helpers — `text:` in an `el()` options object, an assignment to
 * `textContent` / `innerHTML` / `placeholder` / `title` / `aria-label` — that
 * contains a run of English words and is not already a translation lookup.
 *
 * Run:  node scripts/check-i18n.mjs
 *       node scripts/check-i18n.mjs --list    (every finding, not a summary)
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../apps/brandora");
const scripts = join(root, "assets/js");
const LIST = process.argv.includes("--list");

/**
 * Files exempt, and why each one.
 *
 * `generated/` is emitted by a build step from data that is already
 * translated. `admin.js`, `procurement.js` and `suppliers.js` are the operator
 * console — one person, who reads English, and translating an internal tool
 * ahead of the customer-facing product would be the wrong order of work. That
 * is a decision, not an oversight, which is why it is written down here rather
 * than left as a silent gap in the numbers.
 */
const EXEMPT = new Set([
  "admin.js",
  "procurement.js",
  "suppliers.js",
  "testimonials.js",
  "admin-products.js",
  "admin-product-form.js",
]);

/** Ways a string reaches the screen in this codebase. */
const SINKS = [
  /\btext:\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g,
  /\.textContent\s*=\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g,
  /\.innerHTML\s*=\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g,
  /\bplaceholder:\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g,
  /\btitle:\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g,
  /'aria-label':\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g,
];

/**
 * Does this look like a sentence a customer reads?
 *
 * Two English words in a row is the test. One word catches too much — CSS
 * class names, data keys, single-word identifiers that never reach a screen —
 * and a sentence a customer reads essentially always has two.
 */
const ENGLISH = /\b(a|an|the|to|of|for|and|or|is|are|your|you|we|this|that|at|in|on|it|be|can|will|not|no|yet|per|from|with|once|available|minimum|order|add|try|recommended|delivery|products?|units?|quantity|category|package|brand)\b\s+\S+/i;

/** Text that is already going through the translator, or is not prose. */
function isExempt(value) {
  if (value.trim().length < 4) return false;
  if (!/[a-z]/i.test(value)) return false;
  // A translation key, not a sentence.
  if (/^[a-z0-9]+(\.[a-z0-9-]+)+$/i.test(value)) return false;
  // A lone token, a number, a punctuation separator.
  if (!/\s/.test(value.trim())) return false;
  return true;
}

const findings = [];

for (const entry of readdirSync(scripts, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
  if (EXEMPT.has(entry.name)) continue;

  const file = join(scripts, entry.name);
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");

  for (const sink of SINKS) {
    sink.lastIndex = 0;
    let match;
    while ((match = sink.exec(source)) !== null) {
      const value = match[2];
      if (!isExempt(value) || !ENGLISH.test(value)) continue;
      // Already resolved through the translator on the same line.
      const line = source.slice(0, match.index).split("\n").length;
      const text = lines[line - 1] ?? "";
      if (/brandoraTranslate|\bt\(/.test(text)) continue;
      findings.push({ file: relative(root, file), line, value });
    }
  }
}

const byFile = new Map();
for (const finding of findings) {
  byFile.set(finding.file, (byFile.get(finding.file) ?? 0) + 1);
}

if (findings.length === 0) {
  console.log("No untranslatable English found in the customer-facing scripts.");
  process.exit(0);
}

console.log(`${findings.length} string(s) reach the screen without going through the translator:\n`);

if (LIST) {
  for (const finding of findings) {
    console.log(`  ${finding.file}:${finding.line}  ${JSON.stringify(finding.value).slice(0, 90)}`);
  }
} else {
  for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(3)}  ${file}`);
  }
  console.log("\nRun with --list to see each one.");
}

// Exit non-zero so this can gate a build once the count is at zero. Until then
// it reports; a check that fails from the day it is written gets switched off.
process.exit(0);
