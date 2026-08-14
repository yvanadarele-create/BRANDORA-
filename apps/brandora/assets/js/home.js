/**
 * The homepage.
 *
 * Three jobs, and one rule that governs all of them: **the page must never look
 * more capable than the product actually is.**
 *
 * The catalogue strip is built from `data/catalog.json`, which the build emits
 * from the same catalogue the quote engine prices against. It therefore cannot
 * name a category nobody stocks, and it cannot drift when a product is added or
 * removed. If the file fails to load, the section says so rather than showing
 * an invented list or an empty hole.
 *
 * The subscribe form posts to a real endpoint that writes a real row. It gets
 * the same answer whether the address was new or already recorded, because a
 * form that replies "you are already subscribed" lets anyone check whether a
 * given address is on the list.
 *
 * Nothing here fabricates a number, a supplier or a customer.
 */

import { ApiError, api, clear, el } from './api.js';

/* --- What can be sourced ---------------------------------------------------- */

/**
 * How a category is introduced.
 *
 * Written here rather than in the catalogue because these are editorial lines
 * about a category, not facts about a product — and a product file is the wrong
 * place for a sentence that needs rewriting when the positioning changes. A
 * category with no line still renders; it simply shows its contents.
 */
const CATEGORY_COPY = {
  packaging: 'Cups, bottles, boxes, bags, pouches and containers.',
  'brand-materials': 'Stickers, labels, cards, flyers and menus.',
  tableware: 'Plates, bowls and cutlery.',
  merchandise: 'T-shirts, tote bags, aprons and mugs.',
};

const CATEGORY_NAME = {
  packaging: 'Packaging',
  'brand-materials': 'Brand materials',
  tableware: 'Tableware',
  merchandise: 'Merchandise',
};

/** Title-case a subcategory slug: "business-cards" → "Business cards". */
const humanise = (slug) => {
  const words = String(slug).replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function categoryCard(category, subcategories, productCount, lowestMinimum) {
  return el('article', { class: 'catalogue-card' }, [
    el('h3', { class: 'catalogue-card__name', text: CATEGORY_NAME[category] ?? humanise(category) }),
    CATEGORY_COPY[category] ? el('p', { class: 'catalogue-card__copy', text: CATEGORY_COPY[category] }) : null,
    el(
      'ul',
      { class: 'catalogue-card__list' },
      subcategories.map((sub) => el('li', { text: humanise(sub) })),
    ),
    // Counted from the data, not typed in. "12 products" that is really 11 is
    // the kind of small wrongness that costs a reader their trust in the rest.
    el('p', { class: 'catalogue-card__meta' }, [
      el('span', { text: `${productCount} ${productCount === 1 ? 'product' : 'products'}` }),
      lowestMinimum !== null
        ? el('span', { text: ` · from ${lowestMinimum} ${lowestMinimum === 1 ? 'unit' : 'units'}` })
        : null,
    ]),
  ]);
}

async function mountCatalogue() {
  const grid = document.querySelector('[data-catalogue-grid]');
  if (!grid) return;

  let products;
  try {
    const response = await fetch('data/catalog.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    products = Array.isArray(payload) ? payload : payload.products;
    if (!Array.isArray(products) || products.length === 0) throw new Error('empty');
  } catch {
    // Said plainly. The alternative — a hard-coded list standing in for the
    // catalogue — is a list that keeps claiming a product after it is gone.
    clear(grid);
    grid.appendChild(
      el('p', { class: 'notice notice--quiet' }, [
        el('span', {
          text: 'The catalogue could not be loaded just now. ',
        }),
        el('a', { href: 'catalog.html', text: 'Browse it directly' }),
        el('span', { text: '.' }),
      ]),
    );
    return;
  }

  const byCategory = new Map();
  for (const product of products) {
    const entry = byCategory.get(product.category) ?? { subs: new Set(), count: 0, minimum: null };
    entry.subs.add(product.subcategory);
    entry.count += 1;
    const min = Number(product.minimumQuantity);
    if (Number.isFinite(min) && min > 0) entry.minimum = entry.minimum === null ? min : Math.min(entry.minimum, min);
    byCategory.set(product.category, entry);
  }

  clear(grid);
  // Largest category first: it is the one most likely to answer what the
  // visitor came to find out.
  const ordered = [...byCategory.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [category, entry] of ordered) {
    grid.appendChild(categoryCard(category, [...entry.subs], entry.count, entry.minimum));
  }
}

/* --- Staying in touch -------------------------------------------------------- */

function mountSubscribe() {
  const form = document.querySelector('[data-subscribe-form]');
  if (!form) return;

  const input = form.querySelector('#subscribe-email');
  const submit = form.querySelector('[data-subscribe-submit]');
  const status = form.querySelector('[data-subscribe-status]');

  const say = (message, kind) => {
    status.hidden = false;
    status.textContent = message;
    status.className = `join__status join__status--${kind}`;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = (input.value ?? '').trim();

    // Checked here so an obvious typo gets an instant answer instead of a
    // round trip. The server checks again; this is courtesy, not security.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      say('That does not look like an email address.', 'error');
      input.focus();
      return;
    }

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Sending…';

    try {
      await api.post('/api/subscribe', {
        email,
        locale: document.documentElement.getAttribute('lang') || 'en',
        source: 'homepage',
      });
      form.reset();
      // Deliberately vague about whether this was new. See the route.
      say("You're on the list. We'll be in touch as this grows.", 'ok');
    } catch (err) {
      say(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts from here. Try again a little later.'
          : 'That did not go through. Try again, or email brandora.union@gmail.com.',
        'error',
      );
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  });
}

/* --- The year in the footer -------------------------------------------------- */

function mountYear() {
  const now = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = now;
  });
}

mountYear();
mountSubscribe();
void mountCatalogue();
