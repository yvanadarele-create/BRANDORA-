# Feature status

An honest account of what is built, what is partial and what is not started.
Nothing is listed as working because its interface exists — a feature counts as
working only when the front end, the API, the data and the error handling all
do.

Evidence is a file you can open or a test you can run. `pnpm test` runs
everything; `BRANDORA_TEST_DATABASE_URL=… pnpm test` also runs the Postgres
half.

**387 tests pass.** The full customer journey has been driven in Chromium at
1440×900 and 390×844, against Postgres, on the real server.

---

## Working

| Feature | Evidence | Notes |
| --- | --- | --- |
| **Authentication** | `routes.ts` `/api/auth/*`, `brandora-auth.test.ts`, `brandora-api.test.ts` | scrypt, per-password salt, timing-safe compare. Server-side sessions in an HttpOnly cookie, revocable. A wrong password and an unknown address give byte-identical responses |
| **Session persistence** | `session.ts`, browser walkthrough step 2 | Survives a reload and a server restart — verified by logging in from a fresh browser after killing the process |
| **Protected routes** | `requireUser`, `requireAdmin`; `brandora-server-security.test.ts` | A scan fails the build if any `/api/admin` route stops calling `requireAdmin` |
| **Brand onboarding** | `brand-engine/interview.ts`, `apps/brandora/create.html` | Seven questions, one at a time. Every one has an "I don't know — help me" path that asks something easier rather than defining the jargon |
| **Brand Profile** | `brand_strategies` + `brand_identities`; `loadProjectBundle`, `toBrandProfile` | Persisted per project, per owner. Business, audience, positioning, personality, colours, typography, logo brief, guidelines |
| **Brand identity generation** | `/api/projects/:id/generate`, `brandora-ai.test.ts` | Name, positioning, description, slogan, promise, mission, vision, tone, story from the model; palette and typography derived deterministically and contrast-checked |
| **Brand Memory** | `brand.js`, `catalog.js`, `package.js` all read the stored profile | Recommendations rank against the stored positioning, personality and industry; the brand book paints itself in the stored palette and typeface |
| **Brand book / visualizer** | `apps/brandora/brand.html`, `brand.js` | Cover, essence, colour with rationale, type specimen, voice, mark, six applications. **Zero placeholder brand data in the file** — with no data it says so |
| **Multilingual** | `packages/brandora-i18n`, `brandora-i18n.test.ts` | English, French, Spanish. A missing key is a compile error, not an English word in a French checkout. Switching does not reload or lose state |
| **Product catalogue** | `/api/catalog`, `packages/brandora-catalog` | 20 normalised Brandora products. Quantity, category, search and customisation filters |
| **Product normalisation** | `brandora-shared/types.ts`, `sourcing/aliexpress.ts` | Customers see Brandora products, never a raw marketplace response |
| **Customisation verification** | `productView` in `routes.ts`, §36 tests | Four confidence levels. "Confirmed: carries your logo" only where the catalogue confirms it; everything else says it is unconfirmed, and an unconfirmed method cannot be added to a package or charged for |
| **Quantity filter (§35)** | `filterProducts`, catalogue `nearMisses` | A product that cannot be ordered at the stated quantity is demoted under its own heading, not deleted |
| **Product matching** | `recommendProducts` in `pricing.ts` | Weighs subcategory, positioning, confirmed customisation, orderability at the quantity, and featured status. Every recommendation carries a reason in words a founder can read. Not ranked by cheapest |
| **Package builder** | `/api/projects/:id/package/*` | Add, change quantity, remove, clear. A quantity below the minimum is raised and *said*, not silently charged |
| **Quote engine** | `/api/projects/:id/quote`, `pricing.ts` | Products, customisation, delivery, handling, service, margin. Human-readable reference, expiry date. Parts always sum to the total |
| **Server-authoritative pricing** | `pricing.ts`, `brandora-server-security.test.ts` | No function accepts a price. A source scan fails the build if any route reads an amount from a request body |
| **Checkout** | `/api/quotes/:id/checkout` | The charge is the stored quote total; the request carries no amount because there is nowhere to put one |
| **Payments** | `payments.ts` | Paystack, env-based. Verification refuses when the provider reports a different amount and marks the payment `mismatch`. Unconfigured, orders are placed and wait for an arranged transfer — no fake success |
| **Human verification (§17)** | `fulfilment.ts`, six tests | A paid order stops at `awaiting-approval`. Only a named administrator releases it, one legal step at a time, and the release is recorded against their id |
| **Order management** | `/api/orders/*`, `orders` + `order_events` | Nine states. Customer and admin read the same row |
| **Order tracking** | `order.html`, `order_events` | Status, an append-only history, totals, payment attempts. Tracking number and carrier shown only when set — never fabricated |
| **Customer dashboard** | `/api/dashboard`, `dashboard.html` | Brands, quotes, orders, and a "resume" that lands on the right step |
| **Admin dashboard** | `/api/admin/*`, `admin.html` | Counts, paid revenue, customers, brands, quotes with margin, orders with fulfilment control, integrations |
| **Margin protection (§39)** | Tests assert absence | Margin appears on exactly one route, behind `requireAdmin`. A test greps every customer-facing response for it |
| **IDOR protection** | Ownership in the `WHERE` clause | Another customer's project is *not found*. A cross-user read returns 404, not 403, so an id cannot be confirmed by probing |
| **Calendly** | `mountBooking` in `api.js`, `/api/settings` | One `BRANDORA_CALENDLY_URL`. Unset, the controls hide rather than falling back somewhere that is not a booking page. Verified against the account's real event on desktop and mobile |
| **Persistence on serverless** | `postgres.ts`, `brandora-postgres.test.ts` | Postgres in production, SQLite in tests, the same assertions run against both. A customer's brand and paid order survive a process restart |
| **Error handling** | `errors.ts`, `handle()` | One conversion point. A customer gets a sentence they can act on; the supplier's code goes to the admin log. No stack trace, no internal path, no blank screen |
| **Homepage film** | `index.html`, `app.js` | Full-bleed above the hero. Not downloaded at all on Data Saver, 2G or reduced-motion — 8.5MB matters on metered mobile data. Falls back to the poster and restores the lockup if the codec is unavailable |

