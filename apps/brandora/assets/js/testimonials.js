/**
 * Testimonials, for the person entering them.
 *
 * The screen exists so real quotes can be recorded and published deliberately.
 * There is no import, no generator and no sample data — the only way a quote
 * gets here is somebody typing what a customer actually said.
 *
 * Publishing is refused without a recorded consent date. The server enforces
 * that; this screen shows the reason rather than a bare 400, because the person
 * who needs to understand the rule is the one standing in front of this form.
 */

import { ApiError, api, clear, el, hideError, mountAccountNav, showError } from './api.js';

const node = {
  list: document.querySelector('[data-testimonials]'),
  empty: document.querySelector('[data-empty]'),
  error: document.querySelector('[data-error]'),
  adminOnly: document.querySelector('[data-admin-only]'),
  addPanel: document.querySelector('[data-add-panel]'),
  addForm: document.querySelector('[data-add-form]'),
  addSubmit: document.querySelector('[data-add-submit]'),
};

function card(t) {
  const badges = [
    el('span', {
      class: `badge ${t.approved ? 'badge--strong' : ''}`,
      text: t.approved ? 'published' : 'draft',
    }),
  ];
  if (!t.consentAt) badges.push(el('span', { class: 'badge badge--warn', text: 'no consent recorded' }));

  const attribution = [t.authorRole, t.company, t.country].filter(Boolean).join(' · ');

  return el('article', { class: 'option' }, [
    el('div', { class: 'option__head' }, [
      el('h3', { class: 'option__name', text: t.authorName }),
      el('div', { class: 'option__badges' }, badges),
    ]),
    attribution ? el('p', { class: 'option__where', text: attribution }) : null,
    el('blockquote', { class: 'word__quote' }, [el('p', { text: t.quote })]),
    el('p', {
      class: 'option__why',
      text: t.consentAt
        ? `Consent recorded ${new Date(t.consentAt).toLocaleDateString()}`
        : 'No consent date. Publishing is refused until one is recorded.',
    }),
    el('div', { class: 'option__badges' }, [
      el('button', {
        class: 'btn btn--small btn--ghost',
        type: 'button',
        text: t.approved ? 'Unpublish' : 'Publish',
        onclick: () => void setApproved(t.id, !t.approved),
      }),
      el('button', {
        class: 'btn btn--small btn--ghost',
        type: 'button',
        text: 'Delete',
        onclick: () => void remove(t.id),
      }),
    ]),
  ]);
}

async function load() {
  hideError(node.error);
  try {
    const { testimonials } = await api.get('/api/admin/testimonials');
    node.addPanel.hidden = false;
    node.adminOnly.hidden = true;
    node.empty.hidden = testimonials.length > 0;
    clear(node.list);
    for (const t of testimonials) node.list.appendChild(card(t));
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      node.adminOnly.hidden = false;
      node.addPanel.hidden = true;
    } else {
      showError(node.error, err);
    }
  }
}

async function setApproved(id, approved) {
  try {
    await api.patch(`/api/admin/testimonials/${id}`, { approved });
    await load();
  } catch (err) {
    // The consent rule arrives here as a 400. The server's sentence explains
    // itself, so it is shown rather than replaced with "something went wrong".
    showError(node.error, err);
  }
}

async function remove(id) {
  try {
    await api.del(`/api/admin/testimonials/${id}`);
    await load();
  } catch (err) {
    showError(node.error, err);
  }
}

node.addForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(node.addForm);
  const body = {
    quote: String(data.get('quote') ?? '').trim(),
    authorName: String(data.get('authorName') ?? '').trim(),
  };
  for (const [field, key] of [['authorRole', 'authorRole'], ['company', 'company']]) {
    const value = String(data.get(field) ?? '').trim();
    if (value) body[key] = value;
  }
  const country = String(data.get('country') ?? '').trim().toUpperCase();
  if (country) body.country = country;

  // A date input gives YYYY-MM-DD; the column stores an instant.
  const consent = String(data.get('consentAt') ?? '').trim();
  if (consent) body.consentAt = new Date(`${consent}T00:00:00Z`).toISOString();

  node.addSubmit.disabled = true;
  try {
    await api.post('/api/admin/testimonials', body);
    node.addForm.reset();
    await load();
  } catch (err) {
    showError(node.error, err);
  } finally {
    node.addSubmit.disabled = false;
  }
});

void (async () => {
  const user = await mountAccountNav();
  if (!user || user.role !== 'admin') {
    node.adminOnly.hidden = false;
    return;
  }
  await load();
})();
