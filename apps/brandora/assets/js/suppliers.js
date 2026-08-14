/**
 * Supplier records.
 *
 * The screen exists so an operator can see the four numbers the sourcing agent
 * ranks on — completed, late, defects, disputes — and see them as *counts of
 * things that happened*, never as a rating anyone typed. There is deliberately
 * no control on this page that sets a score, and no control that sets a
 * supplier to "active" directly: verifying one is a separate, recorded act,
 * because the authorisation rule reads that status to decide whether a large
 * order needs a sample first.
 *
 * Everything rendered here is a stored row. Nothing on this page is generated.
 */

import { ApiError, api, clear, el, hideError, mountAccountNav, showError } from './api.js';

const node = {
  list: document.querySelector('[data-suppliers]'),
  filters: document.querySelector('[data-filters]'),
  empty: document.querySelector('[data-empty]'),
  error: document.querySelector('[data-error]'),
  adminOnly: document.querySelector('[data-admin-only]'),
  addPanel: document.querySelector('[data-add-panel]'),
  addForm: document.querySelector('[data-add-form]'),
  addSubmit: document.querySelector('[data-add-submit]'),
};

const state = { status: '', busy: false };

const STATUS_BADGE = {
  active: 'badge--strong',
  unverified: 'badge',
  paused: 'badge',
  blocked: 'badge--warn',
};

/**
 * The record, as a rate where a rate is meaningful.
 *
 * "3 late" means nothing without a denominator, and "40% late" means nothing
 * on two orders. Both are shown, so neither can mislead on its own.
 */
function recordLine(record) {
  const rate = (count) =>
    record.completedOrders > 0 ? ` (${Math.round((count / record.completedOrders) * 100)}%)` : '';

  return el('dl', { class: 'spec spec--tight' }, [
    el('dt', { text: 'Completed' }),
    el('dd', { text: String(record.completedOrders) }),
    el('dt', { text: 'Late' }),
    el('dd', { text: `${record.lateOrders}${rate(record.lateOrders)}` }),
    el('dt', { text: 'Defect reports' }),
    el('dd', { text: `${record.defectReports}${rate(record.defectReports)}` }),
    el('dt', { text: 'Disputes' }),
    el('dd', { text: `${record.disputes}${rate(record.disputes)}` }),
  ]);
}

function supplierCard(supplier) {
  const badges = [
    el('span', {
      class: `badge ${STATUS_BADGE[supplier.status] ?? 'badge'}`,
      text: supplier.status,
    }),
  ];
  if (supplier.riskFlag) {
    badges.push(el('span', { class: 'badge badge--warn', text: supplier.riskFlag }));
  }

  const children = [
    el('div', { class: 'option__head' }, [
      el('h3', { class: 'option__name', text: supplier.name }),
      el('div', { class: 'option__badges' }, badges),
    ]),
    el('p', {
      class: 'option__where',
      text: [supplier.platform, supplier.country, supplier.city].filter(Boolean).join(' · '),
    }),
  ];

  if (supplier.categories.length > 0) {
    children.push(el('p', { class: 'option__why', text: supplier.categories.join(', ') }));
  }

  children.push(recordLine(supplier.record));

  if (supplier.verifiedAt) {
    children.push(
      el('p', {
        class: 'option__why',
        text: `Verified ${new Date(supplier.verifiedAt).toLocaleDateString()}`,
      }),
    );
  } else if (supplier.status === 'unverified') {
    // Said plainly, because it changes what the agent is allowed to do.
    children.push(
      el('p', {
        class: 'option__missed',
        text: 'Not verified. Sourcing will send any order from this supplier to a person, whatever the amount.',
      }),
    );
  }

  const actions = [];
  if (!supplier.verifiedAt) {
    actions.push(
      el('button', {
        class: 'btn btn--small btn--ghost',
        type: 'button',
        text: 'Verify',
        onclick: () => void verify(supplier.id),
      }),
    );
  }
  if (supplier.status !== 'blocked') {
    actions.push(
      el('button', {
        class: 'btn btn--small btn--ghost',
        type: 'button',
        text: 'Block',
        onclick: () => void setStatus(supplier.id, 'blocked'),
      }),
    );
  } else {
    actions.push(
      el('button', {
        class: 'btn btn--small btn--ghost',
        type: 'button',
        text: 'Unblock',
        onclick: () => void setStatus(supplier.id, 'paused'),
      }),
    );
  }
  children.push(el('div', { class: 'option__badges' }, actions));

  return el('article', { class: 'option' }, children);
}

/* --- Reads and writes ------------------------------------------------------- */

async function load() {
  if (state.busy) return;
  state.busy = true;
  hideError(node.error);

  try {
    const query = state.status ? `?status=${encodeURIComponent(state.status)}` : '';
    const { suppliers } = await api.get(`/api/admin/suppliers${query}`);

    node.filters.hidden = false;
    node.addPanel.hidden = false;
    node.adminOnly.hidden = true;

    clear(node.list);
    // Only claim "none recorded" on the unfiltered view. On a filter it means
    // none match, which is a different sentence.
    node.empty.hidden = !(suppliers.length === 0 && state.status === '');
    if (suppliers.length === 0 && state.status !== '') {
      node.list.appendChild(el('p', { class: 'notice', text: `No ${state.status} supplier.` }));
    }
    for (const supplier of suppliers) node.list.appendChild(supplierCard(supplier));
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      node.adminOnly.hidden = false;
      node.filters.hidden = true;
      node.addPanel.hidden = true;
    } else {
      showError(node.error, err);
    }
  } finally {
    state.busy = false;
  }
}

async function verify(id) {
  try {
    await api.post(`/api/admin/suppliers/${id}/verify`, {});
    await load();
  } catch (err) {
    showError(node.error, err);
  }
}

async function setStatus(id, status) {
  try {
    await api.patch(`/api/admin/suppliers/${id}`, { status });
    await load();
  } catch (err) {
    showError(node.error, err);
  }
}

const commaList = (value) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

node.addForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(node.addForm);

  const body = {
    name: String(data.get('name') ?? '').trim(),
    platform: String(data.get('platform') ?? '').trim(),
  };

  const country = String(data.get('country') ?? '').trim().toUpperCase();
  if (country) body.country = country;

  const categories = commaList(String(data.get('categories') ?? ''));
  if (categories.length > 0) body.categories = categories;

  const email = String(data.get('contactEmail') ?? '').trim();
  if (email) body.contactEmail = email;

  // Absent, not zero. A lead time nobody quoted is not a lead time of nothing.
  const leadTime = Number.parseInt(String(data.get('leadTimeDays') ?? ''), 10);
  if (Number.isFinite(leadTime) && leadTime > 0) body.leadTimeDays = leadTime;

  node.addSubmit.disabled = true;
  try {
    await api.post('/api/admin/suppliers', body);
    node.addForm.reset();
    await load();
  } catch (err) {
    showError(node.error, err);
  } finally {
    node.addSubmit.disabled = false;
  }
});

node.filters?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-status]');
  if (!button) return;
  state.status = button.dataset.status ?? '';
  node.filters.querySelectorAll('[data-status]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip === button));
  });
  void load();
});

void (async () => {
  const user = await mountAccountNav();
  if (!user || user.role !== 'admin') {
    node.adminOnly.hidden = false;
    return;
  }
  await load();
})();
