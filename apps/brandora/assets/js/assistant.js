/**
 * Ask Brandora.
 *
 * One rule governs this file: **the model writes the sentences, the catalogue
 * writes the numbers.** The reply comes back as prose plus a list of products
 * the server resolved from its own data, and the product cards below each
 * answer are rendered from that list. If the model's prose ever disagrees with
 * a price, the card is still right.
 *
 * So there is no code here that reads a figure out of the answer text, and
 * there never should be.
 */

import {
  api,
  ApiError,
  clear,
  confidenceLabel,
  currentProjectId,
  el,
  hideError,
  localizedField,
  mountAccountNav,
  priceLabel,
  projectUrl,
  requireSignIn,
  showError,
  t,
} from './api.js';

const node = {
  title: document.querySelector('[data-assistant-title]'),
  lede: document.querySelector('[data-assistant-lede]'),
  thread: document.querySelector('[data-thread]'),
  form: document.querySelector('[data-ask-form]'),
  input: document.querySelector('#question'),
  submit: document.querySelector('[data-submit]'),
  error: document.querySelector('[data-error]'),
  suggestions: document.querySelector('[data-suggestions]'),
};

const state = { projectId: currentProjectId(), brandName: null, asking: false };

/* --- The thread ------------------------------------------------------------- */

function addQuestion(text) {
  node.thread.appendChild(
    el('div', { class: 'turn turn--you' }, [
      el('p', { class: 'turn__who', text: 'You' }),
      el('p', { class: 'turn__body', text }),
    ]),
  );
}

function addThinking() {
  const turn = el('div', { class: 'turn turn--brandora' }, [
    el('p', { class: 'turn__who', text: 'Brandora' }),
    el('p', { class: 'turn__body turn__body--waiting', text: t('ui.assistant.searching', 'Looking through the catalogue…') }),
  ]);
  node.thread.appendChild(turn);
  turn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return turn;
}

/**
 * A product card, built entirely from the catalogue row the server returned.
 *
 * Nothing here is parsed out of the answer text — that is the whole point.
 */
function productCard(product) {
  const quoteOnly = product.quoteOnRequest === true;
  return el('article', { class: 'card card--flat suggested' }, [
    el('h3', { style: 'font-size:1rem;margin-bottom:0.25rem', text: localizedField(product, 'name') }),
    el('p', {
      class: 'product__price',
      text: quoteOnly ? priceLabel(product) : t('ui.catalog.per-unit', '{price} per unit', { price: priceLabel(product) }),
    }),
    el('p', { class: 'product__meta', text: t('ui.assistant.product-meta', 'Minimum {min} · {category}', {
      min: product.minimumQuantity,
      category: product.category,
    }) }),
    el('span', {
      class: `tag ${product.customization.canCarryLogo ? 'tag--ok' : 'tag--unconfirmed'}`,
      text: confidenceLabel(product.customization),
    }),
    el('a', {
      class: 'btn btn--ghost btn--small',
      href: projectUrl('catalog.html', state.projectId),
      text: t('ui.catalog.see-in-catalogue', 'See in the catalogue'),
    }),
  ]);
}

function fillAnswer(turn, payload) {
  const body = turn.querySelector('.turn__body');
  body.classList.remove('turn__body--waiting');
  body.textContent = payload.answer;

  if (payload.quantity) {
    turn.appendChild(
      el('p', { class: 'turn__meta', text: `Checked against ${payload.quantity} units.` }),
    );
  }

  if (payload.products.length > 0) {
    turn.appendChild(
      el(
        'div',
        { class: 'grid grid--2 suggested-grid' },
        payload.products.map(productCard),
      ),
    );
  }

  turn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* --- Asking ----------------------------------------------------------------- */

async function askQuestion(question) {
  if (state.asking || !question.trim()) return;

  if (!state.projectId) {
    showError(
      node.error,
      new ApiError(400, 'no-brand', 'Build your brand first — the assistant answers from it.'),
    );
    return;
  }

  hideError(node.error);
  state.asking = true;
  node.submit.disabled = true;
  node.submit.setAttribute('aria-busy', 'true');

  addQuestion(question);
  node.input.value = '';
  const turn = addThinking();

  try {
    const payload = await api.post(`/api/projects/${state.projectId}/assistant`, { question });
    fillAnswer(turn, payload);
  } catch (err) {
    turn.remove();
    if (err instanceof ApiError && err.isUnauthenticated) return requireSignIn();
    showError(node.error, err);
  } finally {
    state.asking = false;
    node.submit.disabled = false;
    node.submit.removeAttribute('aria-busy');
    node.input.focus();
  }
}

node.form.addEventListener('submit', (event) => {
  event.preventDefault();
  void askQuestion(node.input.value);
});

// Enter sends, shift+enter makes a new line — the convention everyone expects.
node.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void askQuestion(node.input.value);
  }
});

node.suggestions.addEventListener('click', (event) => {
  const button = event.target.closest ? event.target.closest('[data-ask]') : null;
  if (button) void askQuestion(button.getAttribute('data-ask'));
});

/* --- Start ------------------------------------------------------------------ */

async function boot() {
  const user = await mountAccountNav();
  if (!user) return requireSignIn();

  if (!state.projectId) {
    // Fall back to their most recent brand rather than telling someone with one
    // brand that they need to pick one.
    try {
      const { projects } = await api.projects();
      const withBrand = projects.find((project) => project.brandName);
      if (withBrand) state.projectId = withBrand.id;
    } catch (err) {
      /* handled when they ask */
    }
  }

  if (!state.projectId) {
    clear(node.thread);
    node.thread.appendChild(
      el('div', { class: 'notice' }, [
        el('span', {
          text: t('ui.assistant.needs-brand', 'Build a brand first — the assistant answers from it. '),
        }),
        el('a', { href: 'create.html', text: 'Create my brand' }),
      ]),
    );
    return;
  }

  try {
    const project = await api.project(state.projectId);
    if (project.strategy) {
      state.brandName = project.strategy.name;
      node.title.textContent = `Ask Brandora about ${state.brandName}`;
      node.lede.textContent = t(
        'ui.assistant.placeholder-hint',
        'Products, packaging, quantities, what to launch first — answered from {brand}.',
        { brand: state.brandName },
      );
    }
  } catch (err) {
    /* The assistant still works; it just does not greet them by name. */
  }
}

void boot();
