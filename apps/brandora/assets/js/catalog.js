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

/** A logo upload has to fit inside the server's 256KB request-body cap
 *  alongside the rest of the form — see MAX_BODY_BYTES in http.ts. */
const MAX_LOGO_BYTES = 150_000;

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

  const actions = quoteOnly
    ? [
        el('a', {
          class: 'btn btn--primary btn--small',
          href: 'index.html#ask-brandora',
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
  return el('article', { class: 'card' }, [
    product.images?.[0]
      ? el('div', { class: 'product__photo-wrap' }, [
          el('img', {
            class: 'product__photo',
            src: product.images[0],
            alt: name,
            loading: 'lazy',
            decoding: 'async',
          }),
          // Every product photo doubles as a manufacturer-quote entry point
          // (MOQ, colour, material, logo, note → one email), independent of
          // the pricing-side "Request a quote" action above.
          el('button', {
            class: 'product__photo-quote',
            type: 'button',
            'data-quote-request': product.id,
            'aria-label': t('ui.quote-request.photo-label', 'Request a quote for {product}', { product: name }),
            text: t('ui.catalog.request-quote', 'Request a quote'),
          }),
        ])
      : null,
    el('h3', { text: name }),
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

/* --- Requesting a manufacturer quote ------------------------------------------ */

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('could not read the file'));
    reader.readAsDataURL(file);
  });
}

/**
 * The form a clicked product photo opens: MOQ, colour, material, an optional
 * logo, and a free-text note, emailed to Brandora's own inbox (see
 * QUOTE_REQUEST_INBOX in routes.ts — no manufacturer portal exists yet).
 *
 * Reuses the `.scheduler` dialog shell already built for the Calendly embed
 * (openScheduler() in api.js) — same overlay, close button, Escape key and
 * scroll lock — rather than a second dialog implementation.
 */
function openQuoteRequestModal(product) {
  if (!state.user) {
    window.location.href = `login.html?next=${encodeURIComponent('/catalog')}`;
    return;
  }

  const name = localizedField(product, 'name');
  const body = el('div', { class: 'quote-request' });

  const error = el('p', { class: 'notice', role: 'alert', hidden: true });
  const moqInput = el('input', {
    type: 'number',
    min: '1',
    step: '1',
    value: String(product.minimumQuantity || 1),
    required: true,
  });
  const colorInput = el('input', { type: 'text', maxlength: '200' });
  const materialInput = el('input', { type: 'text', maxlength: '200' });
  const logoInput = el('input', { type: 'file', accept: 'image/*,.pdf' });
  const noteInput = el('textarea', { maxlength: '2000' });
  const submitButton = el('button', {
    class: 'btn btn--primary',
    type: 'submit',
    text: t('ui.quote-request.submit', 'Send request'),
  });

  const form = el('form', { class: 'quote-request-form' }, [
    el('div', { class: 'field' }, [
      el('label', { text: t('ui.quote-request.moq-label', 'Minimum order quantity') }),
      moqInput,
    ]),
    el('div', { class: 'field' }, [
      el('label', { text: t('ui.quote-request.color-label', 'Colour (optional)') }),
      colorInput,
    ]),
    el('div', { class: 'field' }, [
      el('label', { text: t('ui.quote-request.material-label', 'Material / texture (optional)') }),
      materialInput,
    ]),
    el('div', { class: 'field' }, [
      el('label', { text: t('ui.quote-request.logo-label', 'Upload your logo (optional)') }),
      logoInput,
    ]),
    el('div', { class: 'field' }, [
      el('label', { text: t('ui.quote-request.note-label', 'Anything else we should know? (optional)') }),
      noteInput,
    ]),
    error,
    submitButton,
  ]);

  body.appendChild(el('h3', { text: name }));
  body.appendChild(
    el('p', {
      class: 'product__meta',
      text: t('ui.quote-request.lede', "Tell us what you need. We'll follow up by email."),
    }),
  );
  body.appendChild(form);

  const dialog = el(
    'div',
    {
      class: 'scheduler',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': t('ui.quote-request.title', 'Request a quote — {product}', { product: name }),
    },
    [
      el('div', { class: 'scheduler__panel scheduler__panel--form' }, [
        el('button', {
          class: 'btn btn--ghost btn--small scheduler__close',
          type: 'button',
          'aria-label': t('ui.quote-request.close', 'Close'),
          text: t('ui.quote-request.close', 'Close'),
        }),
        body,
      ]),
    ],
  );

  const previouslyFocused = document.activeElement;
  const close = () => {
    dialog.remove();
    document.body.style.removeProperty('overflow');
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  dialog.querySelector('.scheduler__close').addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(dialog);
  document.body.style.overflow = 'hidden';
  moqInput.focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;

    const moq = Number(moqInput.value);
    if (!Number.isInteger(moq) || moq <= 0) {
      error.textContent = t('ui.quote-request.moq-invalid', 'Enter a whole number greater than zero.');
      error.hidden = false;
      return;
    }

    const file = logoInput.files[0];
    if (file && file.size > MAX_LOGO_BYTES) {
      error.textContent = t(
        'ui.quote-request.logo-too-large',
        'That logo file is too large — please use one under 150KB.',
      );
      error.hidden = false;
      return;
    }

    submitButton.disabled = true;
    const originalLabel = submitButton.textContent;
    submitButton.textContent = t('ui.quote-request.sending', 'Sending…');

    try {
      let logoFilename;
      let logoData;
      if (file) {
        const dataUrl = await readFileAsDataUrl(file);
        logoFilename = file.name;
        logoData = dataUrl.split(',')[1] || '';
      }

      await api.requestQuote(product.id, {
        moq,
        ...(colorInput.value.trim() ? { color: colorInput.value.trim() } : {}),
        ...(materialInput.value.trim() ? { material: materialInput.value.trim() } : {}),
        ...(noteInput.value.trim() ? { note: noteInput.value.trim() } : {}),
        ...(logoFilename ? { logoFilename, logoData } : {}),
      });

      clear(body);
      body.appendChild(el('h3', { text: t('ui.quote-request.sent-title', 'Request sent') }));
      body.appendChild(
        el('p', { text: t('ui.quote-request.sent-body', "We'll follow up within 48 hours.") }),
      );
    } catch (err) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
      error.textContent =
        err instanceof ApiError ? err.readable : t('error.unknown', 'Something went wrong. Please try again.');
      error.hidden = false;
    }
  });
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest ? event.target.closest('[data-quote-request]') : null;
  if (!trigger) return;
  const product = state.productsById.get(trigger.getAttribute('data-quote-request'));
  if (product) openQuoteRequestModal(product);
});

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
