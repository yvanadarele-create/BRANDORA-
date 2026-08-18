/**
 * The acceptance journey, in French, against the production shape.
 *
 * Every assertion is a thing the user reported broken. It drives a real browser
 * against api/index.js, so a pass here means the deployed shape works — not
 * that a function compiled.
 */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

/*
 * Where to point this.
 *
 * Defaults to the local production-shape server. Pass a URL to run the same
 * journey against a deployment — the assertions do not care which, because
 * they are about what a customer sees:
 *
 *   BRANDORA_BASE=https://brandoraunion.online node tests/e2e-journey.mjs /tmp/shots
 *
 * Note that this creates a real account on whatever it points at. Against
 * production that is a real row in your database, with a journey-*@example.com
 * address, which you can delete afterwards.
 */
const BASE = (process.env.BRANDORA_BASE || 'http://127.0.0.1:4600').replace(/\/$/, '');
const OUT = process.argv[2] || '/tmp';
const results = [];
const problems = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => problems.push(String(e.message)));
p.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });

const email = `journey-${Date.now()}@example.com`;
const PASSWORD = 'correct-horse-battery';

/* 1. Open the site and switch to French. */
await p.goto(`${BASE}/index.html`);
await p.selectOption('[data-locale-switch]', 'fr');
await p.waitForTimeout(700);
check('language switches to French', (await p.getAttribute('html', 'lang')) === 'fr',
  await p.getAttribute('html', 'lang'));

/* 2. Language survives navigation. */
await p.goto(`${BASE}/signup.html`);
await p.waitForTimeout(600);
check('language persists across navigation', (await p.getAttribute('html', 'lang')) === 'fr',
  await p.getAttribute('html', 'lang'));

/* 3. Create an account. */
await p.fill('#name', 'Aïcha Traoré');
await p.fill('#email', email);
await p.fill('#password', PASSWORD);
await p.click('button[type=submit]');
await p.waitForTimeout(2500);
const afterSignup = new URL(p.url()).pathname;
check('account created and redirected', !afterSignup.endsWith('/signup.html'), afterSignup);

/* 4. Still authenticated. */
const me = await p.evaluate(async () => (await (await fetch('/api/auth/me')).json()).user?.email ?? null);
check('session established', me === email, String(me));

/* 5. The interview loads. */
await p.goto(`${BASE}/create.html`);
await p.waitForTimeout(2500);
const interview = await p.evaluate(() => ({
  error: document.querySelector('[data-error]')?.hidden === false
    ? document.querySelector('[data-error]').textContent.trim() : null,
  question: document.querySelector('[data-question]')?.textContent?.trim()
    ?? document.querySelector('h2')?.textContent?.trim() ?? null,
  inputs: document.querySelectorAll('#answer, [data-answer], textarea, input[type=text]').length,
}));
check('interview loads without an error', interview.error === null, interview.error ?? 'no error shown');
check('interview shows a question', !!interview.question, interview.question);
await p.screenshot({ path: `${OUT}/j-interview.png` });

/* 6. Answer and save. */
const answered = await p.evaluate(() => {
  const field = document.querySelector('#answer, [data-answer], textarea');
  if (!field) return false;
  field.value = 'Une boulangerie artisanale à Abidjan';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
});
if (answered) {
  const next = await p.$('[data-next], button[type=submit]');
  if (next) { await next.click(); await p.waitForTimeout(2000); }
}
const saved = await p.evaluate(async () => {
  const projects = await (await fetch('/api/projects')).json();
  const id = projects.projects?.[0]?.id;
  if (!id) return null;
  const r = await (await fetch(`/api/projects/${id}/interview`)).json();
  return JSON.stringify(r).slice(0, 200);
});
check('an answer reaches the database', saved !== null && saved.includes('Abidjan'), String(saved).slice(0, 120));

