/**
 * The sourcing screen.
 *
 * The rule here is the same one that governs the assistant, pushed one step
 * further: **nothing on this page is written by a model.** The server calls a
 * model exactly once, to turn the operator's sentence into fields, and every
 * figure rendered below comes from a recorded supplier offer.
 *
 * So there is no code in this file that reads a number out of prose, and the
 * one string the server composes — the recommendation sentence — is built from
 * the same figures shown beside it.
 *
 * The other thing this file is careful about is the cheapest row. It is always
 * rendered, always labelled, and when it is not the recommended row the reason
 * is shown as a warning rather than a footnote — because that is the moment an
 * operator overrules the ranking on price alone, which is exactly what the
 * ranking exists to argue with.
 */

import { ApiError, api, clear, el, hideError, mountAccountNav, price, showError } from './api.js';

const node = {
  form: document.querySelector('[data-source-form]'),
  input: document.querySelector('#brief'),
  submit: document.querySelector('[data-submit]'),
  error: document.querySelector('[data-error]'),
  adminOnly: document.querySelector('[data-admin-only]'),
  report: document.querySelector('[data-report]'),
  understood: document.querySelector('[data-understood]'),
  missing: document.querySelector('[data-missing]'),
  optionsPanel: document.querySelector('[data-options-panel]'),
  options: document.querySelector('[data-options]'),
  considered: document.querySelector('[data-considered]'),
  recommendationPanel: document.querySelector('[data-recommendation-panel]'),
  recommendation: document.querySelector('[data-recommendation]'),
  costOfRecommendation: document.querySelector('[data-cost-of-recommendation]'),
  notes: document.querySelector('[data-notes]'),
  nextStep: document.querySelector('[data-next-step]'),
  emptyPanel: document.querySelector('[data-empty-panel]'),
  emptyReason: document.querySelector('[data-empty-reason]'),
};

let sourcing = false;

/* --- What the agent understood ---------------------------------------------- */

/**
 * The fields the agent read, and only those.
 *
 * A field the customer did not give is absent from the response and absent
 * here — not shown as "any" or "—", which would read as a decision somebody
 * made rather than a question nobody asked.
 */
const UNDERSTOOD_LABELS = {
  productType: 'Product',
  category: 'Category',
  material: 'Material',
  colour: 'Colour',
  finish: 'Finish',
  capacityMl: 'Capacity',
  quantity: 'Quantity',
  destinationCountry: 'Ships to',
  destinationCity: 'City',
  requiredBy: 'Required by',
  maxProductionDays: 'Max production days',
  customization: 'Branding',
  certifications: 'Certifications',
  notes: 'Notes',
};

function renderUnderstood(understood) {
  clear(node.understood);

  for (const [key, label] of Object.entries(UNDERSTOOD_LABELS)) {
    const value = understood[key];
    if (value === undefined || value === null || value === '') continue;
    const text = Array.isArray(value)
      ? value.join(', ')
      : key === 'capacityMl'
        ? `${value} ml`
        : String(value);
    node.understood.appendChild(el('dt', { text: label }));
    node.understood.appendChild(el('dd', { text }));
  }

  for (const [key, label] of [['targetUnitPrice', 'Target unit price'], ['maxBudget', 'Budget']]) {
    if (!understood[key]) continue;
    node.understood.appendChild(el('dt', { text: label }));
    node.understood.appendChild(el('dd', { text: price(understood[key]) }));
  }
}

/* --- One supplier option ---------------------------------------------------- */

const MATCH_LABEL = {
  exact: 'Exact match',
  close: 'Close match',
  partial: 'Partial match',
  unsuitable: 'Unsuitable',
};

/**
 * The score, in parts.
 *
 * Shown rather than summarised because a score nobody can take apart is a
 * score nobody can argue with — and the weights are public precisely so an
 * operator can see that price is 25 of 100.
 */
function scoreBar(breakdown) {
  const parts = [
    ['Match', breakdown.match, 25],
    ['Quality', breakdown.quality, 20],
    ['Reliability', breakdown.reliability, 20],
    ['Price', breakdown.price, 25],
    ['Speed', breakdown.speed, 10],
  ];

  return el(
    'ul',
    { class: 'score' },
    parts.map(([label, value, max]) =>
      el('li', { class: 'score__part' }, [
        el('span', { class: 'score__label', text: label }),
        el('span', {
          class: 'score__meter',
          style: `--fill:${max === 0 ? 0 : Math.round((value / max) * 100)}%`,
          'aria-hidden': 'true',
        }),
        el('span', { class: 'score__value', text: `${Math.round(value)}/${max}` }),
      ]),
    ),
  );
}

