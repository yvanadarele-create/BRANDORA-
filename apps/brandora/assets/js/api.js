/**
 * The browser's side of the API.
 *
 * One rule shapes this file: **the browser holds no application data.** It
 * holds a pointer to which project the person is looking at, and nothing else.
 * Brands, packages, quotes and orders live in the database and are fetched on
 * every page load, so two devices show the same thing and clearing a browser
 * loses nothing.
 *
 * The session is not here either. It is an HttpOnly cookie the server sets,
 * which this file cannot read and an injected script cannot steal. Every call
 * sends `credentials: 'same-origin'` and that is the whole of the auth code.
 */

/** The one thing worth keeping locally: which project the person is working on. */
const PROJECT_KEY = 'brandora.project';

export class ApiError extends Error {
  constructor(status, key, message, reason) {
    super(message || '');
    this.name = 'ApiError';
    this.status = status;
    this.key = key;
    /**
     * A short category the server sends when a failure has an operational
     * cause — `ai-key-rejected`, `ai-timeout`, `ai-http-402`. Never shown as
     * the message; shown *underneath* it, so the person who deployed this can
     * see why without reading a server log, and a customer can ignore a line
     * that plainly is not addressed to them.
     */
    this.reason = reason;
  }

  get isUnauthenticated() {
    return this.status === 401;
  }

  /**
   * What to show a person, in their language.
   *
   * Resolved from the error *key* through the same dictionary the rest of the
   * interface uses, falling back to the server's sentence and only then to a
   * generic one. Keying it means an error is translated like everything else
   * rather than arriving in English on a French page — which is what happened
   * before, because the server's CUSTOMER_MESSAGES table is English-only and
   * the client printed it verbatim.
   */
  get readable() {
    const translated = window.brandoraTranslate ? window.brandoraTranslate(`error.${this.key}`) : null;
    if (translated) return translated;
    if (this.message) return this.message;
    const fallback = window.brandoraTranslate ? window.brandoraTranslate('error.unknown') : null;
    return fallback || 'Something went wrong. Please try again.';
  }
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    // A failed fetch is a network problem, not a server error. Saying so is the
    // difference between "check your connection" and "we broke something".
    throw new ApiError(0, 'network', 'We could not reach Brandora. Check your connection and try again.');
  }

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (err) {
      payload = {};
    }
  }

  if (!response.ok) {
    // Two shapes reach here and both have to be understood.
    //
    // A route error is `{ error: "auth.required", message: "..." }`. A boot
    // failure from api/index.js is `{ success: false, error: { code, message } }`
    // — the shape §17 asks for. Reading only the first is why a 503 from an
    // unconfigured server showed "Something went wrong" instead of saying the
    // service was not configured: `payload.error` was an object, so the key was
    // an object and `payload.message` was undefined.
    const envelope = payload.error;
    const structured = envelope !== null && typeof envelope === 'object';

    throw new ApiError(
      response.status,
      structured ? envelope.code || 'unknown' : envelope || 'unknown',
      structured ? envelope.message : payload.message,
      structured ? envelope.reason : payload.reason,
    );
  }
  return payload;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body || {}),
  put: (path, body) => request('PUT', path, body || {}),
  patch: (path, body) => request('PATCH', path, body || {}),
  del: (path) => request('DELETE', path),

  /* Account */
  me: () => request('GET', '/api/auth/me'),
  signup: (input) => request('POST', '/api/auth/signup', input),
  login: (input) => request('POST', '/api/auth/login', input),
  logout: () => request('POST', '/api/auth/logout', {}),
  requestPasswordReset: (email) => request('POST', '/api/auth/password-reset/request', { email }),
  confirmPasswordReset: (token, password) =>
    request('POST', '/api/auth/password-reset/confirm', { token, password }),

  /* Projects */
  projects: () => request('GET', '/api/projects'),
  createProject: (name) => request('POST', '/api/projects', { name }),
  project: (id) => request('GET', `/api/projects/${id}`),
  saveInterview: (id, answers) => request('PUT', `/api/projects/${id}/interview`, { answers }),
  generate: (id, body) => request('POST', `/api/projects/${id}/generate`, body || {}),
  regenerate: (id, field) => request('POST', `/api/projects/${id}/regenerate`, { field }),
  regenerateIdentity: (id, variation) =>
    request('POST', `/api/projects/${id}/identity/regenerate`, { variation }),
  brand: (id) => request('GET', `/api/projects/${id}/brand`),
  recommendations: (id, quantity) =>
    request('GET', `/api/projects/${id}/recommendations?quantity=${encodeURIComponent(quantity)}`),

  /* Catalogue */
  catalog: (params) => request('GET', `/api/catalog${params ? `?${params}` : ''}`),
  requestQuote: (productId, input) => request('POST', `/api/catalog/${productId}/quote-request`, input),

  /* Package */
  package: (id) => request('GET', `/api/projects/${id}/package`),
  addItem: (id, item) => request('POST', `/api/projects/${id}/package/items`, item),
  setItemQuantity: (id, itemId, quantity) =>
    request('PATCH', `/api/projects/${id}/package/items/${itemId}`, { quantity }),
  removeItem: (id, itemId) => request('DELETE', `/api/projects/${id}/package/items/${itemId}`),

  /* Money */
  createQuote: (id) => request('POST', `/api/projects/${id}/quote`),
  quote: (id) => request('GET', `/api/quotes/${id}`),
  checkout: (quoteId) => request('POST', `/api/quotes/${quoteId}/checkout`, {}),
  order: (id) => request('GET', `/api/orders/${id}`),
  verifyPayment: (orderId) => request('POST', `/api/orders/${orderId}/verify`, {}),
  dashboard: () => request('GET', '/api/dashboard'),
};

