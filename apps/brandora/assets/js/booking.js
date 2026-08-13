/**
 * Loaded on every page: wires the header's "Book a call" to the one Calendly
 * event, and hides it when no event is configured.
 *
 * Separate from `app.js` because that file is a classic script and this needs
 * the module that talks to the API. One extra request, cached after the first
 * page.
 */

import { mountBooking } from './api.js';

void mountBooking();
