/**
 * A single product: what Brandora actually knows about it, and a form to ask
 * for a quote. See the MVP simplification brief, §4-6.
 *
 * No account is required to submit the form (§6) — every field the request
 * needs travels with the request itself. What is confirmed prefills the
 * matching field; what is not confirmed is left blank with a short note,
 * rather than guessed (§4's "do not display information that is unknown as
 * if it were confirmed").
 */

import {
  ApiError,
  api,
  clear,
  confidenceLabel,
  el,
  localizedField,
  mountAccountNav,
  priceLabel,
  t,
} from './api.js';

const MAX_LOGO_BYTES = 150_000;

const node = {
  error: document.querySelector('[data-error]'),
  notFound: document.querySelector('[data-not-found]'),
  product: document.querySelector('[data-product]'),
  photos: document.querySelector('[data-photos]'),
  category: document.querySelector('[data-detail-category]'),
  name: document.querySelector('[data-detail-name]'),
  description: document.querySelector('[data-detail-description]'),
  specs: document.querySelector('[data-specs]'),
  supplier: document.querySelector('[data-detail-supplier]'),
  form: document.querySelector('[data-quote-form]'),
  quoteError: document.querySelector('[data-quote-error]'),
  quoteSubmit: document.querySelector('[data-quote-submit]'),
  quoteSent: document.querySelector('[data-quote-sent]'),
  materialHint: document.querySelector('[data-material-hint]'),
  shapeHint: document.querySelector('[data-shape-hint]'),
  dimensionsHint: document.querySelector('[data-dimensions-hint]'),
};

function productId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

function formatDimensions(dimensions) {
  const parts = [];
  if (dimensions.lengthMm && dimensions.widthMm) {
    parts.push(`${dimensions.lengthMm} × ${dimensions.widthMm} mm`);
  } else if (dimensions.lengthMm) {
    parts.push(`${dimensions.lengthMm} mm`);
  }
  if (dimensions.heightMm) parts.push(`${t('product.detail.height', 'height')} ${dimensions.heightMm} mm`);
  if (dimensions.volumeMl) parts.push(`${dimensions.volumeMl} ml`);
  if (dimensions.weightG) parts.push(`${dimensions.weightG} g`);
  return parts.join(' · ');
}

function specRow(label, value) {
  if (!value) return null;
  return [el('dt', { text: label }), el('dd', { text: value })];
}

function renderPhotos(product, name) {
  clear(node.photos);
  const images = product.images && product.images.length > 0 ? product.images : [];
  if (images.length === 0) {
    node.photos.appendChild(el('p', { class: 'product__meta', text: t('product.detail.no-photo', 'No photo yet.') }));
    return;
  }
  images.forEach((src, index) => {
    node.photos.appendChild(
      el('img', {
        class: 'product__photo',
        src,
        alt: name,
        loading: index === 0 ? 'eager' : 'lazy',
        decoding: 'async',
      }),
    );
  });
}

function renderSpecs(product) {
  clear(node.specs);
  const dimensionsLabel = product.dimensions ? formatDimensions(product.dimensions) : '';

  const rows = [
    specRow(t('product.detail.material', 'Material'), product.material),
    specRow(t('product.detail.shape', 'Shape'), product.shape),
    specRow(t('product.detail.dimensions', 'Dimensions'), dimensionsLabel),
    specRow(t('product.detail.colors', 'Colours'), (product.colors || []).join(', ')),
    product.sourcingInProgress
      ? [el('dt', { text: t('product.detail.minimum', 'Minimum order') }), el('dd', { text: t('product.detail.minimum-unconfirmed', 'Not yet confirmed — tell us how many you need') })]
      : specRow(t('product.detail.minimum', 'Minimum order'), String(product.minimumQuantity)),
    specRow(t('product.detail.price', 'Price'), priceLabel(product)),
    specRow(t('product.detail.customization', 'Customization'), confidenceLabel(product.customization)),
  ].filter(Boolean);

  rows.forEach((pair) => pair.forEach((n) => node.specs.appendChild(n)));

  if (product.customization && product.customization.notes) {
    node.specs.appendChild(el('dt', { text: t('product.detail.notes', 'Notes') }));
    node.specs.appendChild(el('dd', { text: product.customization.notes }));
  }
}

function prefillHint(input, hintNode, value, unknownText) {
  if (value) {
    input.value = value;
    hintNode.textContent = '';
  } else {
    hintNode.textContent = unknownText;
  }
}

