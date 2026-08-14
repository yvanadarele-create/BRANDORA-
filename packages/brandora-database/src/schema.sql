-- Brandora schema.
--
-- Portable between SQLite and Postgres. Both understand every type, constraint
-- and index below; nothing here is dialect-specific, and `schema.ts` asserts
-- that rather than trusting it.
--
-- Constraints live in the database rather than in application code. An order
-- pointing at a missing quote, a project with no owner, or a status nobody
-- defined should be impossible to persist, not merely unlikely — application
-- checks are skipped by the next script someone writes against this file.
--
-- Money is stored as an integer amount plus its currency code, never as a float
-- and never as a bare number. XOF is zero-decimal and USD is not, so an amount
-- without its currency is not a price, it is a number.

/* --- People --------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  -- Stored and looked up lowercased (see the users repository), so a plain
  -- UNIQUE is case-insensitive in practice on both dialects. SQLite's
  -- COLLATE NOCASE has no Postgres equivalent short of CITEXT, and a
  -- constraint that behaves differently per backend is worse than none.
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('customer','admin','supplier')),
  locale     TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en','fr','es')),
  currency   TEXT NOT NULL DEFAULT 'XOF',
  country    TEXT,
  phone      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Split from users so a query that returns a user can never leak a hash by
-- accident. Selecting a user is the common operation; selecting a credential
-- is rare and deliberate.
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

/* --- Brand projects ------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS brand_projects (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('draft','interviewing','generated','active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON brand_projects(user_id);

-- One interview per project. Responses are JSON because the question set is
-- owned by @brandora/brand-engine and will change; a column per question would
-- turn every wording change into a migration.
CREATE TABLE IF NOT EXISTS interviews (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL UNIQUE REFERENCES brand_projects(id) ON DELETE CASCADE,
  responses    TEXT NOT NULL,
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_strategies (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL UNIQUE REFERENCES brand_projects(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL,
  industry              TEXT NOT NULL,
  positioning           TEXT NOT NULL CHECK (positioning IN
                          ('affordable','accessible-premium','premium','luxury','contemporary','mass-market')),
  target_customer       TEXT NOT NULL,
  personality           TEXT NOT NULL,
  promise               TEXT NOT NULL,
  mission               TEXT NOT NULL,
  vision                TEXT NOT NULL,
  slogan                TEXT NOT NULL,
  tone_of_voice         TEXT NOT NULL,
  brand_story           TEXT NOT NULL,
  name_alternatives     TEXT NOT NULL,
  -- The exact validated payload the model returned. Kept so a strategy can be
  -- audited or re-derived later without re-running a paid generation, and so a
  -- prompt change can be evaluated against what the old prompt actually
  -- produced rather than against a memory of it.
  raw_validated_output  TEXT NOT NULL,
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_identities (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL UNIQUE REFERENCES brand_projects(id) ON DELETE CASCADE,
  palette      TEXT NOT NULL,
  typography   TEXT NOT NULL,
  logo_brief   TEXT NOT NULL,
  logo_url     TEXT,
  visual_rules TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

/* --- Products ------------------------------------------------------------- */

-- Cached supplier products, normalised into Brandora's model before they land
-- here. `last_checked_at` is not decoration: §75 requires Brandora to know when
-- a price was last confirmed, and a row with no timestamp is a row nobody can
-- reason about.
CREATE TABLE IF NOT EXISTS products (
  id                   TEXT PRIMARY KEY,
  supplier             TEXT NOT NULL,
  external_id          TEXT NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  images               TEXT NOT NULL DEFAULT '[]',
  supplier_price       INTEGER,
  supplier_currency    TEXT,
  brandora_price       INTEGER,
  currency             TEXT NOT NULL,
  moq                  INTEGER NOT NULL DEFAULT 1,
  available_quantity   INTEGER NOT NULL DEFAULT 0,
  shipping_estimate    TEXT,
  stock_status         TEXT NOT NULL DEFAULT 'unknown'
                         CHECK (stock_status IN ('in-stock','low','out-of-stock','unknown')),
  customization_status TEXT NOT NULL DEFAULT 'unknown'
                         CHECK (customization_status IN ('verified','reported','unknown','unavailable')),
  metadata             TEXT NOT NULL DEFAULT '{}',
  last_checked_at      TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  UNIQUE (supplier, external_id)
);