function optionCard(option) {
  const badges = [];
  if (option.recommended) badges.push(el('span', { class: 'badge badge--strong', text: 'Recommended' }));
  if (option.cheapest) badges.push(el('span', { class: 'badge', text: 'Cheapest' }));
  badges.push(
    el('span', {
      class: `badge badge--${option.match.level}`,
      text: MATCH_LABEL[option.match.level] ?? option.match.level,
    }),
  );
  if (option.risk.level !== 'low') {
    badges.push(el('span', { class: 'badge badge--warn', text: `${option.risk.level} risk` }));
  }

  const children = [
    el('div', { class: 'option__head' }, [
      el('h3', { class: 'option__name', text: option.supplierName }),
      el('div', { class: 'option__badges' }, badges),
    ]),

    el('p', { class: 'option__where', text: [option.platform, option.country].filter(Boolean).join(' · ') }),

    el('dl', { class: 'spec spec--tight' }, [
      el('dt', { text: 'Landed per unit' }),
      el('dd', { class: 'option__price', text: price(option.landedPerUnit) }),
      el('dt', { text: 'Landed total' }),
      el('dd', { text: price(option.landedTotal) }),
      el('dt', { text: 'Supplier unit cost' }),
      el('dd', { text: price(option.unitCost) }),
      el('dt', { text: 'Production' }),
      // Only a number a supplier gave. Never a guess from a lead time.
      el('dd', { text: option.productionDays === null ? 'not quoted' : `${option.productionDays} days` }),
      el('dt', { text: 'Minimum order' }),
      el('dd', { text: String(option.minimumOrder) }),
      el('dt', { text: 'Price last checked' }),
      el('dd', { text: new Date(option.priceLastCheckedAt).toLocaleDateString() }),
    ]),
  ];

  // Costs that could not be calculated, named. A total with a hole in it is
  // labelled as one rather than presented as final.
  if (option.unknowns.length > 0) {
    children.push(
      el('p', { class: 'notice notice--warn option__unknowns' }, [
        el('strong', { text: 'Incomplete: ' }),
        // Each unknown already carries its own reason, so it is listed as it
        // comes. Appending "not recorded" produced sentences like "the
        // destination's rate is not configured not recorded".
        el('span', { text: `${option.unknowns.join('; ')}. This total is not final.` }),
      ]),
    );
  }

  if (option.match.missed.length > 0) {
    children.push(
      el('p', { class: 'option__missed' }, [
        el('strong', { text: 'Does not meet: ' }),
        el('span', { text: option.match.missed.join(', ') }),
      ]),
    );
  }

  if (option.risk.signals.length > 0) {
    children.push(
      el(
        'ul',
        { class: 'signals' },
        // Each one is a thing that happened, with its detail, so it can be
        // checked rather than taken on faith.
        option.risk.signals.map((signal) =>
          el('li', { class: 'signals__item' }, [
            el('span', { class: 'signals__code', text: signal.code }),
            el('span', { text: signal.detail }),
          ]),
        ),
      ),
    );
  }

  children.push(scoreBar(option.score.breakdown));

  if (option.score.reasons.length > 0) {
    children.push(el('p', { class: 'option__why', text: option.score.reasons.join('; ') }));
  }
  if (option.score.concerns.length > 0) {
    children.push(
      el('p', { class: 'option__concerns' }, [
        el('strong', { text: 'Concerns: ' }),
        el('span', { text: option.score.concerns.join('; ') }),
      ]),
    );
  }

  return el('article', { class: `option${option.recommended ? ' option--recommended' : ''}` }, children);
}

/* --- The report ------------------------------------------------------------- */

function render(report) {
  node.report.hidden = false;
  renderUnderstood(report.understood);

  if (report.missing.length > 0) {
    node.missing.hidden = false;
    node.missing.textContent = `Ask the customer: ${report.missing.join(', ')}.`;
  } else {
    node.missing.hidden = true;
  }

  const hasOptions = report.options.length > 0;

  node.optionsPanel.hidden = !hasOptions;
  node.recommendationPanel.hidden = !hasOptions;
  node.emptyPanel.hidden = hasOptions || report.missing.length > 0;

  if (!hasOptions) {
    node.emptyReason.textContent = report.nextStep;
    return;
  }

  node.considered.textContent =
    report.considered > report.options.length
      ? `${report.options.length} of ${report.considered} considered`
      : `${report.options.length} considered`;

  clear(node.options);
  for (const option of report.options) node.options.appendChild(optionCard(option));

  node.recommendation.textContent = report.recommendation ?? '';

  if (report.costOfRecommendation) {
    node.costOfRecommendation.hidden = false;
    node.costOfRecommendation.textContent = report.costOfRecommendation;
  } else {
    node.costOfRecommendation.hidden = true;
  }

  clear(node.notes);
  node.notes.hidden = report.notes.length === 0;
  for (const note of report.notes) node.notes.appendChild(el('li', { text: note }));

  node.nextStep.textContent = report.nextStep;
}

/* --- Wiring ----------------------------------------------------------------- */

async function source(brief) {
  if (sourcing) return;
  sourcing = true;
  node.submit.disabled = true;
  node.submit.textContent = 'Sourcing…';
  hideError(node.error);

  try {
    const { report } = await api.post('/api/admin/procurement/source', { brief });
    render(report);
  } catch (err) {
    // An operator who cannot use the tool is told which of the two reasons it
    // is, because "something went wrong" sends them to the wrong person.
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      node.adminOnly.hidden = false;
      node.report.hidden = true;
    } else {
      showError(node.error, err);
    }
  } finally {
    sourcing = false;
    node.submit.disabled = false;
    node.submit.textContent = 'Source';
  }
}

node.form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const brief = node.input.value.trim();
  if (brief !== '') void source(brief);
});

void (async () => {
  const user = await mountAccountNav();
  // Said before the operator types a paragraph, not after.
  if (!user || user.role !== 'admin') node.adminOnly.hidden = false;
})();
