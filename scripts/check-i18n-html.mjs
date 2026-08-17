/**
 * Find English in the markup that the language switcher cannot reach.
 *
 * Its sibling `check-i18n.mjs` scans the page *scripts*. This one scans the
 * pages, and the two are not the same problem — which is exactly the mistake
 * that produced a report saying translation was fixed while a French visitor
 * was still reading English headings. Fixing the scripts fixed the product
 * cards; it did nothing for a `<p>` in the founder story that no attribute
 * marks.
 *
 * The rule is simple: any element whose own text is a sentence must carry
 * `data-i18n`, or the runtime will never touch it. Placeholders, titles and
 * aria-labels need `data-i18n-attr` for the same reason.
 *
 * Run:  node scripts/check-i18n-html.mjs
 *       node scripts/check-i18n-html.mjs --list
 *       node scripts/check-i18n-html.mjs --page index.html
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../apps/brandora");
const LIST = process.argv.includes("--list");
// `indexOf` returns -1 when the flag is absent, and argv[0] is the node binary
// — a truthy string that would silently filter every page out.
const pageFlag = process.argv.indexOf("--page");
const onlyPage = pageFlag === -1 ? null : process.argv[pageFlag + 1];

/** Operator screens. English on purpose — see check-i18n.mjs for why. */
const EXEMPT = new Set(["admin.html", "procurement.html", "suppliers.html", "testimonials.html"]);

/** Elements whose contents are not prose a visitor reads. */
const NOT_PROSE = /^(script|style|svg|path|code|pre|template|noscript)$/i;

/**
 * A sentence, rather than a label, a number or a brand name.
 *
 * Two words minimum, at least one of them an ordinary English word. "BRANDORA
 * UNION" is not English needing translation; "Where brands take form." is.
 */
const ENGLISH_WORD =
  /\b(a|an|the|and|or|to|of|for|in|on|at|is|are|was|be|been|your|you|we|our|this|that|with|from|by|it|its|as|so|but|not|no|yet|can|will|what|when|where|who|how|why|which|make|makes|made|build|builds|take|takes|get|gets|need|needs|help|helps|want|wants|know|knows|see|sees|more|most|first|every|all|one|two|three|about|into|out|up|down|over|under|then|than|because|if|before|after|while|does|do|did|have|has|had|they|them|their|there|here|now|new|own|same|other|any|each|few|many|much|some|such|only|just|also|even|still|back|way|thing|things|people|business|brand|brands|product|products)\b/i;

const problems = [];

/** Strip elements whose text is not prose, so their contents are not scanned. */
function stripNonProse(html) {
  return html.replace(
    /<(script|style|svg|template|noscript|code|pre)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (match) => " ".repeat(match.length),
  );
}

const pages = readdirSync(root)
  .filter((file) => file.endsWith(".html"))
  .filter((file) => !EXEMPT.has(file))
  .filter((file) => !onlyPage || file === onlyPage);

for (const page of pages) {
  const raw = readFileSync(join(root, page), "utf8");
  const html = stripNonProse(raw);

  /*
   * Leaf elements only.
   *
   * `data-i18n` swaps textContent, which would destroy child elements — so a
   * wrapper containing other tags is not a candidate and its children are
   * checked instead. Matching a tag with no `<` in its body is what "leaf"
   * means here, and it is why this works on markup without a DOM parser.
   */
  const leaf = /<(h1|h2|h3|h4|h5|h6|p|span|li|a|button|label|td|th|figcaption|summary|strong|em|option|legend|dt|dd)\b([^>]*)>([^<]+)<\/\1>/gi;

  let match;
  while ((match = leaf.exec(html)) !== null) {
    const [, tag, attrs, body] = match;
    if (NOT_PROSE.test(tag)) continue;
    if (/\bdata-i18n\s*=/.test(attrs)) continue;
    // Rendered by script from server data — translating the shell is right and
    // translating the value would be wrong.
    if (/\bdata-(count|error|status|question|products|near-misses|testimonials)\b/.test(attrs)) continue;

    const text = body.replace(/&[a-z]+;|&#\d+;/gi, " ").trim();
    if (text.length < 4) continue;
    if (!/\s/.test(text)) continue;            // one word: a label or a name
    if (!ENGLISH_WORD.test(text)) continue;    // not English prose
    if (/^[\d\s.,:%+-]+$/.test(text)) continue; // numbers

    const line = html.slice(0, match.index).split("\n").length;
    problems.push({ page, line, tag, text: text.replace(/\s+/g, " ") });
  }

  // Attributes a visitor reads, which need data-i18n-attr rather than data-i18n.
  const attrPattern = /<[a-z-]+\b([^>]*\b(placeholder|title|aria-label)\s*=\s*"([^"]+)"[^>]*)>/gi;
  while ((match = attrPattern.exec(html)) !== null) {
    const [, attrs, which, value] = match;
    if (/\bdata-i18n-attr\s*=/.test(attrs)) continue;
    const text = value.trim();
    if (text.length < 4 || !/\s/.test(text) || !ENGLISH_WORD.test(text)) continue;
    const line = html.slice(0, match.index).split("\n").length;
    problems.push({ page, line, tag: `@${which}`, text });
  }
}

const byPage = new Map();
for (const problem of problems) byPage.set(problem.page, (byPage.get(problem.page) ?? 0) + 1);

if (problems.length === 0) {
  console.log(`No untranslatable English in ${pages.length} customer-facing pages.`);
  process.exit(0);
}

console.log(`${problems.length} element(s) across ${byPage.size} page(s) cannot be translated:\n`);

if (LIST) {
  for (const problem of problems) {
    console.log(`  ${problem.page}:${problem.line}  <${problem.tag}>  ${JSON.stringify(problem.text).slice(0, 100)}`);
  }
} else {
  for (const [page, count] of [...byPage].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(3)}  ${page}`);
  }
  console.log("\nRun with --list to see each one, or --page <file> for one page.");
}

process.exit(0);
