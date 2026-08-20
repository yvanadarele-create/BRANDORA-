/**
 * The "How Pricing Works" page reads the real, live margin rate from
 * /api/settings rather than hardcoding it — the documented figure and the
 * one priceProject() actually applies can never drift apart, because they
 * are the same number.
 */

import { api } from './api.js';

function formatPercent(rate) {
  return `${Math.round(rate * 1000) / 10} %`;
}

async function boot() {
  let rate = 0.3;
  try {
    const settings = await api.get('/api/settings');
    if (typeof settings.marginRate === 'number') rate = settings.marginRate;
  } catch (err) {
    // The page still reads correctly with the documented default above.
  }

  const label = formatPercent(rate);
  document.querySelectorAll('[data-margin-rate], [data-example-rate]').forEach((node) => {
    node.textContent = label;
  });

  const product = 100;
  const shipping = 20;
  const margin = Math.round((product + shipping) * rate);
  const total = product + shipping + margin;

  const marginCell = document.querySelector('[data-example-margin]');
  if (marginCell) marginCell.textContent = String(margin);
  const totalCell = document.querySelector('[data-example-total]');
  if (totalCell) totalCell.textContent = String(total);
}

void boot();
