/**
 * The small Ask Brandora launcher.
 *
 * assistant.html is the full page — the "entire rubric" the founder asked to
 * keep. This is the small icon next to it: a fixed launcher, present on every
 * page, that opens a compact version of the same conversation without
 * leaving whatever page the visitor is on.
 *
 * It is not a second assistant. It calls the exact endpoint assistant.js
 * calls (`POST /api/projects/:id/assistant`) and renders exactly what that
 * endpoint returns — no separate grounding, no separate prompt, nothing that
 * could answer differently from the full page.
 *
 * Shown only to a signed-in visitor with the launcher deciding lazily, on
 * first open, whether they have a brand to ask about — an anonymous visitor
 * has nothing for the assistant to answer from, and a launcher that opens
 * onto "please sign in" on every marketing page would be worse than no
 * launcher at all; the page's own "Log in" control already does that job.
 */

import { api, ApiError, currentProjectId, el, localizedField, requireSignIn, t } from './api.js';

// The full page already offers this; a launcher on top of it would open a
// second, smaller copy of the page it is sitting on.
const HIDE_ON_PAGES = new Set(['assistant.html']);

const state = {
  projectId: currentProjectId(),
  brandName: null,
  resolved: false,
  asking: false,
  open: false,
};

let node = null;

function icon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="8.5" cy="9.5" r="1" fill="currentColor"/><circle cx="12" cy="9.5" r="1" fill="currentColor"/><circle cx="15.5" cy="9.5" r="1" fill="currentColor"/>';
  return svg;
}

function turn(who, text, pending) {
  return el('div', { class: `ask-widget__turn ask-widget__turn--${who}` }, [
    el('p', { class: `ask-widget__bubble${pending ? ' ask-widget__bubble--pending' : ''}`, text }),
  ]);
}

function productLine(product) {
  const priceText = product.quoteOnRequest
    ? t('ui.catalog.quote-on-request', 'Price on request')
    : (product.unitPrice?.display ?? '—');
  return el('li', { class: 'ask-widget__product' }, [
    el('span', { class: 'ask-widget__product-name', text: localizedField(product, 'name') }),
    el('span', { class: 'ask-widget__product-price', text: priceText }),
  ]);
}

function renderAnswer(turnNode, payload) {
  const bubble = turnNode.querySelector('.ask-widget__bubble');
  bubble.classList.remove('ask-widget__bubble--pending');
  bubble.textContent = payload.answer;

  if (payload.products?.length > 0) {
    turnNode.appendChild(
      el(
        'ul',
        { class: 'ask-widget__products' },
        payload.products.slice(0, 3).map(productLine),
      ),
    );
  }
  node.thread.scrollTop = node.thread.scrollHeight;
}

async function resolveProject() {
  if (state.resolved) return;
  state.resolved = true;

  if (!state.projectId) {
    try {
      const { projects } = await api.projects();
      const withBrand = projects.find((project) => project.brandName);
      if (withBrand) state.projectId = withBrand.id;
    } catch {
      /* shown as the no-brand state below */
    }
  }

  if (!state.projectId) {
    node.thread.appendChild(
      el('div', { class: 'ask-widget__empty' }, [
        el('p', { text: t('ui.assistant.needs-brand', 'Build a brand first — the assistant answers from it. ') }),
        el('a', { class: 'btn btn--small btn--primary', href: 'create.html', text: t('nav.create', 'Create my brand') }),
      ]),
    );
    node.form.hidden = true;
    return;
  }

  try {
    const project = await api.project(state.projectId);
    if (project.strategy) state.brandName = project.strategy.name;
  } catch {
    /* the widget still works without the name */
  }

  if (state.brandName) {
    node.title.textContent = `${t('ui.assistant-widget.title', 'Ask Brandora')} — ${state.brandName}`;
  }
}

async function askQuestion(question) {
  if (state.asking || !question.trim() || !state.projectId) return;

  state.asking = true;
  node.submit.disabled = true;

  node.thread.appendChild(turn('you', question));
  node.input.value = '';
  const pending = turn('brandora', t('ui.assistant.searching', 'Looking through the catalogue…'), true);
  node.thread.appendChild(pending);
  node.thread.scrollTop = node.thread.scrollHeight;

  try {
    const payload = await api.post(`/api/projects/${state.projectId}/assistant`, { question });
    renderAnswer(pending, payload);
  } catch (err) {
    pending.remove();
    if (err instanceof ApiError && err.isUnauthenticated) return requireSignIn();
    node.thread.appendChild(
      turn(
        'brandora',
        err instanceof ApiError
          ? err.readable
          : t('error.internal', "Something went wrong on our side. We're on it."),
      ),
    );
  } finally {
    state.asking = false;
    node.submit.disabled = false;
  }
}

function build() {
  const launcher = el('button', {
    class: 'ask-widget__launcher',
    type: 'button',
    'aria-expanded': 'false',
    'aria-label': t('ui.assistant-widget.open', 'Ask Brandora'),
  });
  launcher.appendChild(icon());

  const title = el('span', { class: 'ask-widget__title', text: t('ui.assistant-widget.title', 'Ask Brandora') });
  const close = el('button', {
    class: 'ask-widget__close',
    type: 'button',
    'aria-label': t('ui.assistant-widget.close', 'Close'),
    text: '×',
  });
  const thread = el('div', { class: 'ask-widget__thread' });
  const input = el('input', {
    type: 'text',
    class: 'ask-widget__input',
    placeholder: t('ui.assistant-widget.placeholder', 'Ask a question…'),
    'aria-label': t('ui.assistant-widget.title', 'Ask Brandora'),
  });
  const submit = el('button', {
    class: 'ask-widget__send',
    type: 'submit',
    'aria-label': t('ui.assistant-widget.send', 'Send'),
    text: '→',
  });
  const form = el('form', { class: 'ask-widget__form' }, [input, submit]);
  const fullLink = el('a', {
    class: 'ask-widget__full-link',
    href: 'assistant.html',
    text: t('ui.assistant-widget.open-full', 'Open the full assistant'),
  });

  const panel = el('div', { class: 'ask-widget__panel', hidden: true }, [
    el('header', { class: 'ask-widget__header' }, [title, close]),
    thread,
    form,
    fullLink,
  ]);

  const root = el('div', { class: 'ask-widget', 'data-ask-widget': true }, [panel, launcher]);
  document.body.appendChild(root);

  node = { root, launcher, panel, title, thread, form, input, submit };

  const setOpen = (open) => {
    state.open = open;
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.classList.toggle('ask-widget__launcher--active', open);
    if (open) {
      void resolveProject().then(() => input.focus());
    }
  };

  launcher.addEventListener('click', () => setOpen(!state.open));
  close.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.open) setOpen(false);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void askQuestion(input.value);
  });
}

async function boot() {
  const page = (location.pathname.split('/').pop() || 'index.html');
  if (HIDE_ON_PAGES.has(page)) return;

  let user = null;
  try {
    user = (await api.me()).user;
  } catch {
    user = null;
  }
  // An anonymous visitor has no brand for the assistant to answer from — see
  // the file header for why the launcher stays hidden rather than opening
  // onto a dead end.
  if (!user) return;

  build();
}

void boot();
