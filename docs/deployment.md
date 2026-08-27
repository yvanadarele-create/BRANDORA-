# Deploying Brandora

## Read this first: why the build failed in one second

The deployment at `258d9f8` was **ERROR** after **1 second**. That duration is
the diagnosis: one second is not enough to clone, install and compile anything.
Vercel was rejecting `vercel.json` before it ran a single command.

Two bugs, fixed in `a3931d4`.

### 1. An invalid `functions.runtime` — this is what failed

Both `vercel.json` files carried:

```json
"functions": { "api/index.js": { "runtime": "nodejs22.x" } }
```

`functions[].runtime` selects a **custom** runtime and takes a `name@version`,
like `vercel-php@0.5.2`. `nodejs22.x` is a *Build Output API* value — it belongs
in a `.vc-config.json`, not in `vercel.json`. Vercel's config validation
rejects it up front, which is the one-second error.

The Node version is read from `engines.node`, which is now `22.x` — the form
Vercel documents — rather than the range `>=22`.

### 2. The schema was read off disk at runtime

Both drivers loaded the schema with
`readFileSync(resolve(here, "schema.sql"))`. That works anywhere a process can
see its own directory, and fails on Vercel: a serverless bundle is assembled by
statically tracing `import`/`require` from the entrypoint, and a path computed
at runtime from `import.meta.url` is invisible to that analysis. `schema.sql`
would not have been in the bundle.

The build would have gone green and the **first cold start** would have thrown
`ENOENT` from inside `migrate()` — a second failure, on a different error,
waiting behind the first.

`scripts/copy-schema.mjs` now compiles `schema.sql` into `schema.generated.ts`.
The schema travels as code and is reached by an ordinary import. `schema.sql`
is still the source of truth and still the file you edit.

### Also fixed

`apps/brandora/vercel.json` ran `pnpm run build:brandora`, a script that exists
in no `package.json` in this repository. It only applies when the project's
Root Directory is `apps/brandora`, so it was not the current failure — it was
the next one. Now `pnpm run build`.

### What was verified, and how

Not "it compiles". A clean tree, `pnpm install --frozen-lockfile`, the
configured build, then `dist/schema.sql` deleted to simulate what the bundler
would actually ship, then `api/index.js` invoked through a Node server the way
Vercel invokes it, against an empty PostgreSQL 16 database:

- 18 tables migrated from the generated schema
- `/api/health` and `/api/settings`
- signup, session cookie, login
- anonymous → 401 on a protected route; customer → 403 on an admin route
- a stranger gets **404, not 403**, on another account's order and project
- package → quote (parts sum to total, margin absent) → order at the same
  total → order tracking
- the process killed and restarted: the account logs back in and the order is
  still there — the only real proof the database is Postgres and not SQLite
- supplier created, offer recorded, `authorize` computing the total from the
  stored offer and refusing to auto-approve a new supplier
- a quality check opens with `inspectedAt` null; a shipment is created with no
  invented delivery date
- the webhook: 401 with no signature, 401 with a wrong one, 200 with a valid
  one — which also proves **the raw body survives the Vercel handler path**, so
  signature verification works in the deployed shape. A signed
  `charge.success` still does not mark an order paid.

474 tests pass against SQLite and PostgreSQL 16.

### Settings to check in the dashboard

- **Root Directory**: leave it empty (the repository root). That is the
  supported setting for this pnpm workspace — the build needs
  `pnpm-workspace.yaml` and every package under `packages/`. There is a
  `vercel.json` and an `api/index.js` under `apps/brandora` as well, so a
  project rooted there also builds, but it depends on *"Include source files
  outside of the Root Directory"* being enabled. Root is simpler.
- **Framework Preset**: Other. Do not let it auto-detect.
- **Node.js Version**: comes from `engines.node`; nothing to set.

### If it still errors

The one value left in `vercel.json` that depends on your plan is
`functions["api/index.js"].maxDuration: 60`. On a plan capped lower, Vercel
fails config validation in about a second with a message naming `maxDuration`.
If you see that, lower it to `10` — brand generation is the only route that
needs the headroom.

### Verifying it worked

```
curl https://brandoraunion.online/api/health     # {"status":"ok", …}
curl https://brandoraunion.online/api/settings   # {"currency":"XOF", …}
curl -I https://brandoraunion.online/            # 200, text/html
```

