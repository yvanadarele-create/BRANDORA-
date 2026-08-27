/**
 * Account settings: change password, change email.
 *
 * Available to any signed-in account, not only admins — the backend routes
 * this calls (`POST /api/auth/password`, `POST /api/auth/email`) are gated by
 * `requireUser`, not `requireAdmin`. That is deliberate: today the one
 * account that matters is the administrator, but the spec this page answers
 * asks for a `role` model that will eventually include manufacturer and
 * customer accounts too, and none of them should need a different page for
 * this.
 */

import { api, mountAccountNav, showError, hideError } from './api.js';

const node = {
  signedOut: document.querySelector('[data-signed-out-only]'),
  panel: document.querySelector('[data-account-panel]'),
  name: document.querySelector('[data-account-name]'),
  email: document.querySelector('[data-account-email]'),
  role: document.querySelector('[data-account-role]'),

  passwordForm: document.querySelector('[data-password-form]'),
  passwordSubmit: document.querySelector('[data-password-submit]'),
  passwordError: document.querySelector('[data-password-error]'),
  passwordSuccess: document.querySelector('[data-password-success]'),

  emailForm: document.querySelector('[data-email-form]'),
  emailSubmit: document.querySelector('[data-email-submit]'),
  emailError: document.querySelector('[data-email-error]'),
  emailSuccess: document.querySelector('[data-email-success]'),
};

function renderUser(user) {
  if (node.name) node.name.textContent = user.name;
  if (node.email) node.email.textContent = user.email;
  if (node.role) node.role.textContent = user.role;
}

async function boot() {
  const user = await mountAccountNav();

  if (!user) {
    if (node.signedOut) node.signedOut.hidden = false;
    if (node.panel) node.panel.hidden = true;
    return;
  }

  if (node.signedOut) node.signedOut.hidden = true;
  if (node.panel) node.panel.hidden = false;
  renderUser(user);
}

node.passwordForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError(node.passwordError);
  if (node.passwordSuccess) node.passwordSuccess.hidden = true;

  const form = node.passwordForm;
  const currentPassword = form.currentPassword.value;
  const newPassword = form.newPassword.value;
  const confirmPassword = form.confirmPassword.value;

  if (newPassword !== confirmPassword) {
    if (node.passwordError) {
      node.passwordError.textContent =
        (window.brandoraTranslate && window.brandoraTranslate('account.password.mismatch')) ||
        'The new password and its confirmation do not match.';
      node.passwordError.hidden = false;
    }
    return;
  }

  node.passwordSubmit.disabled = true;
  try {
    await api.changePassword(currentPassword, newPassword);
    form.reset();
    if (node.passwordSuccess) node.passwordSuccess.hidden = false;
  } catch (err) {
    showError(node.passwordError, err);
  } finally {
    node.passwordSubmit.disabled = false;
  }
});

node.emailForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError(node.emailError);
  if (node.emailSuccess) node.emailSuccess.hidden = true;

  const form = node.emailForm;
  const currentPassword = form.currentPassword.value;
  const newEmail = form.newEmail.value;

  node.emailSubmit.disabled = true;
  try {
    const { user } = await api.changeEmail(currentPassword, newEmail);
    form.reset();
    if (node.emailSuccess) node.emailSuccess.hidden = false;
    if (user) renderUser(user);
  } catch (err) {
    showError(node.emailError, err);
  } finally {
    node.emailSubmit.disabled = false;
  }
});

boot();
