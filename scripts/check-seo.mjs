/**
 * Keep the SEO surface honest and internally consistent.
 *
 * Three files have to agree with each other, and nothing enforced that before
 * this script: every page's own `<meta name="robots">`, `sitemap.xml`, and
 * `robots.txt`. It is easy for these to drift — a page added to the site and
 * never added to the sitemap, a page marked noindex that the sitemap still
 * lists (Google receives two contradictory instructions and the page's own
 * tag should always win, but a contradiction is a sign something was edited
 * in one place and not the other), a canonical URL still pointing at a
 * retired domain after the domain changes.
 *
 * This does not check whether the SEO is *good* — it checks that the three
 * files cannot silently disagree with each other or with reality.
 *
 * Run:  node scripts/check-seo.mjs
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../apps/brandora");
const DOMAIN = "https://brandoraunion.online";

const problems = [];

const pages = readdirSync(root).filter((f) => f.endsWith(".html"));

/** id="value" or class="value" — good enough for the single-line meta tags this repo writes. */
const attr = (tag, name) => {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
};

const pageState = new Map();

for (const page of pages) {
  const html = readFileSync(join(root, page), "utf8");
  const where = (what) => `${page}: ${what}`;

  const titles = html.match(/<title>[^<]*<\/title>/g) ?? [];
  if (titles.length !== 1) {
    problems.push(where(`expected exactly one <title>, found ${titles.length}`));
  }

  const descriptions = html.match(/<meta name="description"[^>]*>/g) ?? [];
  if (descriptions.length !== 1) {
    problems.push(where(`expected exactly one meta description, found ${descriptions.length}`));
  }

  const canonicals = html.match(/<link rel="canonical"[^>]*>/g) ?? [];
  if (canonicals.length !== 1) {
    problems.push(where(`expected exactly one canonical link, found ${canonicals.length}`));
  } else {
    const href = attr(canonicals[0], "href");
    if (!href || !href.startsWith(DOMAIN)) {
      problems.push(where(`canonical href "${href}" does not start with ${DOMAIN} — a stale domain?`));
    }
  }

  const robotsTags = html.match(/<meta name="robots"[^>]*>/g) ?? [];
  if (robotsTags.length !== 1) {
    problems.push(where(`expected exactly one robots meta tag, found ${robotsTags.length}`));
  }

  const robotsContent = robotsTags[0] ? attr(robotsTags[0], "content") : null;
  const indexable = robotsContent === "index, follow";
  if (robotsContent && !indexable && robotsContent !== "noindex, nofollow") {
    problems.push(where(`unrecognised robots directive "${robotsContent}" — expected "index, follow" or "noindex, nofollow"`));
  }

  pageState.set(page, { indexable });
}

/* --- sitemap.xml must list exactly the indexable pages, nothing else ------- */

const sitemapPath = join(root, "sitemap.xml");
if (!existsSync(sitemapPath)) {
  problems.push("sitemap.xml is missing");
} else {
  const xml = readFileSync(sitemapPath, "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

  const sitemapPages = new Set(
    locs.map((loc) => {
      const path = loc.replace(DOMAIN, "");
      return path === "" || path === "/" ? "index.html" : path.replace(/^\//, "");
    }),
  );

  for (const loc of locs) {
    if (!loc.startsWith(DOMAIN)) {
      problems.push(`sitemap.xml: "${loc}" does not start with ${DOMAIN} — a stale domain?`);
    }
  }

  for (const page of sitemapPages) {
    const state = pageState.get(page);
    if (!state) {
      problems.push(`sitemap.xml lists "${page}", which does not exist in apps/brandora/`);
    } else if (!state.indexable) {
      problems.push(`sitemap.xml lists "${page}", but that page's own <meta name="robots"> says noindex — the two must agree`);
    }
  }

  for (const [page, state] of pageState) {
    if (state.indexable && !sitemapPages.has(page)) {
      problems.push(`"${page}" is indexable (robots: index, follow) but missing from sitemap.xml`);
    }
  }
}

/* --- robots.txt must point at the real sitemap ------------------------------ */

const robotsTxtPath = join(root, "robots.txt");
if (!existsSync(robotsTxtPath)) {
  problems.push("robots.txt is missing");
} else {
  const txt = readFileSync(robotsTxtPath, "utf8");
  if (!txt.includes(`Sitemap: ${DOMAIN}/sitemap.xml`)) {
    problems.push(`robots.txt does not reference Sitemap: ${DOMAIN}/sitemap.xml`);
  }
  for (const [page, state] of pageState) {
    const disallowed = txt.includes(`Disallow: /${page}`);
    if (!state.indexable && !disallowed && page !== "index.html") {
      problems.push(`"${page}" is noindex but robots.txt does not Disallow it — belt and suspenders is the point`);
    }
    if (state.indexable && disallowed) {
      problems.push(`"${page}" is indexable but robots.txt disallows it — the two must agree`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\nSEO check failed — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

const indexableCount = [...pageState.values()].filter((s) => s.indexable).length;
console.log(
  `SEO check passed — ${pages.length} pages, ${indexableCount} indexable and listed in the sitemap, ` +
    `the rest noindex and disallowed.`,
);