`/api/health` answering is the real signal: it means the function booted, which
means the secret and the database are both readable. A 200 on `/` alone only
proves the static files shipped.

The production domain is `brandoraunion.online` (moved from the earlier
`brandora-rho.vercel.app` Vercel subdomain). This environment's outbound
network policy denies both hosts — `curl` to either returns a 403 from the
egress proxy, not from the site — so the live deployment is **NOT VERIFIED
LIVE** from here. DNS for `brandoraunion.online` resolves to a Vercel edge IP,
which is consistent with the domain having been attached in the Vercel
dashboard, but that is an inference, not a verification: run the three curls
above from a machine with normal internet access to actually confirm it.

---

## Why the production domain returned 404

This repository contained a README and a logo. No `package.json`, no
`index.html`, no source. Vercel deployed `main`, the build "succeeded" because
there was nothing to build, and the result was an empty output — so `/` had
nothing to serve.

None of the usual suspects was the cause: not the root directory, not framework
detection, not the build command, not SPA rewrites, not the production alias.
Changing any of them would not have helped. The fix was to put the application
in the repository.

The application is now here.

---

## Running it locally

```bash
pnpm install
pnpm run build
export BRANDORA_AUTH_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
pnpm run dev            # site and /api/* on :4100
```

Without `BRANDORA_DATABASE_URL` it uses SQLite at `./data/brandora.db`, which is
right for local work and wrong for serverless — see below.

The server refuses to start without `BRANDORA_AUTH_SECRET`. That is deliberate:
a development fallback for a signing secret is a fallback that reaches
production, and a known signing secret lets anyone mint a session for any
account.

---

## Vercel

### 1. Provision Postgres — do this first

Brandora stores accounts, brands, quotes and orders in a database. A serverless
function's filesystem is discarded between invocations, so a file-backed
database there loses the account it created a moment earlier. **Without a
Postgres URL the deployment will appear to work and quietly forget everything.**

Any managed Postgres works. In Vercel: **Storage → Create Database → Postgres**,
which injects the variables for you. Otherwise Neon, Supabase, or anything else
that speaks Postgres.

**Use the provider's pooled endpoint, not the direct one.** Hundreds of function
instances against a direct endpoint exhaust `max_connections`, and the symptom
is `too many clients already` on a fraction of requests — which reads like a
random outage rather than a configuration mistake.

| Provider | The pooled host looks like |
| --- | --- |
| Neon | `…-pooler.region.aws.neon.tech` |
| Supabase | `aws-0-region.pooler.supabase.com:6543` |
| Vercel Postgres | the injected `POSTGRES_URL` is already pooled |

**On the database name.** Postgres folds unquoted identifiers to lower case, so
`CREATE DATABASE BRANDORA_db;` actually creates `brandora_db`, while
`CREATE DATABASE "BRANDORA_db";` creates `BRANDORA_db`. Both are valid, and they
are two different databases. Whichever you have, the name in
`BRANDORA_DATABASE_URL` must match it exactly — the failure is
`database "…" does not exist`, which is legible once you know to look for it and
baffling when you do not.

The schema is applied automatically on the first connection, so there is no
migration step you are *required* to run. When you want to do it deliberately —
before a first deploy, or to confirm the URL points at the database you think it
does — there is a command:

```bash
BRANDORA_DATABASE_URL='postgresql://…' pnpm run migrate
```

It prints every table with its row count, and it cannot destroy anything: every
statement is `CREATE … IF NOT EXISTS`, the schema contains no `DROP` or
`TRUNCATE`, and the script does not create databases — a script that quietly
conjures a second database when you have mistyped the name of the first is how
you end up with an empty one in production and your accounts somewhere nobody is
looking. `pnpm run migrate --dry-run` prints the statements without connecting.

### 2. Create the project

In the Vercel dashboard:

1. **Add New → Project**, import `yvanadarele-create/BRANDORA-`.
2. Leave **Framework Preset** as **Other**. The build and install commands come
   from `apps/brandora/vercel.json`; do not override them.
3. **Settings → General → Root Directory → Edit** → `apps/brandora` → **Save**.