## Partial

| Feature | What works | What does not |
| --- | --- | --- |
| **AliExpress integration** | The adapter, normalisation, scoring, freight, landed cost, caching and the credential handling are built and tested against recorded payloads | **No live call has been made.** The signing scheme is written from the platform's published algorithm but has not been verified against AliExpress's own documentation — the developer portal is unreachable from the environment this was built in. Check `signRequest` against a known-good signature from the console first |
| **Analytics** | Every event worth counting is already a row: signups, projects, generations, quotes, orders, payments, order events | No aggregation, no dashboard beyond the admin counts, no funnel view |
| **Notifications** | The order history records every event, and the customer sees it on the order page | Nothing is *sent*. No email, no WhatsApp, no push |
| **Product visualiser** | The brand book applies the approved palette and letterforms to six product silhouettes, drawn in CSS | Not photographic mock-ups. A photograph of a cup nobody has printed is a picture of a promise; these are honestly the brand applied to shapes |

## Not implemented

| Feature | Why it is listed |
| --- | --- |
| **Ask Brandora AI assistant** | The brief's "intelligent layer connecting the platform". The Brand Profile, the catalogue and the matching engine it would draw on are all built and queryable; the conversational surface over them is not. This is the largest remaining gap |
| **Logo image generation** | The logo *brief* is generated and written to be handed to a designer or an image model. The brand book shows the monogram in the brand's own typeface and colours and says that is what it is. Nothing calls an image model |
| **Brand-kit download as a zip** | The guidelines document is generated and downloadable as Markdown. The manifest lists what a full kit would contain; no archive is produced |
| **Paystack webhook route** | `paystackSignatureValid` is implemented and tested; nothing mounts it as an endpoint. Payment is confirmed by the customer's return to the order page, which verifies server-side — a webhook would make that robust against a customer who closes the tab |
| **Supplier management (admin)** | The `suppliers` concept exists in the domain types and the sourcing engine. There are no admin screens or routes for it |
| **Product management (admin)** | Products come from the seeded catalogue. There is no route to edit metadata, disable a product or trigger re-verification |
| **Quality checks as records** | `quality-check` is a fulfilment state an administrator moves an order through. There is no `QualityCheck` entity with findings attached |
| **Shipments as records** | Tracking number and carrier are columns on the order. There is no `Shipment` entity, and no carrier integration |
| **Conversations / AIRecommendation entities** | Listed in the brief's data model. Not needed until the assistant exists |

---

## What would make this production-complete

In the order I would do it:

1. **Ask Brandora.** Everything it needs to answer from is already queryable.
2. **Notifications.** The events exist; they need a channel. Email first.
3. **Verify the AliExpress signature** against the console, then make one live call behind a flag.
4. **The Paystack webhook**, so a closed tab cannot lose a payment.
5. **Supplier and product admin**, once there is more than one supplier to manage.