/* --- Which project is on screen -------------------------------------------- */

/**
 * A pointer, not a copy.
 *
 * The id in the URL wins, because a link someone pasted must open the project
 * they meant. Storage is only the memory of where they were last, so returning
 * to `/catalog` lands on the same brand rather than on nothing.
 */
export function currentProjectId() {
  const fromUrl = new URLSearchParams(window.location.search).get('project');
  if (fromUrl) {
    rememberProject(fromUrl);
    return fromUrl;
  }
  try {
    return localStorage.getItem(PROJECT_KEY);
  } catch (err) {
    return null;
  }
}

export function rememberProject(id) {
  try {
    if (id) localStorage.setItem(PROJECT_KEY, id);
    else localStorage.removeItem(PROJECT_KEY);
  } catch (err) {
    // Private browsing. The `?project=` parameter still carries it.
  }
}

export function projectUrl(page, id) {
  return id ? `${page}?project=${encodeURIComponent(id)}` : page;
}

/* --- Page furniture --------------------------------------------------------- */

/**
 * Reflect the signed-in state in the header.
 *
 * Fails open toward "signed out": if the call fails, the person sees Log in,
 * which is recoverable. Showing a dashboard link that 401s is not.
 */
export async function mountAccountNav() {
  const signedOut = document.querySelectorAll('[data-when-signed-out]');
  const signedIn = document.querySelectorAll('[data-when-signed-in]');
  const adminOnly = document.querySelectorAll('[data-when-admin]');

  const show = (nodes, visible) => {
    nodes.forEach((node) => {
      node.hidden = !visible;
    });
  };

  let user = null;
  try {
    user = (await api.me()).user;
  } catch (err) {
    user = null;
  }

  show(signedOut, !user);
  show(signedIn, !!user);
  show(adminOnly, !!user && user.role === 'admin');

  document.querySelectorAll('[data-account-name]').forEach((node) => {
    node.textContent = user ? user.name : '';
  });

  document.querySelectorAll('[data-logout]').forEach((node) => {
    node.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await api.logout();
      } finally {
        rememberProject(null);
        window.location.href = 'index.html';
      }
    });
  });

  return user;
}

