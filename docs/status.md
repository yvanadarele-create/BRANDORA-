# Feature status

An honest account of what is built, what is partial and what is not started.
Nothing is listed as working because its interface exists — a feature counts as
working only when the front end, the API, the data and the error handling all
do.

Evidence is a file you can open or a test you can run. `pnpm test` runs
everything; `BRANDORA_TEST_DATABASE_URL=… pnpm test` also runs the Postgres
half.

**474 tests pass** — 445 on SQLite plus 29 more when `BRANDORA_TEST_DATABASE_URL`
is set, so the same assertions run against PostgreSQL 16. The customer journey
and the sourcing screen have both been driven in Chromium at 1440×900 and
390×844, on the real server, with zero console errors and zero horizontal
overflow.

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
| **Ask Brandora** | `assistant.ts`, `assistant.html`, 17 tests | Answers from the stored Brand Profile and the real catalogue. The model writes the sentences; **the catalogue writes the numbers** — product cards are rendered from our data, so a wrong figure in its prose cannot become a wrong price on screen. An id it invents is dropped and logged |
| **Paystack webhook** | `/api/webhooks/paystack`, `brandora-webhook.test.ts`, 14 tests | The signature is checked against the raw bytes in constant time, and a missing signature and a wrong one give byte-identical replies. Then the payload is used only for its reference: whether the charge succeeded, and for how much, comes from calling Paystack back. A perfectly signed body claiming success against a provider that disagrees leaves the order unpaid — there is a test named after that. Idempotent, and everything past the signature answers 200 so a retry loop cannot form. With no secret set the endpoint is a 404 |
| **Notifications** | `notifications.ts`, `notifications` table | Sent over Resend, env-based. The record is written first and unconditionally; the attempt is written back. A row is `sent` only because a provider accepted it — `UnconfiguredTransport` refuses rather than quietly succeeding, so an unconnected deployment shows a queue rather than a lie. Retries, then abandons. A failed send never fails the request that caused it |
| **Suppliers** | `/api/admin/suppliers/*`, `suppliers.html` | Contacts, categories, capabilities, and four recorded counts — completed, late, defects, disputes. Counts, never a rating: a stored score cannot be recomputed when the weighting changes or defended when a supplier disputes it. A new supplier is `unverified`, and verifying one is a separate recorded act that cannot un-block a blocked supplier |
| **Supplier offers** | `supplier_offers`, `/api/admin/suppliers/:id/offers` | One row per price break. A break at 500 is not a price at 30, and an offer whose own minimum the quantity does not meet is not returned at all |
| **Procurement agent** | `agent.ts`, `procurement.ts`, `procurement.html`, 24 tests | Brief in, shortlist out. The model is called once, with a prompt that opens "You are a parser", to turn a sentence into fields — it never sees a supplier and never produces a number that reaches the page. Candidates come from the database, so no suppliers means the report says so. **The best supplier is not the cheapest supplier**: price is 25 of 100, the weights are published, and when the recommendation is not the cheapest row the report says by how much and on what it won. A cheaper figure that is missing a cost the recommendation has is flagged as not a real saving |
| **Order authorisation (§10)** | `authorizeOrder`, `/api/admin/procurement/authorize` | Takes a supplier, a product and a quantity — never an amount. The total is computed from the recorded offer by the same function the shortlist uses. High risk, an unconfirmed price, or a new supplier with no approved sample all go to a person whatever the figure. `BRANDORA_AUTO_APPROVAL_LIMIT` defaults to zero: an unconfigured deployment escalates too often rather than spending too much |
| **Quality checks** | `quality_checks`, `/api/admin/orders/:id/quality-checks` | Sample, production and pre-shipment, with defects and evidence. A check opens with `inspected_at` null — an opened check is not a carried-out check, and only one of those survives a dispute |
| **Shipments** | `shipments`, `/api/admin/orders/:id/shipments` | Carrier, tracking number and status. `estimated_delivery` is only ever set from a carrier: null means not quoted, never soon |
| **Homepage film** | `index.html`, `app.js` | Full-bleed above the hero. Not downloaded at all on Data Saver, 2G or reduced-motion — 8.5MB matters on metered mobile data. Falls back to the poster and restores the lockup if the codec is unavailable |

