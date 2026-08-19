/**
 * The catalogue (§34, §35, §36).
 *
 * Three rules the server enforces and this page has to *show*:
 *
 *   §35 — a product that cannot be ordered at the stated quantity is demoted,
 *   not deleted. "This exists, from fifty" is useful; a product silently
 *   vanishing teaches nothing.
 *
 *   §36 — "carries your logo" is a claim, and it is only made where the
 *   catalogue has confirmed it. Everything else says so in as many words.
 *
 *   §38 — no delivery date is shown, because none has been quoted by a carrier.
 *
 * Adding to a package writes to the server, against the project. The browser
 * holds nothing but the id of the project being worked on.
 */

import {
  ApiError,
  api,
  clear,
  confidenceLabel,
  currentProjectId,
  el,
  hideError,
  localizedField,
  mountAccountNav,
  onLocaleChange,
  priceLabel,
  projectUrl,
  showError,
  t,
} from './api.js';

const node = {
  quantity: document.querySelector('[data-quantity]'),
  category: document.querySelector('[data-category]'),
  search: document.querySelector('[data-search]'),
  customizable: document.querySelector('[data-customizable]'),
  products: document.querySelector('[data-products]'),
  nearMisses: document.querySelector('[data-near-misses]'),
  nearWrap: document.querySelector('[data-near-wrap]'),
  count: document.querySelector('[data-count]'),
  banner: document.querySelector('[data-brand-banner]'),
  error: document.querySelector('[data-error]'),
};

const state = {
  projectId: currentProjectId(),
  user: null,
  brandName: null,
  recommended: new Map(),
  productsById: new Map(),
};

/* --- Rendering -------------------------------------------------------------- */

function customizationTag(product) {
  const info = product.customization;
  return el('span', {
    class: `tag ${info.canCarryLogo ? 'tag--ok' : 'tag--unconfirmed'}`,
    text: confidenceLabel(info),
  });
}

function productCard(product, orderable, quantity) {
  const reason = state.recommended.get(product.id);
  const quoteOnly = product.quoteOnRequest === true;
  const detailUrl = `product.html?id=${encodeURIComponent(product.id)}`;

  const actions = quoteOnly
    ? [
        el('a', {
          class: 'btn btn--primary btn--small',
          href: detailUrl,
          text: t('ui.catalog.request-quote', 'Request a quote'),
        }),
      ]
    : orderable
      ? [
          el('button', {
            class: 'btn btn--primary btn--small',
            type: 'button',
            'data-add': product.id,
            text: t('ui.catalog.add-to-package', 'Add to my package'),
          }),
        ]
      : [
          el('p', {
            class: 'product__meta',
            text: t('ui.catalog.raise-quantity', 'Minimum order {min}. Raise your quantity to add it.', {
              min: product.minimumQuantity,
            }),
          }),
        ];

  const name = localizedField(product, 'name');
  const photoLabel = t('ui.catalog.see-details', 'See details for {product}', { product: name });
  return el('article', { class: 'card' }, [
    product.images?.[0]
      ? el('a', {
          class: 'product__photo-wrap',
          href: detailUrl,
          'aria-label': photoLabel,
        }, [
          el('img', {
            class: 'product__photo',
            src: product.images[0],
            alt: name,
            loading: 'lazy',
            decoding: 'async',
          }),
          // Every product is clickable, not only its "Add"/"Request a
          // quote" button — see MVP simplification brief §4.
          el('span', {
            class: 'product__photo-quote',
            text: t('ui.catalog.see-details-short', 'See details'),
          }),
        ])
      : null,
    el('h3', {}, [el('a', { href: detailUrl, text: name })]),
    el('p', { class: 'product__meta', text: `${product.category} · ${product.subcategory}` }),
    el('p', { text: localizedField(product, 'description') }),
    product.supplierReference
      ? el('p', {
          class: 'product__meta',
          text: t('ui.catalog.sourced-from', 'Sourced from {supplier}', { supplier: product.supplierReference.name }),
        })
      : null,
    reason
      ? el('p', {
          class: 'product__reason',
          text: t('ui.catalog.recommended', 'Recommended: {reason}', { reason }),
        })
      : null,
    el('p', {
      class: 'product__price',
      text: quoteOnly ? priceLabel(product) : t('ui.catalog.per-unit', '{price} per unit', { price: priceLabel(product) }),
    }),
    el('p', { class: 'product__meta' }, [
      customizationTag(product),
      el('span', { text: ` ${t('ui.catalog.minimum', 'Minimum {min}', { min: product.minimumQuantity })}` }),
    ]),
    // §38 in the interface, not only in the data.
    el('p', {
      class: 'product__meta',
      text: t('ui.catalog.delivery-later', 'Delivery estimate available once your order is confirmed.'),
    }),
    ...actions,
  ]);
}

