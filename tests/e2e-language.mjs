/**
 * Does the whole interface change language, and does the waiting list keep
 * what people type into it?
 *
 * Both of these were reported as broken and both are the kind of thing that
 * passes a code review and fails in front of a customer, so they are checked
 * in a real browser against the production shape.
 *
 * The language assertions are deliberately about *dynamic* content — product
 * cards, counts, empty states. The static markup was always fine; what stayed
 * English was everything the page scripts built, because `data-i18n` cannot
 * reach a node that did not exist when the translator ran.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

const BASE = 'http://127.0.0.1:4600';
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 120) });

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());

/* --- The catalogue, switched after it has already rendered ---------------- */

await page.goto(`${BASE}/catalog.html`);
await page.waitForTimeout(2200);

const englishCards = await page.evaluate(() =>
  [...document.querySelectorAll('article.card')].map((c) => c.textContent).join(' '));
check('catalogue renders in English first', /per unit|Add to my package/.test(englishCards), englishCards.slice(0, 60));

// Switch *after* the cards exist. This is the case that used to fail: the
// shell translated and the cards, already in the DOM, stayed English.
await page.selectOption('[data-locale-switch]', 'fr');
await page.waitForTimeout(1800);

const frenchCards = await page.evaluate(() =>
  [...document.querySelectorAll('article.card')].map((c) => c.textContent).join(' '));

check('product cards switch to French', /l'unité|Ajouter à mon lot/.test(frenchCards), frenchCards.slice(0, 80));
check('no English left in the cards', !/per unit|Add to my package|Minimum order/.test(frenchCards),
  (frenchCards.match(/per unit|Add to my package|Minimum order/) ?? ['none'])[0]);

const count = await page.evaluate(() => document.querySelector('[data-count]')?.textContent ?? '');
check('the product count is French', /peuvent être commandés|produits sur/.test(count), count);

/* --- The waiting list ------------------------------------------------------ */

const email = `wl-${Date.now()}@example.com`;
await page.goto(`${BASE}/index.html`);
await page.waitForTimeout(1200);

check('the waiting list asks for more than an address',
  await page.locator('#subscribe-business').count() === 1, 'business field present');

await page.fill('#subscribe-email', email);
await page.fill('#subscribe-name', 'Aïcha Traoré');
await page.fill('#subscribe-business', 'Boulangerie Cocody');
await page.fill('#subscribe-interest', 'Boîtes imprimées');
await page.fill('#subscribe-quantity', '30');
await page.click('[data-subscribe-submit]');
await page.waitForTimeout(1800);

const status = await page.evaluate(() => {
  const n = document.querySelector('[data-subscribe-status]');
  return n && !n.hidden ? n.textContent.trim() : null;
});
check('the form confirms', !!status && /list|liste/i.test(status), status);

/* --- The interview, and the message when it cannot load ------------------- */

await page.goto(`${BASE}/create.html`);
await page.waitForTimeout(2000);
const interviewText = await page.evaluate(() => document.body.textContent);
check('the interview no longer tells anyone to refresh',
  !/refresh the page|actualiser la page/i.test(interviewText),
  (interviewText.match(/refresh the page|actualiser la page/i) ?? ['none'])[0]);

console.log(JSON.stringify({ email, results, failed: results.filter((r) => !r.ok) }, null, 1));
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
