/**
 * Is the site actually in French when French is chosen?
 *
 * The complaint that produced this file was specific: "when I click French, I
 * see a lot of English words." The previous language test checked the
 * catalogue's product cards and passed, which is why the report said
 * translation worked while a French visitor was still reading an English
 * founder story, English section headings and an English skip link.
 *
 * So this walks the pages a real visitor walks, and reads the *rendered text*
 * of each one back, looking for English. It does not check that keys exist —
 * a key that exists and is never applied looks identical to a missing one from
 * the sofa.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

const BASE = (process.env.BRANDORA_BASE || 'http://127.0.0.1:4600').replace(/\/$/, '');
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 160) });

/**
 * Words that mean the text is English, chosen to not fire on French.
 *
 * "Brandora", "Union", "packaging" and product names are excluded — those are
 * the same word in both languages, or a proper noun. What is listed here has
 * no innocent reading on a French page.
 */
const ENGLISH = /\b(Skip to content|Your (brand|order|quote|products|question)|No brands yet|Loading|What products|What packaging|What should I|Build a launch|Choose your products|Download brand|The brand\b|The mark\b|In the world|How many do you need|Available, but not|Tell us how many|I built Brandora Union because|Africa has the ideas|I wanted to change that|packaging is not just packaging)\b/;

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

/* Sign in, so the pages behind auth render their real content. */
const email = `fr-${Date.now()}@example.com`;
await page.goto(`${BASE}/signup.html`);
await page.selectOption('[data-locale-switch]', 'fr');
await page.waitForTimeout(800);
await page.fill('#name', 'Aïcha Traoré');
await page.fill('#email', email);
await page.fill('#password', 'correct-horse-battery');
await page.click('button[type=submit]');
await page.waitForTimeout(2500);

const PAGES = ['index.html', 'catalog.html', 'create.html', 'assistant.html', 'dashboard.html', 'brand.html'];

for (const path of PAGES) {
  await page.goto(`${BASE}/${path}`);
  await page.waitForTimeout(1800);

  const lang = await page.getAttribute('html', 'lang');
  const text = await page.evaluate(() => {
    // Only what a person can actually see.
    const walk = (node, out) => {
      for (const child of node.children) {
        const style = getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (child.classList.contains('visually-hidden')) continue;
        if (/^(SCRIPT|STYLE|NOSCRIPT|SVG)$/.test(child.tagName)) continue;
        if (child.children.length === 0) out.push(child.textContent.trim());
        else walk(child, out);
      }
      return out;
    };
    return walk(document.body, []).filter(Boolean).join(' | ');
  });

  const hit = text.match(ENGLISH);
  check(`${path}: html lang="fr"`, lang === 'fr', lang);
  check(`${path}: no English on screen`, !hit, hit ? `found "${hit[0]}"` : 'clean');
}

/* The founder story specifically — it was named in the complaint. */
await page.goto(`${BASE}/index.html`);
await page.waitForTimeout(1600);
const founder = await page.evaluate(() => {
  const block = document.querySelector('.founder__story');
  return block ? block.textContent.replace(/\s+/g, ' ').trim() : null;
});
check('the founder story is in French', !!founder && /J'ai créé Brandora Union|L'Afrique a les idées/.test(founder),
  founder ? founder.slice(0, 110) : 'not found');

/* And switching back to English must work in both directions. */
await page.selectOption('[data-locale-switch]', 'en');
await page.waitForTimeout(1200);
const backToEnglish = await page.evaluate(() => {
  const block = document.querySelector('.founder__story');
  return block ? block.textContent.trim().slice(0, 60) : null;
});
check('switching back to English works', /I built Brandora Union/.test(backToEnglish ?? ''), backToEnglish);

console.log(JSON.stringify({ results, failed: results.filter((r) => !r.ok) }, null, 1));
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
