/**
 * The admin product list — /admin-products.
 *
 * Every product the public catalogue can possibly show lives behind this
 * screen. See admin-product-form.js for create/edit; this file only lists,
 * filters, and offers publish/unpublish and delete on each row.
 */

import { ApiError, api, clear, el, hideError, mountAccountNav, price, showError } from './api.js';

const node = {
  error: document.querySelector('[data-error]'),
  adminOnly: document.querySelector('[data-admin-only]'),
  addRow: document.querySelector('[data-add-row]'),
  filters: document.querySelector('[data-filters]'),
  empty: document.querySelector('[data-empty]'),
  table: document.querySelector('[data-products]'),
  body: document.querySelector('[data-products] tbody'),
  search: document.querySelector('#f-search'),
  status: document.querySelector('#f-status'),
  category: document.querySelector('#f-category'),
};

function statusBadge(status) {
  const kind = status === 'published' ? 'badge--strong' : status === 'archived' ? 'badge--warn' : '';
  return el('span', { class: `badge ${kind}`, text: status });
}

function row(product) {
  const priceText = product.quoteOnRequest || product.sourcingInProgress
    ? 'On request'
    : product.price
      ? price(product.price)
      : '—';

  return el('tr', {}, [
    el('td', {}, [
      product.mainImage
        ? el('img', { src: product.mainImage, alt: '', width: 48, height: 48, style: 'object-fit:cover;border-radius:6px' })
        : el('span', { class: 'product__meta', text: 'No photo' }),
    ]),
    el('th', { scope: 'row' }, [
      el('a', { href: `admin-product-edit.html?id=${encodeURIComponent(product.id)}`, text: product.name }),
    ]),
    el('td', { text: `${product.category} · ${product.subcategory}` }),
    el('td', { text: priceText }),
    el('td', {}, [statusBadge(product.status)]),
    el('td', { text: new Date(product.updatedAt).toLocaleDateString() }),
    el('td', {}, [
      el('a', { class: 'btn btn--quiet btn--small', href: `admin-product-edit.html?id=${encodeURIComponent(product.id)}`, text: 'Edit' }),
      product.status === 'published'
        ? el('button', { class: 'btn btn--quiet btn--small', type: 'button', text: 'Unpublish', onclick: () => void setStatus(product.id, 'draft') })
        : el('button', { class: 'btn btn--quiet btn--small', type: 'button', text: 'Publish', onclick: () => void setStatus(product.id, 'published') }),
      el('button', { class: 'btn btn--quiet btn--small', type: 'button', text: 'Delete', onclick: () => void remove(product.id, product.name) }),
    ]),
  ]);
}

async function load() {
  hideError(node.error);
  try {
    const params = new URLSearchParams();
    if (node.search.value.trim()) params.set('q', node.search.value.trim());
    if (node.status.value) params.set('status', node.status.value);
    if (node.category.value) params.set('category', node.category.value);

    const { products } = await api.get(`/api/admin/products${params.toString() ? `?${params}` : ''}`);

    node.addRow.hidden = false;
    node.filters.hidden = false;
    node.adminOnly.hidden = true;
    node.empty.hidden = products.length > 0;
    node.table.hidden = products.length === 0;

    clear(node.body);
    for (const product of products) node.body.appendChild(row(product));
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      node.adminOnly.hidden = false;
      node.addRow.hidden = true;
      node.filters.hidden = true;
      node.table.hidden = true;
    } else {
      showError(node.error, err);
    }
  }
}

async function setStatus(id, status) {
  try {
    await api.patch(`/api/admin/products/${id}`, { status });
    await load();
  } catch (err) {
    showError(node.error, err);
  }
}

async function remove(id, name) {
  if (!window.confirm(`Delete "${name}"? This removes its photos too and cannot be undone.`)) return;
  try {
    await api.del(`/api/admin/products/${id}`);
    await load();
  } catch (err) {
    showError(node.error, err);
  }
}

let debounceTimer;
[node.search, node.status, node.category].forEach((input) => {
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void load(), 250);
  });
});

void (async () => {
  const user = await mountAccountNav();
  if (!user || user.role !== 'admin') {
    node.adminOnly.hidden = false;
    return;
  }
  await load();
})();
