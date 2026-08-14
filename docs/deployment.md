# Deploying Brandora

## Read this first: production is behind `main`

`brandora-rho.vercel.app` is serving deployment `9d956af`, which Vercel's own
panel marks **Stale** — its word for "a newer commit exists that has not been
deployed". `9d956af` is the commit from before the application existed: a
README and a logo. That is why the domain 404s.

Everything since is on `main` and builds. Getting production onto it is one of
two clicks, and it has to be done from the Vercel dashboard by someone signed
in to `harmony-team1` — this session's Vercel token is scoped to a different
project (`harmony-verify`) and cannot see `brandora` at all, so it cannot press
either button.

**The one-click fix.** Vercel → `harmony-team1/brandora` → Deployments → the
`main` row → ⋯ → **Redeploy**. Leave "use existing build cache" unticked.

**If `main` is not listed at all**, the git connection is what is broken, not
the build: Settings → Git → connect `yvanadarele-create/BRANDORA-`, production
branch `main`. Every push after that deploys on its own.

**Settings to check while you are there.** Root Directory can be either `/` or
`apps/brandora` — the repository carries a `vercel.json` and an `api/index.js`
at both, so it builds from either. Do not set a Framework Preset; "Other" is
correct.

**Then add the environment variables** in Settings → Environment Variables. The
full list is at the bottom of this file. Without `BRANDORA_AUTH_SECRET` the
server refuses to boot, deliberately; without `BRANDORA_DATABASE_URL` it falls
back to SQLite, which does not survive a serverless invocation.

**Verifying it worked**, in this order:

```
curl https://brandora-rho.vercel.app/api/health     # {"status":"ok", …}
curl https://brandora-rho.vercel.app/api/settings   # {"currency":"XOF", …}
curl -I https://brandora-rho.vercel.app/            # 200, text/html
```

`/api/health` answering is the real signal: it means the serverless function
booted, which means the secret and the database are both readable. A 200 on `/`
alone only proves the static files shipped.

This has been checked as far as it can be checked from here: `main` was cloned
fresh into a clean directory, Vercel's exact `installCommand` and `buildCommand`
were run against it, and `api/index.js` was then invoked the way Vercel invokes
it. `/api/health` and `/api/settings` both answered. What has *not* been done is
a real deployment — `*.vercel.app` is unreachable from this environment, so
**production is NOT VERIFIED LIVE.**

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
