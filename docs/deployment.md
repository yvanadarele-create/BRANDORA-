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
curl https://brandora-rho.vercel.app/api/health     # {"status":"ok", …}
curl https://brandora-rho.vercel.app/api/settings   # {"currency":"XOF", …}
curl -I https://brandora-rho.vercel.app/            # 200, text/html
```

`/api/health` answering is the real signal: it means the function booted, which
means the secret and the database are both readable. A 200 on `/` alone only
proves the static files shipped.

`*.vercel.app` is unreachable from the environment this was built in, so the
production deployment itself is **NOT VERIFIED LIVE**.

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

The schema is applied automatically on the first connection. There is no
migration step to run.

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
| `BRANDORA_PUBLIC_BASE_URL` | `https://<your-domain>` | Payment returns land on the wrong host |
| `ANTHROPIC_API_KEY` | your key | Brand generation fails with a clear message. It does not invent a brand |
| `PAYSTACK_SECRET_KEY` | your key | Orders are placed and wait for an admin to confirm an arranged payment |
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

There is no route that grants a role — by design, so no request can escalate
one. Promote yourself directly against the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

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
| `BRANDORA_CALENDLY_URL` | Booking controls hide themselves |
| `ALIEXPRESS_*` | The Brandora catalogue serves; no supplier call is made |

### Everything else has a working default

| Variable | Default |
| --- | --- |
| `BRANDORA_DATABASE_PATH` | `./data/brandora.db` (used only when no URL is set) |
| `BRANDORA_PUBLIC_BASE_URL` | `http://localhost:4100` |
| `BRANDORA_STATIC_ROOT` | `./apps/brandora` |
| `BRANDORA_DEFAULT_CURRENCY` | `XOF` — zero-decimal; see `money.ts` |
| `BRANDORA_MARGIN_RATE` | `0.35` |
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