function render(product) {
  const name = localizedField(product, 'name');
  document.title = `${name} — Brandora Union`;

  node.category.textContent = `${product.category} · ${product.subcategory}`;
  node.name.textContent = name;
  node.description.textContent = localizedField(product, 'description');

  renderPhotos(product, name);
  renderSpecs(product);

  node.supplier.textContent = product.supplierReference
    ? t('ui.catalog.sourced-from', 'Sourced from {supplier}', { supplier: product.supplierReference.name })
    : product.sourcingInProgress
      ? t('ui.catalog.sourcing-in-progress', 'Brandora is sourcing this — no manufacturer confirmed yet')
      : '';

  const quantityInput = node.form.querySelector('#qr-quantity');
  quantityInput.value = product.minimumQuantity || 1;
  quantityInput.min = String(product.minimumQuantity || 1);

  const unknown = t('product.detail.not-confirmed', 'Not confirmed by the supplier yet — tell us what you need.');
  prefillHint(node.form.querySelector('#qr-material'), node.materialHint, product.material, unknown);
  prefillHint(node.form.querySelector('#qr-shape'), node.shapeHint, product.shape, unknown);
  const dimensionsLabel = product.dimensions ? formatDimensions(product.dimensions) : '';
  prefillHint(node.form.querySelector('#qr-dimensions'), node.dimensionsHint, dimensionsLabel, unknown);

  node.product.hidden = false;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('could not read the file'));
    reader.readAsDataURL(file);
  });
}

function wireForm(product) {
  node.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    node.quoteError.hidden = true;

    const data = new FormData(node.form);
    const file = node.form.querySelector('#qr-logo').files[0];
    if (file && file.size > MAX_LOGO_BYTES) {
      node.quoteError.textContent = t(
        'ui.quote-request.logo-too-large',
        'That logo file is too large — please use one under 150KB.',
      );
      node.quoteError.hidden = false;
      return;
    }

    const customizationOptions = Array.from(
      node.form.querySelectorAll('input[name="customizationOption"]:checked'),
    ).map((input) => input.value);

    node.quoteSubmit.disabled = true;
    const original = node.quoteSubmit.textContent;
    node.quoteSubmit.textContent = t('ui.quote-request.sending', 'Sending…');

    try {
      let logoFilename;
      let logoData;
      if (file) {
        const dataUrl = await readFileAsDataUrl(file);
        logoFilename = file.name;
        logoData = dataUrl.split(',')[1] || '';
      }

      const quantity = Number(data.get('quantity'));
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new ApiError(400, 'quantity', t('product.quote.bad-quantity', 'Enter a whole number greater than zero.'));
      }

      await api.requestQuote(product.id, {
        customerName: String(data.get('customerName') || '').trim(),
        email: String(data.get('email') || '').trim(),
        quantity,
        ...(String(data.get('companyName') || '').trim() ? { companyName: String(data.get('companyName')).trim() } : {}),
        ...(String(data.get('phone') || '').trim() ? { phone: String(data.get('phone')).trim() } : {}),
        ...(String(data.get('material') || '').trim() ? { material: String(data.get('material')).trim() } : {}),
        ...(String(data.get('shape') || '').trim() ? { shape: String(data.get('shape')).trim() } : {}),
        ...(String(data.get('dimensions') || '').trim() ? { dimensions: String(data.get('dimensions')).trim() } : {}),
        ...(String(data.get('quality') || '').trim() ? { quality: String(data.get('quality')).trim() } : {}),
        ...(customizationOptions.length > 0 ? { customization: customizationOptions.join(', ') } : {}),
        ...(String(data.get('destination') || '').trim() ? { destination: String(data.get('destination')).trim() } : {}),
        ...(String(data.get('desiredTimeframe') || '').trim() ? { desiredTimeframe: String(data.get('desiredTimeframe')).trim() } : {}),
        ...(String(data.get('message') || '').trim() ? { message: String(data.get('message')).trim() } : {}),
        ...(logoFilename ? { logoFilename, logoData } : {}),
      });

      node.form.hidden = true;
      node.quoteSent.hidden = false;
    } catch (err) {
      node.quoteSubmit.disabled = false;
      node.quoteSubmit.textContent = original;
      node.quoteError.textContent =
        err instanceof ApiError ? err.readable : t('error.unknown', 'Something went wrong. Please try again.');
      node.quoteError.hidden = false;
    }
  });
}

async function boot() {
  await mountAccountNav();

  const id = productId();
  if (!id) {
    node.notFound.hidden = false;
    return;
  }

  try {
    const { product } = await api.product(id);
    render(product);
    wireForm(product);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      node.notFound.hidden = false;
    } else {
      node.error.textContent =
        err instanceof ApiError ? err.readable : t('error.unknown', 'Something went wrong. Please try again.');
      node.error.hidden = false;
    }
  }
}

void boot();