The third step is the one that is easy to miss. Vercel reads one config per
project, and Brandora's lives in `apps/brandora/vercel.json`; without the root
directory set, Vercel never sees it.

### 3. Environment variables

**Settings → Environment Variables → Add New.** For each row: type the name,
paste the value, tick **Production**, **Preview** and **Development**, **Save**.

| Name | Value | Without it |
| --- | --- | --- |
| `BRANDORA_DATABASE_URL` | your **pooled** Postgres string | Data does not persist between invocations |
| `BRANDORA_AUTH_SECRET` | a fresh 32-byte base64 string | **The server refuses to start** |
| `BRANDORA_PUBLIC_BASE_URL` | `https://brandoraunion.online` | Payment returns land on the wrong host |
| `BRANDORA_ADMIN_EMAIL` | the address you signed up with | That account stays a regular customer — see step 5 below |
| `ANTHROPIC_API_KEY` | your key | Brand generation fails with a clear message. It does not invent a brand |
| `PAYSTACK_SECRET_KEY` | your key | Orders are placed and wait for an admin to confirm an arranged payment |
| `RESEND_API_KEY` | your key | **No email is ever sent — including password-reset.** `notify()` records the notification in the database but skips delivery silently; nothing errors, nothing logs to the customer |
| `BRANDORA_EMAIL_FROM` | a verified sender, e.g. `Brandora <no-reply@brandoraunion.online>` | Same silent no-op as above — both variables are required together, see `notificationsConfigured()` in `packages/brandora-config/src/index.ts` |
| `BRANDORA_CALENDLY_URL` | `https://calendly.com/yvanadarele/30min` | The "Book a call" controls hide themselves |
| `ALIEXPRESS_APP_KEY` | | No supplier call is made; the Brandora catalogue still serves |
| `ALIEXPRESS_APP_SECRET` | | " |
| `ALIEXPRESS_ACCESS_TOKEN` | | " |
| `ALIEXPRESS_REFRESH_TOKEN` | | " |

Generate the auth secret locally and paste it here and nowhere else:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. Deploy, then verify

**Deployments → ⋯ → Redeploy** — environment changes do not apply to an existing
build. Then check, in this order:

```bash
curl -i https://<your-domain>/            # 200, HTML with "Brandora" in it
curl -s https://<your-domain>/api/health  # {"status":"ok",…}
```

Then in a browser: sign up, answer the interview, generate a brand, and reload
the brand page. If the brand is still there, persistence is working. If you are
signed out or the brand is gone, `BRANDORA_DATABASE_URL` is not set.

### 5. Make the first administrator

There is still no *route* that grants a role — a public request can never
escalate one, by design. But the identity no longer depends on you (or a
CloudCode session) running SQL by hand after every fresh deploy:

1. **Sign up** at `/signup.html` with the email address that should be the
   administrator. This creates an ordinary customer account, with a password
   only you know.
2. **Set `BRANDORA_ADMIN_EMAIL`** in the deployment's environment variables to
   that same address.
3. **Redeploy** (or just restart the process). On boot, `bootstrapAdmin()`
   (`packages/brandora-server/src/admin-bootstrap.ts`) looks up that address
   and promotes it to `role = 'admin'` if it isn't already. It never creates
   the account and never touches the password — only `role` changes, and only
   toward `admin`, never away from it. It is safe to leave the variable set
   forever: every later boot on an already-promoted account is a silent
   no-op, and the identity survives any number of redeploys.

If you'd rather do it once, by hand, that still works:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Once signed in as that administrator, **/account.html** (linked as "My
account" in the header) is where the password and email address are changed
— `POST /api/auth/password` and `POST /api/auth/email`, both requiring the
current password, both server-side only. There is no other way to change
either, and nothing here is stored in the browser: a page refresh, a new
device or a redeploy all see the same account.

### 6. Manage the catalogue without touching code

Log in as that administrator and open **/admin-products** (linked from
**/admin**). From there you can add a product, upload its photos, and publish
or unpublish it — the public site reads `/api/catalog` live from the database
on every request, so a change appears immediately with no code edit, no
redeploy, and no CloudCode session required. See `docs/products.md` for the
full walkthrough.

If this is a fresh database, run the one-time import that carries the
existing, photograph-grounded catalogue across so the site is not empty on
day one:

