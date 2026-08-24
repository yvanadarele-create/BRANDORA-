/**
 * The product editor — shared by admin-product-new.html and
 * admin-product-edit.html (spec: "the same form should be reusable for
 * Create Product / Edit Product. Do not create two completely separate
 * implementations.").
 *
 * Mode is decided by the URL, the same way product.html and every other
 * id-bearing page in this app already works: `?id=` present means edit,
 * absent means create. The image panel only exists in the edit page's
 * markup — a product needs to exist in the database before a photo can be
 * attached to it, so admin-product-new.html has none, and this file simply
 * skips that section when it finds nothing to mount it on.
 */

import { ApiError, api, clear, el, mountAccountNav, showError } from './api.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const productId = new URLSearchParams(window.location.search).get('id') || '';
const isEdit = Boolean(productId);

const node = {
  error: document.querySelector('[data-error]'),
  adminOnly: document.querySelector('[data-admin-only]'),
  editor: document.querySelector('[data-editor]'),
  title: document.querySelector('[data-product-title]'),
  form: document.querySelector('[data-product-form]'),
  formError: document.querySelector('[data-form-error]'),
  submit: document.querySelector('[data-submit]'),
  quoteToggle: document.querySelector('[data-quote-toggle]'),
  price: document.querySelector('#p-price'),
  imagePanel: document.querySelector('[data-image-panel]'),
  imageInput: document.querySelector('[data-image-input]'),
  imageError: document.querySelector('[data-image-error]'),
};

/**
 * No price without either a confirmed supplier or an explicit "quote on
 * request" — grey the field out rather than let it hold a number the form
 * is about to discard on submit (see readForm()'s sourcingInProgress logic).
 */
const supplierNameInput = document.querySelector('#p-manufacturer');
function syncPriceField() {
  if (!node.price) return;
  const noSupplier = supplierNameInput && !supplierNameInput.value.trim();
  const disabled = Boolean(node.quoteToggle?.checked) || Boolean(noSupplier);
  node.price.disabled = disabled;
  if (disabled) node.price.value = '';
}
node.quoteToggle?.addEventListener('change', syncPriceField);
supplierNameInput?.addEventListener('input', syncPriceField);

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('could not read the file'));
    reader.readAsDataURL(file);
  });
}

function fillForm(product) {
  const form = node.form;
  form.name.value = product.name || '';
  form.nameFr.value = product.nameFr || '';
  form.description.value = product.description || '';
  form.descriptionFr.value = product.descriptionFr || '';
  form.category.value = product.category || '';
  form.subcategory.value = product.subcategory || '';
  form.status.value = product.status || 'draft';
  form.featured.checked = Boolean(product.featured);
  form.material.value = product.material || '';
  form.shape.value = product.shape || '';
  form.colors.value = (product.colors || []).join(', ');
  form.lengthMm.value = product.dimensions?.lengthMm ?? '';
  form.widthMm.value = product.dimensions?.widthMm ?? '';
  form.heightMm.value = product.dimensions?.heightMm ?? '';
  form.weightG.value = product.dimensions?.weightG ?? '';
  form.volumeMl.value = product.dimensions?.volumeMl ?? '';
  form.supplierName.value = product.supplierReference?.name || '';
  form.quoteOnRequest.checked = Boolean(product.quoteOnRequest);
  form.price.value = product.price ? product.price.major : '';
  form.currency.value = product.currency || 'XOF';
  form.minimumQuantity.value = product.minimumQuantity ?? 0;
  form.availableQuantity.value = product.availableQuantity ?? 0;
  form.confidence.value = product.customization?.confidence || 'unknown';
  form.customizationNotes.value = product.customization?.notes || '';
  syncPriceField();

  if (node.title) node.title.textContent = `Edit — ${product.name}`;
  document.title = `${product.name} — Administration Brandora`;
}