function render(payload, quantity) {
  clear(node.products);
  clear(node.nearMisses);
  state.productsById.clear();

  payload.products.forEach((product) => {
    state.productsById.set(product.id, product);
    node.products.appendChild(productCard(product, true, quantity));
  });

  const near = payload.nearMisses || [];
  near.forEach((product) => {
    state.productsById.set(product.id, product);
    node.nearMisses.appendChild(productCard(product, false, quantity));
  });

  node.nearWrap.hidden = near.length === 0;

  node.count.textContent = t(
    'ui.catalog.count',
    '{shown} of {total} products can be ordered at {quantity} units.',
    { shown: payload.products.length, total: payload.total, quantity },
  );

  if (payload.products.length === 0 && near.length === 0) {
    // Two different situations, and telling them apart matters. `total` counts
    // the catalogue before this page's filters; when it is zero there is
    // nothing to find and no filter the visitor could change would help, so
    // suggesting they try another category sends them hunting for something
    // that does not exist. A catalogue still being assembled is not a failure
    // and must not read like one — nor like an error, which is a third state
    // handled by showError().
    const nothingAtAll = payload.total === 0;
    node.count.hidden = nothingAtAll;
    node.products.appendChild(
      el('p', {
        class: 'notice',
        text: nothingAtAll
          ? t(
              'ui.catalog.preparing',
              'Our catalogue is being prepared. We are putting together our first references.',
            )
          : t('ui.catalog.no-match', 'Nothing matches that yet. Try a different category or quantity.'),
      }),
    );
  } else {
    node.count.hidden = false;
  }
}

/* --- Loading ----------------------------------------------------------------- */

function currentQuantity() {
  const parsed = Number(node.quantity.value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 30;
}

async function load() {
  const quantity = currentQuantity();
  const params = new URLSearchParams();
  params.set('quantity', String(quantity));
  if (node.category.value) params.set('category', node.category.value);
  if (node.search.value.trim()) params.set('q', node.search.value.trim());
  if (node.customizable.checked) params.set('customizable', 'true');

  try {
    render(await api.catalog(params.toString()), quantity);
  } catch (err) {
    showError(node.error, err);
  }
}

/**
 * Rank the catalogue for the brand on screen.
 *
 * The ranking never filters: it annotates. A founder browsing the catalogue is
 * allowed to buy whatever they like, and "Recommended for your brand" is a
 * suggestion with a reason attached, not a gate.
 */
async function loadRecommendations() {
  if (!state.projectId || !state.user) return;
  try {
    const [project, recommendations] = await Promise.all([
      api.project(state.projectId),
      api.recommendations(state.projectId, currentQuantity()),
    ]);

    state.brandName = project.strategy ? project.strategy.name : null;
    recommendations.recommendations.forEach((entry) => {
      state.recommended.set(entry.product.id, entry.reasons[0] || '');
    });

    if (state.brandName) {
      node.banner.textContent = t(
        'ui.catalog.browsing-for',
        'Browsing for {brand}. Products we recommend for it are marked.',
        { brand: state.brandName },
      );
      node.banner.hidden = false;
    }
  } catch (err) {
    // No brand yet, or not this customer's project. The catalogue is still a
    // catalogue; it just does not recommend anything.
  }
}

/* --- Adding ------------------------------------------------------------------ */

async function add(productId, button) {
  hideError(node.error);

  if (!state.user) {
    window.location.href = `login.html?next=${encodeURIComponent('/catalog')}`;
    return;
  }

  if (!state.projectId) {
    // A package belongs to a brand. Rather than inventing an anonymous basket,
    // send them to the one screen that produces a project.
    showError(node.error, new ApiError(400, 'no-project', 'Create your brand first, then add products to it.'));
    return;
  }

  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Adding…';

  try {
    const result = await api.addItem(state.projectId, {
      productId,
      quantity: currentQuantity(),
    });

    const adjusted = (result.adjustments || []).find((entry) => entry.productId === productId);
    button.textContent = adjusted
      ? `Added ${adjusted.charged} (its minimum)`
      : `Added ${currentQuantity()}`;

    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 2500);
  } catch (err) {
    button.textContent = original;
    button.disabled = false;
    showError(node.error, err);
  }
}

/* --- Wiring ------------------------------------------------------------------ */

let debounce = null;
const reload = () => {
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => void load(), 180);
};

[node.quantity, node.category, node.customizable].forEach((control) =>
  control.addEventListener('change', reload),
);
node.search.addEventListener('input', reload);

document.addEventListener('click', (event) => {
  const button = event.target.closest ? event.target.closest('[data-add]') : null;
  if (button) void add(button.getAttribute('data-add'), button);
});

async function boot() {
  state.user = await mountAccountNav();

  document.querySelectorAll('[data-package-link], .site-nav a[href="package.html"]').forEach((link) => {
    link.setAttribute('href', projectUrl('package.html', state.projectId));
  });

  await loadRecommendations();
  await load();

  // Product cards are built here, not in the markup, so `applyLocale` cannot
  // reach them. Rebuilding is cheaper and more honest than trying to patch
  // individual nodes, and it also re-reads the current filters.
  onLocaleChange(() => void load());
}

void boot();
