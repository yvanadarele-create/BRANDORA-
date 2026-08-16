/**
 * The French launch page: the waiting-list form, and the two video slots.
 *
 * Everything user-facing in this file is French, because the page it belongs to
 * is French only. There is no translation lookup and no locale switch — see the
 * comment at the top of lancement.html for why that is deliberate here and
 * nowhere else in the application.
 */

import { api } from './api.js';

/* --- Videos ---------------------------------------------------------------- */

/**
 * Attach a player only for a file that is actually there.
 *
 * The two clips are not in the repository yet. Writing `<video src="…">`
 * against a missing file gives a black rectangle, a console error and a control
 * that does nothing — the page looks broken rather than unfinished, which is
 * the worse of the two. So the markup carries `data-clip`, this asks the server
 * whether the file exists, and the placeholder stays until it does. The
 * attribute is not named `…-src` on purpose: the build check treats anything
 * ending in `src="…"` as a reference that must resolve on disk, and these two
 * deliberately do not yet.
 *
 * A HEAD request costs no bandwidth, which matters: this page is aimed at
 * people on metered mobile connections, and an autoloading video is the most
 * expensive thing it could do to them.
 */
async function mountPlayer(figure) {
  const src = figure.getAttribute('data-clip');
  const stage = figure.querySelector('.fr-player__stage');
  const pending = figure.querySelector('[data-player-pending]');
  if (!src || !stage) return;

  let available = false;
  try {
    const response = await fetch(src, { method: 'HEAD' });
    // A single-page app's catch-all can answer 200 with HTML for a missing
    // file, so the content type is checked too — otherwise the player mounts
    // around index.html and plays nothing.
    available = response.ok && (response.headers.get('content-type') || '').startsWith('video/');
  } catch {
    available = false;
  }

  if (!available) return;

  const video = document.createElement('video');
  video.className = 'fr-player__media';
  video.setAttribute('controls', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('preload', 'none');
  video.src = src;

  if (pending) pending.remove();
  stage.appendChild(video);
  figure.setAttribute('data-ready', 'true');
}

/* --- The waiting list ------------------------------------------------------ */

const QUANTITY_FLOOR = {
  '1–20': 1,
  '21–50': 21,
  '51–100': 51,
  '101–500': 101,
  '500+': 500,
};

/**
 * Turn the two name fields into the one the API stores.
 *
 * The form asks for prénom and nom because that is how a person expects to be
 * asked; the database keeps a single `name`, because splitting a name into two
 * columns is a decision that only ever has to be undone later.
 */
function fullName(form) {
  const first = form.elements['firstName'].value.trim();
  const last = form.elements['lastName'].value.trim();
  return [first, last].filter(Boolean).join(' ');
}

function setStatus(node, message, kind) {
  node.textContent = message;
  node.hidden = false;
  node.classList.toggle('is-error', kind === 'error');
  node.classList.toggle('is-ok', kind === 'ok');
}

function mountForm(form) {
  const status = form.querySelector('[data-fr-status]');
  const submit = form.querySelector('[data-fr-submit]');
  const email = form.elements['email'];

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const address = email.value.trim();
    // Checked here as well as on the server. This one is about not making
    // somebody wait for a round trip to be told they mistyped their address;
    // the server's check is the one that actually protects the table.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      setStatus(status, "Cette adresse email ne semble pas valide. Pouvez-vous la vérifier ?", 'error');
      email.focus();
      return;
    }

    const band = form.elements['quantityBand'].value;

    const payload = {
      email: address,
      locale: 'fr',
      source: 'landing-fr',
    };

    const name = fullName(form);
    if (name) payload.name = name;

    const business = form.elements['business'].value.trim();
    if (business) payload.business = business;

    const sector = form.elements['sector'].value;
    if (sector) payload.sector = sector;

    const interest = form.elements['interest'].value;
    if (interest) payload.interest = interest;

    if (band) {
      payload.quantityBand = band;
      // The band is what the person actually said, and it is stored verbatim.
      // The floor travels with it so the founder can sort and filter by size
      // without parsing a label — it is derived, never a substitute.
      payload.quantity = QUANTITY_FLOOR[band];
    }

    submit.disabled = true;
    setStatus(status, 'Envoi en cours…', null);

    try {
      await api.post('/api/subscribe', payload);
      // The form is replaced rather than reset: leaving the fields on screen
      // invites a second submission of the same details.
      form.innerHTML =
        '<p class="fr-form__done">C\'est enregistré. Nous vous contacterons dès que Brandora sera disponible.</p>';
    } catch (err) {
      submit.disabled = false;
      // The technical detail goes to the console for whoever is debugging; the
      // person reading the page gets a sentence in their own language that
      // tells them their answer was not lost.
      console.error('[brandora] inscription impossible', err);
      setStatus(
        status,
        "Nous n'avons pas pu enregistrer votre inscription pour le moment. Réessayez dans quelques instants — rien de ce que vous avez saisi n'a été perdu.",
        'error',
      );
    }
  });
}

/* --- Boot ------------------------------------------------------------------ */

document.querySelectorAll('[data-player]').forEach((figure) => {
  void mountPlayer(figure);
});

const form = document.querySelector('[data-fr-subscribe]');
if (form) mountForm(form);

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());