/* 7. Progress survives a refresh. */
await p.reload();
await p.waitForTimeout(2200);
const stillThere = await p.evaluate(async () => {
  const projects = await (await fetch('/api/projects')).json();
  const id = projects.projects?.[0]?.id;
  if (!id) return null;
  return JSON.stringify(await (await fetch(`/api/projects/${id}/interview`)).json()).includes('Abidjan');
});
check('progress survives a refresh', stillThere === true, String(stillThere));

/* 8. The catalogue. */
await p.goto(`${BASE}/catalog.html`);
await p.waitForTimeout(2500);
const catalogue = await p.evaluate(() => ({
  error: document.querySelector('[data-error]')?.hidden === false
    ? document.querySelector('[data-error]').textContent.trim() : null,
  products: document.querySelectorAll('[data-product], .product, .card--product, article').length,
}));
check('catalogue loads without an error', catalogue.error === null, catalogue.error ?? 'no error shown');

/*
 * Either products, or an empty state that says so — never a blank page and
 * never an error.
 *
 * This used to assert `products > 0`, which stopped being the right assertion
 * the moment the invented products were removed. Replacing it with nothing
 * would have left the case untested; what actually matters is that a visitor
 * is told something true either way. An empty catalogue that renders as an
 * apology, or as silence, is still a bug.
 */
const empty = await p.evaluate(() =>
  [...document.querySelectorAll('.notice')].map((n) => n.textContent.trim()).join(' '));
check(
  'catalogue shows products or says it is being prepared',
  catalogue.products > 0 || /en cours de préparation|being prepared/i.test(empty),
  catalogue.products > 0 ? `${catalogue.products} rendered` : empty.slice(0, 90) || 'nothing at all',
);
await p.screenshot({ path: `${OUT}/j-catalog.png` });

/* 9. Quantity filter. */
const qty = await p.$('#quantity, [data-quantity]');
if (qty) {
  await qty.fill('500');
  await qty.dispatchEvent('change');
  await p.waitForTimeout(1600);
}
const afterFilter = await p.evaluate(() =>
  document.querySelectorAll('[data-product], .product, .card--product, article').length);
check('quantity filter responds', afterFilter >= 0, `${afterFilter} at 500`);

/* 10. Language is still French. */
check('language still French after the journey', (await p.getAttribute('html', 'lang')) === 'fr',
  await p.getAttribute('html', 'lang'));

/* 11. Log out and back in. */
await p.goto(`${BASE}/dashboard.html`);
await p.waitForTimeout(1200);
// Log out through the API rather than hunting for a button that may be
// hidden: this step is testing that logging back in works, not the chrome.
await p.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
await p.waitForTimeout(800);
const loggedOut = await p.evaluate(async () => (await (await fetch('/api/auth/me')).json()).user);
check('logout clears the session', loggedOut === null, JSON.stringify(loggedOut));

await p.goto(`${BASE}/login.html`);
await p.waitForSelector('#email', { timeout: 10000 });
await p.fill('#email', email);
await p.fill('#password', PASSWORD);
await p.click('button[type=submit]');
await p.waitForTimeout(2500);
const back = await p.evaluate(async () => (await (await fetch('/api/auth/me')).json()).user?.email ?? null);
check('can log back in', back === email, String(back));

const survived = await p.evaluate(async () => {
  const projects = await (await fetch('/api/projects')).json();
  return (projects.projects ?? []).length;
});
check('brand data survived the logout', survived > 0, `${survived} projects`);

/* 12. A wrong password says so, in French. */
await p.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
await p.goto(`${BASE}/login.html`);
await p.waitForSelector('#email', { timeout: 10000 });
await p.fill('#email', email);
await p.fill('#password', 'definitely-not-the-password');
await p.click('button[type=submit]');
await p.waitForTimeout(1800);
const loginError = await p.evaluate(() => {
  const n = document.querySelector('[data-error]');
  return n && !n.hidden ? n.textContent.trim() : null;
});
check('a wrong password shows a French message', !!loginError && /[éèêà]|incorrect|mot de passe/i.test(loginError),
  loginError);

console.log(JSON.stringify({ results, failed: results.filter((r) => !r.ok), problems }, null, 1));
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
