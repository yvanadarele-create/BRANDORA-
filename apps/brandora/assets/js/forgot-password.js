/**
 * Request a password reset link.
 *
 * The server's response is the same sentence whether or not the address has
 * an account (see routes.ts) — this page shows exactly that sentence and
 * nothing more specific, which is the point rather than an oversight.
 */
import { api, hideError, showError } from './api.js';

const form = document.querySelector('[data-forgot-form]');
const errorNode = document.querySelector('[data-error]');
const sentNode = document.querySelector('[data-sent]');

function busy(isBusy) {
  const button = form.querySelector('[data-submit]');
  if (!button) return;
  button.disabled = isBusy;
  button.setAttribute('aria-busy', isBusy ? 'true' : 'false');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError(errorNode);
  busy(true);
  try {
    const email = new FormData(form).get('email');
    await api.requestPasswordReset(email);
    sentNode.hidden = false;
    form.hidden = true;
  } catch (err) {
    showError(errorNode, err);
  } finally {
    busy(false);
  }
});