/**
 * Send an unauthenticated visitor to sign in, and bring them back afterwards.
 *
 * The return path is carried in the URL rather than in storage so it survives a
 * different tab, and it is validated on the way back — an open redirect that
 * starts at a login page is the most useful kind for a phisher.
 */
export function requireSignIn() {
  const here = window.location.pathname + window.location.search;
  window.location.href = `login.html?next=${encodeURIComponent(here)}`;
}

export function safeNext(raw) {
  if (!raw) return null;
  // Same-origin, absolute-path only. Anything else — a scheme, a host, a
  // protocol-relative "//evil.example" — is discarded rather than repaired.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/* --- Small shared helpers --------------------------------------------------- */

export function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  });
  (children || []).forEach((child) => {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Show a failure where the person can see it, in words they can act on.
 *
 * The server already decided what a customer may be told; this does not
 * second-guess it or add a technical detail of its own.
 */
export function showError(node, err) {
  if (!node) return;
  node.textContent =
    err instanceof ApiError
      ? err.readable
      : (window.brandoraTranslate && window.brandoraTranslate('error.unknown')) ||
        'Something went wrong. Please try again.';
  node.hidden = false;
}

export function hideError(node) {
  if (node) node.hidden = true;
}

/** Money always arrives pre-formatted from the server. The browser never divides. */
export const price = (money) => (money ? money.display : '—');

/**
 * A localised catalogue field: `product.nameFr` for `name`, and so on.
 *
 * The server sends every language it has (see productView in routes.ts) and
 * leaves the choice to the browser, the same division of labour as the rest
 * of the i18n system — `document.documentElement.lang` is already the
 * authoritative "what language is this page in right now" flag, kept current
 * by applyLocale() on every switch, so reading it here needs no new state to
 * track. A product with no translation yet for the active language falls
 * back to the base field rather than rendering blank — the same rule
 * `t()`'s own English fallback follows for UI copy.
 */
export function localizedField(product, field) {
  const suffix = { fr: 'Fr', es: 'Es' }[document.documentElement.lang];
  const localized = suffix && product[field + suffix];
  return localized || product[field];
}

/**
 * A product's price, or the honest reason there isn't one.
 *
 * `product.unitPrice` is still a real Money object (zero) on a quote-on-request
 * product — the field can never be absent without breaking every consumer that
 * expects Money — so calling `price()` on it directly would print "0 FCFA" for
 * something nobody priced at zero. Check the flag first.
 */
export const priceLabel = (product) =>
  product.quoteOnRequest ? t('ui.catalog.quote-on-request', 'Price on request') : price(product.unitPrice);

/**
 * The customisation tag's text, translated.
 *
 * The server computes `customization.label` so tests can assert on it without
 * loading a translator, but it is only ever English — a customer-facing tag
 * must go through `t()` like everything else, keyed on the one fact that
 * actually varies (`confidence`), with that same English sentence as the
 * fallback for a locale that has not translated the key yet.
 */
export const confidenceLabel = (customization) =>
  t(`ui.catalog.confidence.${customization.confidence}`, customization.label);

/* --- Language --------------------------------------------------------------- */

/**
 * Translate a key, falling back to the English written at the call site.
 *
 * `data-i18n` only reaches text that already exists in the markup. Everything
 * these page scripts build — a product card, a total, an empty state — is
 * created after the translator has run over the document, so it never sees it.
 * That is why the interface came out half French: the shell translated and the
 * content did not.
 *
 * The English fallback stays in the source deliberately. A missing key then
 * shows a real sentence rather than `catalog.add-to-package`, and the call site
 * still reads as a sentence to whoever is editing it.
 */
export function t(key, fallback, vars) {
  const translated = window.brandoraTranslate ? window.brandoraTranslate(key, vars) : null;
  if (translated === null || translated === undefined) {
    if (!vars) return fallback;
    return String(fallback).replace(/\{(\w+)\}/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
    );
  }
  return translated;
}

/**
 * Redraw when the visitor changes language.
 *
 * Translating on first paint is not enough. Someone who opens the catalogue in
 * English and then switches to French has a page of English product cards that
 * no amount of re-running `applyLocale` will touch, because those cards are not
 * in the markup — the script made them. So each page hands over the function
 * that rebuilds its own content, and it runs again on every switch.
 */
export function onLocaleChange(redraw) {
  document.addEventListener('brandora:locale', () => {
    try {
      redraw();
    } catch (err) {
      // A redraw that throws must not take the language switch down with it:
      // the rest of the page has already translated correctly.
      console.error('[brandora] redraw after a language change failed:', err);
    }
  });
}

/* --- Booking ---------------------------------------------------------------- */

/**
 * Wire every booking control to the one Calendly event.
 *
 * The URL is fetched from `/api/settings`, not written into the markup, so the
 * owner changes it in one environment variable rather than in nine files. When
 * it is unset, the controls stay hidden — a "Book a call" button that opens the
 * contact page instead is worse than no button, because it teaches a visitor
 * that the button does not work.
 *
 * The scheduler opens inside Brandora's own dialog rather than through
 * Calendly's popup, whose focus handling and close affordance cannot be
 * corrected from here. Their script is loaded on first open, not on page load:
 * a visitor who never books should not pay for it, and this product is used on
 * metered mobile data.
 */
let schedulingUrl = null;
let calendlyScript = null;

export async function mountBooking() {
  const controls = document.querySelectorAll('[data-book-call]');
  if (controls.length === 0) return;

  try {
    schedulingUrl = (await api.get('/api/settings')).calendlyUrl || null;
  } catch (err) {
    schedulingUrl = null;
  }

  controls.forEach((control) => {
    control.hidden = !schedulingUrl;
    if (!schedulingUrl) return;
    control.addEventListener('click', (event) => {
      event.preventDefault();
      openScheduler();
    });
  });
}

/**
 * Show or hide "Sign in with Google", the same way mountBooking() shows or
 * hides "Book a call": ask /api/settings, and if the feature is not
 * configured the control simply is not there rather than opening onto an
 * error. A real click just navigates to /api/auth/google/start — this is not
 * a JS SDK integration, so there is nothing else to wire up here.
 */
export async function mountGoogleSignIn() {
  const controls = document.querySelectorAll('[data-google-signin]');
  if (controls.length === 0) return;

  let enabled = false;
  try {
    enabled = Boolean((await api.get('/api/settings')).googleSignInEnabled);
  } catch (err) {
    enabled = false;
  }

  controls.forEach((control) => {
    control.hidden = !enabled;
  });
}

function loadCalendly() {
  if (calendlyScript) return calendlyScript;
  calendlyScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return calendlyScript;
}

function openScheduler() {
  if (!schedulingUrl) return;

  const dialog = el('div', { class: 'scheduler', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ui.booking.book-a-call', 'Book a call') }, [
    el('div', { class: 'scheduler__panel' }, [
      el('button', {
        class: 'btn btn--ghost btn--small scheduler__close',
        type: 'button',
        'aria-label': 'Close',
        text: 'Close',
      }),
      el('div', { class: 'scheduler__embed', 'data-embed': true }),
    ]),
  ]);

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
  // Scroll lock: a month grid behind a scrolling page is unusable on a phone.
  document.body.style.overflow = 'hidden';
  dialog.querySelector('.scheduler__close').focus();

  loadCalendly()
    .then(() => {
      window.Calendly.initInlineWidget({
        url: schedulingUrl,
        parentElement: dialog.querySelector('[data-embed]'),
      });
    })
    .catch(() => {
      // The embed could not load. Give them the link rather than a blank panel.
      const embed = dialog.querySelector('[data-embed]');
      clear(embed);
      embed.appendChild(
        el('p', { class: 'notice' }, [
          el('span', { text: t('ui.booking.load-failed', 'The scheduler could not load. ') }),
          el('a', {
            href: schedulingUrl,
            target: '_blank',
            rel: 'noopener',
            text: t('ui.booking.open-new-tab', 'Open it in a new tab'),
          }),
        ]),
      );
    });
}