## Partial

| Feature | What works | What does not |
| --- | --- | --- |
| **AliExpress integration** | The adapter, normalisation, scoring, freight, landed cost, caching and the credential handling are built and tested against recorded payloads | **No live call has been made.** The signing scheme is written from the platform's published algorithm but has not been verified against AliExpress's own documentation — the developer portal is unreachable from the environment this was built in. Check `signRequest` against a known-good signature from the console first |
| **Analytics** | Every event worth counting is already a row: signups, projects, generations, quotes, orders, payments, order events | No aggregation, no dashboard beyond the admin counts, no funnel view |
| **Notification channels** | Email works end to end over Resend | SMS, WhatsApp and in-app are columns the schema allows and nothing delivers. `deliverOne` fails those rows explicitly rather than reporting a silent success |
| **Product visualiser** | The brand book applies the approved palette and letterforms to six product silhouettes, drawn in CSS | Not photographic mock-ups. A photograph of a cup nobody has printed is a picture of a promise; these are honestly the brand applied to shapes |

## Not implemented

| Feature | Why it is listed |
| --- | --- |
| **Logo image generation** | The logo *brief* is generated and written to be handed to a designer or an image model. The brand book shows the monogram in the brand's own typeface and colours and says that is what it is. Nothing calls an image model |
| **Brand-kit download as a zip** | The guidelines document is generated and downloadable as Markdown. The manifest lists what a full kit would contain; no archive is produced |
| **Product management (admin)** | Products come from the seeded catalogue. Supplier *offers* against a product can now be recorded and deleted, but there is no route to edit a product's own metadata, disable it or trigger re-verification |
| **Logo image generation** | See above — the brief is generated, no image model is called |
| **Carrier integration** | Shipments are records now, and tracking is stored and shown. Nothing polls a carrier: a status changes because a person changed it |
| **Conversations / AIRecommendation entities** | Listed in the brief's data model. The assistant and the agent both work without them |

---

## What would make this production-complete

In the order I would do it:

1. **Deploy it.** The application is on `main` and builds; production is still
   serving an older commit. See `docs/deployment.md`.
2. **Add the environment variables** below, in Vercel, and nowhere else.
3. **Verify the AliExpress signature** against the console, then make one live
   call behind a flag.
4. **Record real suppliers.** The agent is built and tested; with an empty
   `suppliers` table it correctly reports that it has nothing to shortlist,
   which is honest and not yet useful.
5. **Product admin**, so a product can be disabled without a deploy.

## Environment variables

Every one is read from the environment and none appears in source, tests,
fixtures or the front end. Set them in Vercel.

| Variable | What breaks without it |
| --- | --- |
| `BRANDORA_DATABASE_URL` | Postgres. Without it the server falls back to SQLite, which does not persist on serverless |
| `BRANDORA_AUTH_SECRET` | The server refuses to boot. Deliberate |
| `ANTHROPIC_API_KEY` | Brand generation and the sourcing agent's parsing step |
| `PAYSTACK_SECRET_KEY` | Checkout, and webhook verification |
| `PAYSTACK_WEBHOOK_SECRET` | Optional. Only if you rotate it separately from the secret key |
| `RESEND_API_KEY` + `BRANDORA_EMAIL_FROM` | Email delivery. Both, or neither — a key with no From address is a 422 on every send |
| `BRANDORA_AUTO_APPROVAL_LIMIT` | Nothing breaks; every order goes to a person, which is the safe default |
| `BRANDORA_CALENDLY_URL` | The booking controls hide themselves |