function readForm() {
  const form = node.form;
  const data = new FormData(form);
  const text = (name, max) => String(data.get(name) ?? '').trim().slice(0, max ?? 4000);

  const body = {
    name: text('name', 200),
    description: text('description', 4000),
    category: text('category', 40),
    subcategory: text('subcategory', 100),
    status: text('status', 20),
    featured: form.featured.checked,
  };

  const nameFr = text('nameFr', 200);
  if (nameFr) body.nameFr = nameFr;
  const descriptionFr = text('descriptionFr', 4000);
  if (descriptionFr) body.descriptionFr = descriptionFr;
  const material = text('material', 200);
  if (material) body.material = material;
  const shape = text('shape', 60);
  if (shape) body.shape = shape;

  const colors = text('colors', 500);
  body.colors = colors ? colors.split(',').map((c) => c.trim()).filter(Boolean) : [];

  const dims = {};
  for (const [field, key] of [['lengthMm', 'lengthMm'], ['widthMm', 'widthMm'], ['heightMm', 'heightMm'], ['weightG', 'weightG'], ['volumeMl', 'volumeMl']]) {
    const raw = data.get(field);
    if (raw !== null && String(raw).trim() !== '') dims[key] = Number(raw);
  }
  body.dimensions = dims;

  body.minimumQuantity = Number(data.get('minimumQuantity') || 0);
  body.availableQuantity = Number(data.get('availableQuantity') || 0);
  body.currency = text('currency', 3) || 'XOF';

  const supplierName = text('supplierName', 200);
  // No confirmed supplier means no confirmed price either — the server
  // enforces this too (see catalogProducts.create/update), but the form
  // should not even try to submit a price next to an unconfirmed supplier.
  body.sourcingInProgress = !supplierName;
  body.supplierReference = supplierName ? { name: supplierName } : null;
  body.quoteOnRequest = body.sourcingInProgress || form.quoteOnRequest.checked;

  const priceRaw = data.get('price');
  if (!body.quoteOnRequest && priceRaw !== null && String(priceRaw).trim() !== '') {
    body.price = Number(priceRaw);
  }

  body.customization = {
    confidence: text('confidence', 20) || 'unknown',
    methods: [],
    notes: text('customizationNotes', 1000),
  };

  return body;
}

function imageThumb(image, isMain) {
  return el('div', { class: 'card card--flat', style: 'width:140px' }, [
    el('img', { src: image.url, alt: '', width: 140, height: 140, style: 'object-fit:cover;border-radius:8px;display:block' }),
    isMain ? el('p', { class: 'badge badge--strong', style: 'margin-top:0.4rem', text: 'Main image' }) : null,
    el('div', { style: 'display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap' }, [
      !isMain
        ? el('button', {
            class: 'btn btn--quiet btn--small',
            type: 'button',
            text: 'Set as main',
            onclick: () => void setMainImage(image.url),
          })
        : null,
      el('button', {
        class: 'btn btn--quiet btn--small',
        type: 'button',
        text: 'Remove',
        onclick: () => void removeImage(image.id),
      }),
    ]),
  ]);
}

async function loadProduct() {
  const { product } = await api.get(`/api/admin/products/${encodeURIComponent(productId)}`);
  fillForm(product);
  if (node.imagePanel) {
    clear(node.imagePanel);
    for (const image of product.images) node.imagePanel.appendChild(imageThumb(image, image.url === product.mainImage));
    if (product.images.length === 0) {
      node.imagePanel.appendChild(el('p', { class: 'product__meta', text: 'No photos yet.' }));
    }
  }
  return product;
}

async function setMainImage(url) {
  try {
    await api.patch(`/api/admin/products/${productId}`, { mainImage: url });
    await loadProduct();
  } catch (err) {
    showError(node.imageError, err);
  }
}

async function removeImage(imageId) {
  try {
    await api.del(`/api/admin/products/${productId}/images/${imageId}`);
    await loadProduct();
  } catch (err) {
    showError(node.imageError, err);
  }
}

node.imageInput?.addEventListener('change', async () => {
  const file = node.imageInput.files?.[0];
  node.imageInput.value = '';
  if (!file) return;
  node.imageError.hidden = true;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    showError(node.imageError, new Error('Please choose a JPG, PNG or WEBP file.'));
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    showError(node.imageError, new Error('That image is larger than 8MB — please choose a smaller file.'));
    return;
  }

  try {
    const data = await readFileAsDataUrl(file);
    await api.post(`/api/admin/products/${productId}/images`, { data });
    await loadProduct();
  } catch (err) {
    showError(node.imageError, err);
  }
});

node.form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  node.formError.hidden = true;
  node.submit.disabled = true;
  try {
    const body = readForm();
    if (isEdit) {
      await api.patch(`/api/admin/products/${productId}`, body);
      await loadProduct();
    } else {
      const { product } = await api.post('/api/admin/products', body);
      window.location.href = `admin-product-edit.html?id=${encodeURIComponent(product.id)}`;
      return;
    }
  } catch (err) {
    showError(node.formError, err);
  } finally {
    node.submit.disabled = false;
  }
});

void (async () => {
  const user = await mountAccountNav();
  if (!user || user.role !== 'admin') {
    node.adminOnly.hidden = false;
    return;
  }

  if (isEdit) {
    try {
      await loadProduct();
      if (node.editor) node.editor.hidden = false;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        showError(node.error, new Error('That product no longer exists.'));
      } else {
        showError(node.error, err);
      }
    }
  } else if (node.editor) {
    node.editor.hidden = false;
  } else {
    // admin-product-new.html has no [data-editor] wrapper — the form is
    // always visible there; only the admin-only gate above matters.
  }
})();
