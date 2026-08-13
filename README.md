# BRANDORA

**Build your brand. Put it everywhere.**

Brandora is an AI-powered physical brand-building platform. It takes a person
who has an idea and no brand, and gets them to a physical branded product they
can sell — without separately finding a designer, a packaging supplier, a
manufacturer and a sourcing agent.

```
IDEA → BRAND → IDENTITY → PRODUCTS → SOURCING → QUOTE → PRODUCTION → DELIVERY
```

---

## Running it

```bash
pnpm install
pnpm run build      # builds the packages, emits the front-end data, checks the site
pnpm test           # the full suite
pnpm run dev        # serves the site and /api/* on :4100
```

One process serves the front end and the API from a single origin. That is what
lets the session live in an HttpOnly cookie the page's JavaScript cannot read,
rather than in `localStorage` where any injected script can take it — and it
removes CORS and a second deployment along the way.

`BRANDORA_AUTH_SECRET` is required and has no development fallback: a fallback
for a signing secret is a fallback that reaches production, and a known signing
secret lets anyone mint a session for any account.

```bash
export BRANDORA_AUTH_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
pnpm run dev
```

See [`docs/deployment.md`](./docs/deployment.md) for every environment variable
and what happens when each is unset.

## Layout

| Package | What it owns |
| --- | --- |
| `@brandora/shared` | Domain types, multi-currency money, prefixed ids, the customer/admin error split |
| `@brandora/config` | The only module that reads a credential from the environment |
| `@brandora/i18n` | English, French and Spanish catalogues, typed for completeness |
| `@brandora/brand-engine` | The interview, strategy prompting and validation, palette, typography, logo brief |
| `@brandora/catalog` | The Brandora product layer, quantity and customisation filters |
| `@brandora/sourcing` | `SupplierAdapter`, the AliExpress adapter, scoring, freight, landed cost, caching |
| `@brandora/quotes` | The quote engine and the order state machine |
| `@brandora/database` | Schema and repositories; ownership lives in the query |
| `@brandora/auth` | scrypt password hashing, session lifecycle, authorization policy |
| `@brandora/ai` | The Anthropic-backed `StrategyProvider` and the generation flow |
| `@brandora/server` | The HTTP layer, the authoritative price, payments, every API route |
| `@brandora/web` (`apps/brandora`) | The front end |

[`docs/architecture.md`](./docs/architecture.md) explains the decisions worth
knowing — why money is integer minor units with a per-currency exponent, why the
palette is derived rather than generated, and why the browser is never trusted
with a price.

---

## What Brandora does

### Creative intelligence

Brand names, positioning, logos, colour systems, typography, brand guidelines,
packaging concepts, product visualisations.

### Commercial intelligence

What products a customer needs, how many, what fits their budget, which package
configuration makes sense, which products complement their brand.

### Sourcing intelligence

Products, suppliers, prices, availability, quantities, customisation options,
shipping information, supplier reliability.

The first sourcing integration is built around external marketplace data,
beginning with AliExpress and remaining extensible to additional suppliers and
manufacturers.

## The product

| Surface | What it is |
| --- | --- |
| **Brandora Create** | Build the brand identity |
| **Brandora Pack** | Create physical branded products and packaging |
| **Brandora Source** | Discover and evaluate sourcing options |
| **Brandora Launch** | Turn the identity into a complete physical launch package |
| **Brandora Business** | Future: reordering, inventory, formalisation, business management |

## Brand Memory

Brandora maintains a structured Brand Profile — business information, target
audience, positioning, brand personality, approved logo, colours, typography,
guidelines, product preferences and previous decisions.

The AI uses this throughout the customer's experience, so Brandora keeps brand
consistency instead of treating every request as a new conversation.

## Smart sourcing

Brandora does not display raw marketplace listings. External product data is
normalised into a Brandora product layer carrying its own id, category,
description, images, material, dimensions, variants, minimum and available
quantity, customisation capability and method, supplier, supplier price,
shipping information, external id and URL, and the timestamp it was last
verified.

That architecture lets several suppliers eventually provide the same Brandora
product.

## Product matching

Asked for *"30 premium cups"*, Brandora weighs minimum quantity, available
quantity, customisation, budget, shipping, supplier reliability, product quality
and brand compatibility — and explains why it chose what it chose. It does not
rank by cheapest price.

## Human verification

AI assists with sourcing; it does not have unrestricted authority to place
supplier orders.

```
Customer → Brandora AI → Product discovery → Smart recommendation → Quote
  → Customer confirmation → Brandora operations approval → Supplier
  → Production → Quality verification → Shipping → Customer
```

The human approval layer protects customers while the sourcing infrastructure
matures.

## Quotes

A quote combines product cost, quantity, customisation, international logistics,
local delivery, applicable fees and Brandora's margin. Quotes carry a status and
an expiry date, because supplier pricing, availability and logistics change.

A customer sees what they pay. The margin is stored and shown only to an
administrator.

## Languages

English, French and Spanish, with the architecture ready for more.

## Design system

Deep metallic purple, near-black, graphite, soft white, subtle silver.

Minimal, premium, architectural, intelligent, trustworthy, precise. High
contrast, strong typography, controlled motion. No generic AI gradients, no
glow, no chatbot aesthetic.

## Long-term

```
AliExpress → multiple marketplaces → direct manufacturers → African suppliers
  → a verified Brandora supplier network → Brandora procurement infrastructure
```

The moat is not the marketplace API. It is Brandora's accumulated intelligence
about brands, products, suppliers, pricing, customisation, quality, shipping,
demand and reordering.

## Status

**MVP — active development.** For an honest, feature-by-feature account of what
is built, what is partial and what is not started, see
[`docs/status.md`](./docs/status.md).
