/**
 * Spend a reset token: post the new password, then follow the session the
 * server just created (the confirm endpoint sets the cookie itself, exactly
 * like login does) into the dashboard.
 */
import { api, hideError, showError } from './api.js';

const form = document.querySelector('[data-reset-form]');
const errorNode = document.querySelector('[data-error]');
const doneNode = document.querySelector('[data-done]');
const noTokenNode = document.querySelector('[data-no-token]');

const token = new URLSearchParams(window.location.search).get('token');

if (!token) {
  form.hidden = true;
  noTokenNode.hidden = false;
} else {
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
      const password = new FormData(form).get('password');
      await api.confirmPasswordReset(token, password);
      form.hidden = true;
      doneNode.hidden = false;
      window.setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1200);
    } catch (err) {
      showError(errorNode, err);
      busy(false);
    }
  });
}