/* --- Packages -------------------------------------------------------------- */

-- The customer's working basket, one row per line.
--
-- `customization_method` defaults to the empty string rather than NULL because
-- SQLite treats NULLs as distinct in a UNIQUE index: with NULL, "add the same
-- cup with no customisation twice" would create two rows instead of merging.
CREATE TABLE IF NOT EXISTS package_items (
  id                   TEXT PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES brand_projects(id) ON DELETE CASCADE,
  product_id           TEXT NOT NULL,
  quantity             INTEGER NOT NULL CHECK (quantity > 0),
  customization_method TEXT NOT NULL DEFAULT '',
  created_at           TEXT NOT NULL,
  UNIQUE (project_id, product_id, customization_method)
);

CREATE INDEX IF NOT EXISTS idx_package_items_project ON package_items(project_id);

/* --- Suppliers ------------------------------------------------------------ */

-- The supplier layer the procurement agent reasons over.
--
-- Reliability is stored as recorded counts rather than as an opinion: a score
-- that someone typed cannot be recomputed when the weighting changes, and
-- cannot be audited when a supplier disputes it. `completed_orders`,
-- `late_orders` and `defect_reports` are facts; the score is derived.
CREATE TABLE IF NOT EXISTS suppliers (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  platform           TEXT NOT NULL CHECK (platform IN ('aliexpress','alibaba','local','direct')),
  external_id        TEXT,
  external_url       TEXT,
  country            TEXT,
  city               TEXT,
  contact_name       TEXT,
  contact_email      TEXT,
  contact_phone      TEXT,
  categories         TEXT NOT NULL DEFAULT '[]',
  certifications     TEXT NOT NULL DEFAULT '[]',
  customization      TEXT NOT NULL DEFAULT '[]',
  minimum_order      INTEGER NOT NULL DEFAULT 1,
  lead_time_days     INTEGER,
  -- Recorded outcomes. Every one of these is something that happened.
  completed_orders   INTEGER NOT NULL DEFAULT 0,
  late_orders        INTEGER NOT NULL DEFAULT 0,
  defect_reports     INTEGER NOT NULL DEFAULT 0,
  disputes           INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','paused','blocked','unverified')),
  risk_flag          TEXT,
  notes              TEXT,
  verified_at        TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- What a supplier offers for a Brandora product, at what quantity.
--
-- Several suppliers can offer the same Brandora product — that is the whole
-- point of the normalised product layer — so price lives here, per supplier
-- per tier, and never on the product itself.
CREATE TABLE IF NOT EXISTS supplier_offers (
  id                 TEXT PRIMARY KEY,
  supplier_id        TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id         TEXT NOT NULL,
  external_product_id  TEXT,
  external_product_url TEXT,
  -- The tier this price applies from. A row per break, so a quote can pick the
  -- right one instead of interpolating between numbers nobody quoted.
  from_quantity      INTEGER NOT NULL DEFAULT 1 CHECK (from_quantity > 0),
  unit_cost          INTEGER NOT NULL,
  currency           TEXT NOT NULL,
  customization_cost INTEGER NOT NULL DEFAULT 0,
  setup_cost         INTEGER NOT NULL DEFAULT 0,
  minimum_order      INTEGER NOT NULL DEFAULT 1,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  production_days    INTEGER,
  shipping_cost      INTEGER,
  customization      TEXT NOT NULL DEFAULT '[]',
  -- §75: a price nobody has confirmed since March is not a price.
  last_checked_at    TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (supplier_id, product_id, from_quantity)
);

CREATE INDEX IF NOT EXISTS idx_offers_product ON supplier_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_offers_supplier ON supplier_offers(supplier_id);

/* --- Quotes and orders ---------------------------------------------------- */

CREATE TABLE IF NOT EXISTS quotes (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES brand_projects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference   TEXT NOT NULL UNIQUE,
  currency    TEXT NOT NULL,
  line_items  TEXT NOT NULL,
  subtotal    INTEGER NOT NULL,
  shipping    INTEGER NOT NULL DEFAULT 0,
  fees        INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL,
  -- Internal. Never selected by a customer-facing query; see the repository,
  -- which has no method that returns it to a customer.
  margin      INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL CHECK (status IN ('draft','sent','approved','rejected','expired')),
  valid_until TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);

CREATE TABLE IF NOT EXISTS orders (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id         TEXT NOT NULL REFERENCES brand_projects(id) ON DELETE CASCADE,
  quote_id           TEXT NOT NULL REFERENCES quotes(id),
  reference          TEXT NOT NULL UNIQUE,
  payment_status     TEXT NOT NULL CHECK (payment_status IN ('unpaid','pending','paid','failed','refunded')),
  -- `awaiting-approval` is the human gate §17 requires: a paid order stops
  -- here until a named administrator releases it to a supplier. `quality-check`
  -- is the inspection before it ships. Both are states a customer is told
  -- about, so both are states the database knows about.
  fulfillment_status TEXT NOT NULL CHECK (fulfillment_status IN
                       ('pending','confirmed','awaiting-approval','sourcing','processing',
                        'quality-check','shipped','delivered','cancelled')),
  total              INTEGER NOT NULL,
  currency           TEXT NOT NULL,
  supplier_order_id  TEXT,
  tracking_number    TEXT,
  carrier            TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- Payment attempts, one row per provider transaction.
--
-- `amount` is recorded at initialisation and compared against the provider's
-- reported amount at verification: a mismatch is a tampered payment, not a
-- rounding difference, and is refused.
CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  reference     TEXT NOT NULL UNIQUE,
  amount        INTEGER NOT NULL,
  currency      TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('initialised','paid','failed','abandoned','mismatch')),
  verified_at   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- Quality checks (§9 of the procurement brief, §17 of the product spec).
--
-- A `quality-check` fulfilment state says an order is being inspected. This
-- says what was found. They are different facts and only one of them survives
-- a dispute.
CREATE TABLE IF NOT EXISTS quality_checks (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('sample','production','pre-shipment')),
  outcome      TEXT NOT NULL CHECK (outcome IN ('pending','passed','failed','passed-with-notes')),
  inspected_by TEXT NOT NULL,
  defects      TEXT NOT NULL DEFAULT '[]',
  notes        TEXT,
  evidence     TEXT NOT NULL DEFAULT '[]',
  inspected_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quality_order ON quality_checks(order_id);

-- Shipments.
--
-- Tracking lived on the order as two nullable columns, which cannot express a
-- split shipment and cannot hold a delay. Nothing here is ever invented: §38
-- means an estimated date is only stored when a carrier gave one.
CREATE TABLE IF NOT EXISTS shipments (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier       TEXT,
  tracking_number TEXT,
  tracking_url  TEXT,
  status        TEXT NOT NULL DEFAULT 'preparing'
                  CHECK (status IN ('preparing','shipped','in-transit','customs','out-for-delivery','delivered','exception')),
  -- Only ever set from a carrier. Null means "not quoted", not "unknown soon".
  estimated_delivery TEXT,
  actual_delivery    TEXT,
  exception_note TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);

-- Notification records, and whether delivery actually happened.
--
-- A notification row that only says "we meant to email them" is worth nothing
-- during a complaint. `status` and `attempts` record what the transport did.
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    TEXT REFERENCES orders(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp','in-app')),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','sent','failed','abandoned')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  sent_at     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Append-only. An order's history is evidence when a customer asks why their
-- order sat for three days, so rows are never updated or deleted.
CREATE TABLE IF NOT EXISTS order_events (
  id       TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at       TEXT NOT NULL,
  kind     TEXT NOT NULL,
  detail   TEXT,
  actor    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);

-- People who asked to hear what Brandora Union is building.
--
-- An address and when it was given, and nothing else. There is no name column
-- because the form does not ask for one, and no marketing-consent flag because
-- giving the address on a form that says what it is for *is* the consent —
-- a second flag would only ever record the same fact twice.
--
-- `source` is which page it came from, so a form that stops converting can be
-- found without instrumenting anything.
CREATE TABLE IF NOT EXISTS subscribers (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  locale     TEXT NOT NULL DEFAULT 'en',
  source     TEXT NOT NULL DEFAULT 'homepage',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_created ON subscribers(created_at);