```bash
BRANDORA_DATABASE_URL=… node scripts/import-catalog-seed.mjs
node scripts/import-catalog-seed.mjs --dry-run   # see what it would do first
```

It is safe to run more than once — a product already imported is updated by
its slug, never duplicated.

---

## Environment variables in full

### Required

| Variable | What it does |
| --- | --- |
| `BRANDORA_AUTH_SECRET` | Signs session cookies. The server will not start without it |

### Required on serverless

| Variable | What it does |
| --- | --- |
| `BRANDORA_DATABASE_URL` | Postgres connection string. Its presence selects Postgres |

### Needed for the product to be complete

| Variable | Unset behaviour |
| --- | --- |
| `ANTHROPIC_API_KEY` | Generation **fails with a clear message** rather than fabricating a brand |
| `PAYSTACK_SECRET_KEY` | Orders are placed at `pending`; an admin confirms an arranged transfer |
| `RESEND_API_KEY` + `BRANDORA_EMAIL_FROM` | All outbound email — including password-reset — is silently skipped. Both are required together |
| `BRANDORA_ADMIN_EMAIL` | No account is auto-promoted to admin. Sign up, then set this and redeploy — see "Make the first administrator" |
| `BRANDORA_CALENDLY_URL` | Booking controls hide themselves |
| `ALIEXPRESS_*` | The Brandora catalogue serves; no supplier call is made |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Product image uploads in `/admin-products` **fail with a clear message**; existing products and text fields are unaffected |

### Everything else has a working default

| Variable | Default |
| --- | --- |
| `BRANDORA_DATABASE_PATH` | `./data/brandora.db` (used only when no URL is set) |
| `BRANDORA_PUBLIC_BASE_URL` | `http://localhost:4100` |
| `BRANDORA_STATIC_ROOT` | `./apps/brandora` |
| `BRANDORA_DEFAULT_CURRENCY` | `XOF` — zero-decimal; see `money.ts` |
| `BRANDORA_MARGIN_RATE` | `0.30` (clamped to 0.25–0.35) |
| `BRANDORA_LOGISTICS_RATE` | `0.08` |
| `BRANDORA_DELIVERY_FLAT` | `3000` (minor units — whole francs for XOF) |
| `BRANDORA_DELIVERY_PER_KG` | `1200` |
| `BRANDORA_ROUNDING_STEP` | `100` (always rounds up) |
| `BRANDORA_SOURCING_SMALL_MAX` | `50` |
| `BRANDORA_SOURCING_MEDIUM_MAX` | `500` |
| `BRANDORA_SUPPLIER_CACHE_TTL_MINUTES` | `360` |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` |
| `ALIEXPRESS_ENDPOINT` | `https://api-sg.aliexpress.com/sync` |
| `PAYSTACK_ENDPOINT` | `https://api.paystack.co` |

Never put a value for a secret one in a file, a screenshot, a chat message or a
commit. If one has ever appeared in any of those, rotate it in the provider's
console before anything else.

---

## Running it as one process instead

Brandora is a single Node process that serves the site and the API from one
origin. That works unchanged on any host with a disk — a small VPS, Railway,
Render, Fly:

```bash
pnpm install && pnpm run build
BRANDORA_AUTH_SECRET=… BRANDORA_PUBLIC_BASE_URL=https://… pnpm run dev
```

Postgres is still the better choice, but SQLite is legitimate here because the
disk survives. Put a TLS terminator in front; the session cookie is marked
`Secure` automatically unless `BRANDORA_PUBLIC_BASE_URL` starts with `http://`.

---

## Before the first live supplier call

`signRequest` in `packages/brandora-sourcing/src/aliexpress.ts` implements
HMAC-SHA256 over the sorted `key + value` concatenation, uppercase hex, declared
as `sign_method=hmac-sha256`.

**This has not been verified against AliExpress's own documentation** — their
developer portal is unreachable from the environment this was written in. The
platform has shipped more than one scheme, and the wrong choice fails every
request with "invalid signature".

`signRequest` is exported and pure, so checking it costs one call against a
known-good signature from the AliExpress console. Until that is done, leave the
`ALIEXPRESS_*` variables unset — Brandora serves its own catalogue and makes no
supplier call.
