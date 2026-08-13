/**
 * Repositories.
 *
 * One rule shapes every read in this file: **ownership is part of the query, not
 * a check after it.**
 *
 * `findProject(projectId)` followed by `if (project.userId !== me) throw` is the
 * shape that produces IDOR vulnerabilities, because the day someone adds a new
 * route they will remember the first line and forget the second. So the customer
 * methods take an owner and put it in the `WHERE` clause: a project belonging to
 * someone else is not "found and rejected", it is simply not found.
 *
 * Admin methods are named `…AsAdmin` so that an unscoped read is impossible to
 * write by accident and obvious to spot in review.
 */

import {
  type BrandProfile,
  type ColorSwatch,
  type CurrencyCode,
  type Locale,
  type Money,
  type Positioning,
  type Typography,
  type UserRole,
  newId,
} from "@brandora/shared";
import type { SqlDriver } from "./driver.js";
import {
  fromJson,
  int,
  nowIso,
  optionalText,
  readMoney,
  text,
  toJson,
} from "./db.js";

/* --- Users ---------------------------------------------------------------- */

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locale: Locale;
  currency: CurrencyCode;
  country?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialRow {
  userId: string;
  passwordHash: string;
  passwordSalt: string;
}

function toUser(row: Record<string, unknown>): UserRow {
  return {
    id: text(row["id"]),
    email: text(row["email"]),
    name: text(row["name"]),
    role: text(row["role"]) as UserRole,
    locale: text(row["locale"]) as Locale,
    currency: text(row["currency"]) as CurrencyCode,
    country: optionalText(row["country"]),
    phone: optionalText(row["phone"]),
    createdAt: text(row["created_at"]),
    updatedAt: text(row["updated_at"]),
  };
}

/* --- Projects ------------------------------------------------------------- */

export type ProjectStatus = "draft" | "interviewing" | "generated" | "active" | "archived";

/**
 * A project plus the few facts every list of projects needs.
 *
 * Exists because the alternative — fetch the projects, then a strategy, an
 * identity and a package count for each — is 3N+1 round trips. On SQLite that
 * was free and invisible. Against a managed Postgres it is 150 network round
 * trips to draw a dashboard with fifty brands on it.
 */
export interface ProjectSummaryRow extends ProjectRow {
  brandName: string | null;
  slogan: string | null;
  positioning: Positioning | null;
  palette: ColorSwatch[] | null;
  packageItems: number;
}

export interface AdminProjectRow extends ProjectSummaryRow {
  ownerEmail: string | null;
}

export interface AdminCustomerRow extends UserRow {
  projectCount: number;
  orderCount: number;
}

export interface ProjectRow {
  id: string;
  userId: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

const toProject = (row: Record<string, unknown>): ProjectRow => ({
  id: text(row["id"]),
  userId: text(row["user_id"]),
  name: text(row["name"]),
  status: text(row["status"]) as ProjectStatus,
  createdAt: text(row["created_at"]),
  updatedAt: text(row["updated_at"]),
});

const toProjectSummary = (row: Record<string, unknown>): ProjectSummaryRow => ({
  ...toProject(row),
  brandName: optionalText(row["brand_name"]) ?? null,
  slogan: optionalText(row["slogan"]) ?? null,
  positioning: (optionalText(row["positioning"]) as Positioning | undefined) ?? null,
  palette: row["palette"] === null || row["palette"] === undefined
    ? null
    : fromJson<ColorSwatch[]>(row["palette"], []),
  packageItems: int(row["package_items"]),
});

export interface InterviewRow {
  id: string;
  projectId: string;
  responses: Record<string, unknown>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyRow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  industry: string;
  positioning: Positioning;
  targetCustomer: string;
  personality: string[];
  promise: string;
  mission: string;
  vision: string;
  slogan: string;
  toneOfVoice: string;
  brandStory: string;
  nameAlternatives: string[];
  createdAt: string;
}

export interface IdentityRow {
  id: string;
  projectId: string;
  palette: ColorSwatch[];
  typography: Typography;
  logoBrief: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/* --- Quotes and orders ---------------------------------------------------- */

export type QuoteStatusRow = "draft" | "sent" | "approved" | "rejected" | "expired";

export interface QuoteLineRow {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteRow {
  id: string;
  projectId: string;
  userId: string;
  reference: string;
  currency: CurrencyCode;
  lineItems: QuoteLineRow[];
  subtotal: Money;
  shipping: Money;
  fees: Money;
  total: Money;
  status: QuoteStatusRow;
  validUntil: string;
  createdAt: string;
}

/** Includes margin. Only ever returned by an admin method. */
export interface QuoteRowInternal extends QuoteRow {
  margin: Money;
}

export interface PackageItemRow {
  id: string;
  projectId: string;
  productId: string;
  quantity: number;
  customizationMethod?: string;
  createdAt: string;
}

export type PaymentStatusRow = "initialised" | "paid" | "failed" | "abandoned" | "mismatch";

export interface PaymentRow {
  id: string;
  orderId: string;
  provider: string;
  reference: string;
  amount: Money;
  status: PaymentStatusRow;
  verifiedAt?: string;
  createdAt: string;
}

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";
export type FulfillmentStatus =
  | "pending"
  | "confirmed"
  | "sourcing"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderRow {
  id: string;
  userId: string;
  projectId: string;
  quoteId: string;
  reference: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  total: Money;
  currency: CurrencyCode;
  supplierOrderId?: string;
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
  updatedAt: string;
}

const toPackageItem = (row: Record<string, unknown>): PackageItemRow => {
  const method = text(row["customization_method"]);
  return {
    id: text(row["id"]),
    projectId: text(row["project_id"]),
    productId: text(row["product_id"]),
    quantity: int(row["quantity"]),
    customizationMethod: method === "" ? undefined : method,
    createdAt: text(row["created_at"]),
  };
};

const toPayment = (row: Record<string, unknown>): PaymentRow => ({
  id: text(row["id"]),
  orderId: text(row["order_id"]),
  provider: text(row["provider"]),
  reference: text(row["reference"]),
  amount: readMoney(row["amount"], row["currency"]),
  status: text(row["status"]) as PaymentStatusRow,
  verifiedAt: optionalText(row["verified_at"]),
  createdAt: text(row["created_at"]),
});

function toQuote(row: Record<string, unknown>): QuoteRow {
  const currency = text(row["currency"]) as CurrencyCode;
  return {
    id: text(row["id"]),
    projectId: text(row["project_id"]),
    userId: text(row["user_id"]),
    reference: text(row["reference"]),
    currency,
    lineItems: fromJson<QuoteLineRow[]>(row["line_items"], []),
    subtotal: readMoney(row["subtotal"], currency),
    shipping: readMoney(row["shipping"], currency),
    fees: readMoney(row["fees"], currency),
    total: readMoney(row["total"], currency),
    status: text(row["status"]) as QuoteStatusRow,
    validUntil: text(row["valid_until"]),
    createdAt: text(row["created_at"]),
  };
}

const toOrder = (row: Record<string, unknown>): OrderRow => {
  const currency = text(row["currency"]) as CurrencyCode;
  return {
    id: text(row["id"]),
    userId: text(row["user_id"]),
    projectId: text(row["project_id"]),
    quoteId: text(row["quote_id"]),
    reference: text(row["reference"]),
    paymentStatus: text(row["payment_status"]) as PaymentStatus,
    fulfillmentStatus: text(row["fulfillment_status"]) as FulfillmentStatus,
    total: readMoney(row["total"], currency),
    currency,
    supplierOrderId: optionalText(row["supplier_order_id"]),
    trackingNumber: optionalText(row["tracking_number"]),
    carrier: optionalText(row["carrier"]),
    createdAt: text(row["created_at"]),
    updatedAt: text(row["updated_at"]),
  };
};

/* --- The repositories ----------------------------------------------------- */

export interface Repositories {
  users: {
    create(input: {
      email: string;
      name: string;
      role?: UserRole;
      locale?: Locale;
      currency?: CurrencyCode;
      country?: string;
      phone?: string;
    }): Promise<UserRow>;
    findById(id: string): Promise<UserRow | null>;
    findByEmail(email: string): Promise<UserRow | null>;
    setCredentials(userId: string, passwordHash: string, passwordSalt: string): Promise<void>;
    credentialsFor(userId: string): Promise<CredentialRow | null>;
    setRole(userId: string, role: UserRole): Promise<void>;
    listAsAdmin(limit?: number): Promise<UserRow[]>;
    /** Customers with their project and order counts, in one query. */
    listWithCountsAsAdmin(limit?: number): Promise<AdminCustomerRow[]>;
  };

  sessions: {
    create(userId: string, token: string, expiresAt: string): Promise<void>;
    find(token: string): Promise<{ token: string; userId: string; expiresAt: string } | null>;
    destroy(token: string): Promise<void>;
    destroyAllFor(userId: string): Promise<void>;
    purgeExpired(now?: string): Promise<number>;
  };

  projects: {
    create(userId: string, name: string): Promise<ProjectRow>;
    /** Scoped to the owner. Another user's project is not found, not refused. */
    findForOwner(id: string, userId: string): Promise<ProjectRow | null>;
    listForOwner(userId: string): Promise<ProjectRow[]>;
    /** One query for a list of projects and what a card shows about each. */
    listSummariesForOwner(userId: string): Promise<ProjectSummaryRow[]>;
    setStatus(id: string, userId: string, status: ProjectStatus): Promise<void>;
    rename(id: string, userId: string, name: string): Promise<void>;
    findAsAdmin(id: string): Promise<ProjectRow | null>;
    listAsAdmin(limit?: number): Promise<ProjectRow[]>;
    listSummariesAsAdmin(limit?: number): Promise<AdminProjectRow[]>;
  };

  interviews: {
    save(projectId: string, responses: Record<string, unknown>, completed: boolean): Promise<InterviewRow>;
    findForProject(projectId: string): Promise<InterviewRow | null>;
  };

  strategies: {
    save(projectId: string, strategy: Omit<StrategyRow, "id" | "projectId" | "createdAt">, raw: unknown): Promise<StrategyRow>;
    findForProject(projectId: string): Promise<StrategyRow | null>;
  };

  identities: {
    save(projectId: string, identity: Omit<IdentityRow, "id" | "projectId" | "createdAt" | "updatedAt">): Promise<IdentityRow>;
    findForProject(projectId: string): Promise<IdentityRow | null>;
  };

  packages: {
    /** Adds, or increases the quantity of an identical existing line. */
    add(projectId: string, productId: string, quantity: number, method?: string): Promise<PackageItemRow>;
    setQuantity(projectId: string, itemId: string, quantity: number): Promise<void>;
    remove(projectId: string, itemId: string): Promise<void>;
    clear(projectId: string): Promise<void>;
    listForProject(projectId: string): Promise<PackageItemRow[]>;
  };

  payments: {
    create(input: {
      orderId: string;
      provider: string;
      reference: string;
      amount: number;
      currency: CurrencyCode;
    }): Promise<PaymentRow>;
    findByReference(reference: string): Promise<PaymentRow | null>;
    markPaid(reference: string, verifiedAt?: string): Promise<void>;
    markStatus(reference: string, status: PaymentStatusRow): Promise<void>;
    listForOrder(orderId: string): Promise<PaymentRow[]>;
  };

  quotes: {
    create(input: {
      projectId: string;
      userId: string;
      reference: string;
      currency: CurrencyCode;
      lineItems: QuoteLineRow[];
      subtotal: number;
      shipping: number;
      fees: number;
      total: number;
      margin: number;
      validUntil: string;
    }): Promise<QuoteRow>;
    findForOwner(id: string, userId: string): Promise<QuoteRow | null>;
    listForOwner(userId: string): Promise<QuoteRow[]>;
    listForProject(projectId: string, userId: string): Promise<QuoteRow[]>;
    setStatus(id: string, status: QuoteStatusRow): Promise<void>;
    /**
     * The next number in a human-readable reference series.
     *
     * Advisory, not a guarantee: the UNIQUE index on `reference` is what
     * actually prevents a collision, and the caller retries on one. A counter
     * table would serialise every quote behind a single row for a number that
     * only exists so someone can read it down a phone line.
     */
    nextSequence(referencePrefix: string): Promise<number>;
    /** Returns margin. Admin surfaces only. */
    findAsAdmin(id: string): Promise<QuoteRowInternal | null>;
    listAsAdmin(limit?: number): Promise<QuoteRowInternal[]>;
  };

  orders: {
    create(input: {
      userId: string;
      projectId: string;
      quoteId: string;
      reference: string;
      total: number;
      currency: CurrencyCode;
    }): Promise<OrderRow>;
    findForOwner(id: string, userId: string): Promise<OrderRow | null>;
    listForOwner(userId: string): Promise<OrderRow[]>;
    findByReference(reference: string): Promise<OrderRow | null>;
    nextSequence(referencePrefix: string): Promise<number>;
    setPaymentStatus(id: string, status: PaymentStatus): Promise<void>;
    setFulfillmentStatus(id: string, status: FulfillmentStatus): Promise<void>;
    addEvent(orderId: string, kind: string, actor: string, detail?: string): Promise<void>;
    events(orderId: string): Promise<{ at: string; kind: string; actor: string; detail?: string }[]>;
    findAsAdmin(id: string): Promise<OrderRow | null>;
    listAsAdmin(limit?: number): Promise<OrderRow[]>;
  };
}

export function createRepositories(db: SqlDriver): Repositories {
  const get = (sql: string, ...params: unknown[]): Promise<Record<string, unknown> | null> =>
    db.get(sql, params);

  const all = (sql: string, ...params: unknown[]): Promise<Record<string, unknown>[]> =>
    db.all(sql, params);

  const run = (sql: string, ...params: unknown[]): Promise<void> => db.run(sql, params);

  return {
    users: {
      async create(input) {
        const now = nowIso();
        const user: UserRow = {
          id: newId("user"),
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          role: input.role ?? "customer",
          locale: input.locale ?? "en",
          currency: input.currency ?? "XOF",
          country: input.country,
          phone: input.phone,
          createdAt: now,
          updatedAt: now,
        };
        await run(`INSERT INTO users (id,email,name,role,locale,currency,country,phone,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          user.id, user.email, user.name, user.role, user.locale, user.currency,
          user.country ?? null, user.phone ?? null, now, now,
        );
        return user;
      },

      async findById(id) {
        const row = await get(`SELECT * FROM users WHERE id = ?`, id);
        return row ? toUser(row) : null;
      },

      async findByEmail(email) {
        const row = await get(`SELECT * FROM users WHERE email = ?`, email.trim().toLowerCase());
        return row ? toUser(row) : null;
      },

      async setCredentials(userId, passwordHash, passwordSalt) {
        await run(`INSERT INTO user_credentials (user_id,password_hash,password_salt,updated_at)
           VALUES (?,?,?,?)
           ON CONFLICT(user_id) DO UPDATE SET
             password_hash = excluded.password_hash,
             password_salt = excluded.password_salt,
             updated_at    = excluded.updated_at`,
          userId, passwordHash, passwordSalt, nowIso(),
        );
      },

      async credentialsFor(userId) {
        const row = await get(`SELECT * FROM user_credentials WHERE user_id = ?`, userId);
        return row
          ? {
              userId: text(row["user_id"]),
              passwordHash: text(row["password_hash"]),
              passwordSalt: text(row["password_salt"]),
            }
          : null;
      },

      async setRole(userId, role) {
        await run(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`, role, nowIso(), userId);
      },

      async listAsAdmin(limit = 100) {
        return (await all(`SELECT * FROM users ORDER BY created_at DESC LIMIT ?`, limit)).map(toUser);
      },

      // One query rather than two per customer. The admin list is the page most
      // likely to be opened against a real customer table.
      async listWithCountsAsAdmin(limit = 500) {
        return (await all(
          `SELECT u.*,
                  (SELECT COUNT(*) FROM brand_projects p WHERE p.user_id = u.id) AS project_count,
                  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
           FROM users u
           ORDER BY u.created_at DESC
           LIMIT ?`,
          limit,
        )).map((row) => ({
          ...toUser(row),
          projectCount: int(row["project_count"]),
          orderCount: int(row["order_count"]),
        }));
      },
    },

    sessions: {
      async create(userId, token, expiresAt) {
        await run(`INSERT INTO sessions (token,user_id,expires_at,created_at) VALUES (?,?,?,?)`,
          token, userId, expiresAt, nowIso(),
        );
      },

      async find(token) {
        const row = await get(`SELECT * FROM sessions WHERE token = ?`, token);
        return row
          ? { token: text(row["token"]), userId: text(row["user_id"]), expiresAt: text(row["expires_at"]) }
          : null;
      },

      async destroy(token) {
        await run(`DELETE FROM sessions WHERE token = ?`, token);
      },

      async destroyAllFor(userId) {
        await run(`DELETE FROM sessions WHERE user_id = ?`, userId);
      },

      async purgeExpired(now = nowIso()) {
        const before = int((await get(`SELECT COUNT(*) AS n FROM sessions`))?.["n"]);
        await run(`DELETE FROM sessions WHERE expires_at < ?`, now);
        const after = int((await get(`SELECT COUNT(*) AS n FROM sessions`))?.["n"]);
        return before - after;
      },
    },

    projects: {
      async create(userId, name) {
        const now = nowIso();
        const project: ProjectRow = {
          id: newId("brand"),
          userId,
          name: name.trim() || "Untitled brand",
          status: "draft",
          createdAt: now,
          updatedAt: now,
        };
        await run(`INSERT INTO brand_projects (id,user_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
          project.id, project.userId, project.name, project.status, now, now,
        );
        return project;
      },

      async findForOwner(id, userId) {
        const row = await get(`SELECT * FROM brand_projects WHERE id = ? AND user_id = ?`, id, userId);
        return row ? toProject(row) : null;
      },

      async listForOwner(userId) {
        return (await all(`SELECT * FROM brand_projects WHERE user_id = ? ORDER BY updated_at DESC`,
          userId,
        )).map(toProject);
      },

      async listSummariesForOwner(userId) {
        return (await all(
          `SELECT p.*,
                  s.name AS brand_name,
                  s.slogan AS slogan,
                  s.positioning AS positioning,
                  i.palette AS palette,
                  (SELECT COUNT(*) FROM package_items pi WHERE pi.project_id = p.id) AS package_items
           FROM brand_projects p
           LEFT JOIN brand_strategies s ON s.project_id = p.id
           LEFT JOIN brand_identities i ON i.project_id = p.id
           WHERE p.user_id = ?
           ORDER BY p.updated_at DESC`,
          userId,
        )).map(toProjectSummary);
      },

      async setStatus(id, userId, status) {
        await run(`UPDATE brand_projects SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          status, nowIso(), id, userId,
        );
      },

      async rename(id, userId, name) {
        await run(`UPDATE brand_projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          name, nowIso(), id, userId,
        );
      },

      async findAsAdmin(id) {
        const row = await get(`SELECT * FROM brand_projects WHERE id = ?`, id);
        return row ? toProject(row) : null;
      },

      async listAsAdmin(limit = 100) {
        return (await all(`SELECT * FROM brand_projects ORDER BY updated_at DESC LIMIT ?`, limit)).map(toProject);
      },

      async listSummariesAsAdmin(limit = 500) {
        return (await all(
          `SELECT p.*,
                  u.email AS owner_email,
                  s.name AS brand_name,
                  s.slogan AS slogan,
                  s.positioning AS positioning,
                  i.palette AS palette,
                  (SELECT COUNT(*) FROM package_items pi WHERE pi.project_id = p.id) AS package_items
           FROM brand_projects p
           LEFT JOIN users u ON u.id = p.user_id
           LEFT JOIN brand_strategies s ON s.project_id = p.id
           LEFT JOIN brand_identities i ON i.project_id = p.id
           ORDER BY p.updated_at DESC
           LIMIT ?`,
          limit,
        )).map((row) => ({
          ...toProjectSummary(row),
          ownerEmail: optionalText(row["owner_email"]) ?? null,
        }));
      },
    },

    interviews: {
      async save(projectId, responses, completed) {
        const now = nowIso();
        const existing = await get(`SELECT * FROM interviews WHERE project_id = ?`, projectId);
        const id = existing ? text(existing["id"]) : newId("conversation");
        const completedAt = completed ? now : null;

        await run(`INSERT INTO interviews (id,project_id,responses,completed_at,created_at,updated_at)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(project_id) DO UPDATE SET
             responses    = excluded.responses,
             completed_at = excluded.completed_at,
             updated_at   = excluded.updated_at`,
          id, projectId, toJson(responses), completedAt, now, now,
        );

        return {
          id,
          projectId,
          responses,
          completedAt: completedAt ?? undefined,
          createdAt: existing ? text(existing["created_at"]) : now,
          updatedAt: now,
        };
      },

      async findForProject(projectId) {
        const row = await get(`SELECT * FROM interviews WHERE project_id = ?`, projectId);
        if (!row) return null;
        return {
          id: text(row["id"]),
          projectId: text(row["project_id"]),
          responses: fromJson<Record<string, unknown>>(row["responses"], {}),
          completedAt: optionalText(row["completed_at"]),
          createdAt: text(row["created_at"]),
          updatedAt: text(row["updated_at"]),
        };
      },
    },

    strategies: {
      async save(projectId, strategy, raw) {
        const now = nowIso();
        const existing = await get(`SELECT id FROM brand_strategies WHERE project_id = ?`, projectId);
        const id = existing ? text(existing["id"]) : newId("asset");

        await run(`INSERT INTO brand_strategies
             (id,project_id,name,description,industry,positioning,target_customer,personality,
              promise,mission,vision,slogan,tone_of_voice,brand_story,name_alternatives,
              raw_validated_output,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(project_id) DO UPDATE SET
             name=excluded.name, description=excluded.description, industry=excluded.industry,
             positioning=excluded.positioning, target_customer=excluded.target_customer,
             personality=excluded.personality, promise=excluded.promise, mission=excluded.mission,
             vision=excluded.vision, slogan=excluded.slogan, tone_of_voice=excluded.tone_of_voice,
             brand_story=excluded.brand_story, name_alternatives=excluded.name_alternatives,
             raw_validated_output=excluded.raw_validated_output`,
          id, projectId, strategy.name, strategy.description, strategy.industry, strategy.positioning,
          strategy.targetCustomer, toJson(strategy.personality), strategy.promise, strategy.mission,
          strategy.vision, strategy.slogan, strategy.toneOfVoice, strategy.brandStory,
          toJson(strategy.nameAlternatives), toJson(raw), now,
        );

        return { ...strategy, id, projectId, createdAt: now };
      },

      async findForProject(projectId) {
        const row = await get(`SELECT * FROM brand_strategies WHERE project_id = ?`, projectId);
        if (!row) return null;
        return {
          id: text(row["id"]),
          projectId: text(row["project_id"]),
          name: text(row["name"]),
          description: text(row["description"]),
          industry: text(row["industry"]),
          positioning: text(row["positioning"]) as Positioning,
          targetCustomer: text(row["target_customer"]),
          personality: fromJson<string[]>(row["personality"], []),
          promise: text(row["promise"]),
          mission: text(row["mission"]),
          vision: text(row["vision"]),
          slogan: text(row["slogan"]),
          toneOfVoice: text(row["tone_of_voice"]),
          brandStory: text(row["brand_story"]),
          nameAlternatives: fromJson<string[]>(row["name_alternatives"], []),
          createdAt: text(row["created_at"]),
        };
      },
    },

    identities: {
      async save(projectId, identity) {
        const now = nowIso();
        const existing = await get(`SELECT id, created_at FROM brand_identities WHERE project_id = ?`, projectId);
        const id = existing ? text(existing["id"]) : newId("asset");

        await run(`INSERT INTO brand_identities (id,project_id,palette,typography,logo_brief,logo_url,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(project_id) DO UPDATE SET
             palette=excluded.palette, typography=excluded.typography,
             logo_brief=excluded.logo_brief, logo_url=excluded.logo_url,
             updated_at=excluded.updated_at`,
          id, projectId, toJson(identity.palette), toJson(identity.typography),
          identity.logoBrief, identity.logoUrl ?? null, now, now,
        );

        return {
          ...identity,
          id,
          projectId,
          createdAt: existing ? text(existing["created_at"]) : now,
          updatedAt: now,
        };
      },

      async findForProject(projectId) {
        const row = await get(`SELECT * FROM brand_identities WHERE project_id = ?`, projectId);
        if (!row) return null;
        return {
          id: text(row["id"]),
          projectId: text(row["project_id"]),
          palette: fromJson<ColorSwatch[]>(row["palette"], []),
          typography: fromJson<Typography>(row["typography"], {
            primary: "Inter",
            secondary: "Inter",
            primaryFallback: "sans-serif",
            secondaryFallback: "sans-serif",
            rationale: "",
          }),
          logoBrief: text(row["logo_brief"]),
          logoUrl: optionalText(row["logo_url"]),
          createdAt: text(row["created_at"]),
          updatedAt: text(row["updated_at"]),
        };
      },
    },

    packages: {
      async add(projectId, productId, quantity, method) {
        const now = nowIso();
        const key = method ?? "";
        const existing = await get(`SELECT * FROM package_items WHERE project_id = ? AND product_id = ? AND customization_method = ?`,
          projectId, productId, key,
        );

        if (existing) {
          // Adding the same product twice raises the line rather than creating a
          // second one — two lines of the same cup is not what a customer meant.
          const next = int(existing["quantity"]) + quantity;
          await run(`UPDATE package_items SET quantity = ? WHERE id = ?`, next, text(existing["id"]));
          return { ...toPackageItem(existing), quantity: next };
        }

        const id = newId("packageItem");
        await run(`INSERT INTO package_items (id,project_id,product_id,quantity,customization_method,created_at)
           VALUES (?,?,?,?,?,?)`,
          id, projectId, productId, quantity, key, now,
        );
        return {
          id, projectId, productId, quantity,
          customizationMethod: key === "" ? undefined : key,
          createdAt: now,
        };
      },

      async setQuantity(projectId, itemId, quantity) {
        // Project-scoped, so an id from another customer's package updates nothing.
        await run(`UPDATE package_items SET quantity = ? WHERE id = ? AND project_id = ?`,
          quantity, itemId, projectId,
        );
      },

      async remove(projectId, itemId) {
        await run(`DELETE FROM package_items WHERE id = ? AND project_id = ?`, itemId, projectId);
      },

      async clear(projectId) {
        await run(`DELETE FROM package_items WHERE project_id = ?`, projectId);
      },

      async listForProject(projectId) {
        return (await all(`SELECT * FROM package_items WHERE project_id = ? ORDER BY created_at ASC`,
          projectId,
        )).map(toPackageItem);
      },
    },

    payments: {
      async create(input) {
        const now = nowIso();
        const id = newId("payment");
        await run(`INSERT INTO payments (id,order_id,provider,reference,amount,currency,status,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          id, input.orderId, input.provider, input.reference, input.amount,
          input.currency, "initialised", now, now,
        );
        return {
          id, orderId: input.orderId, provider: input.provider,
          reference: input.reference,
          amount: readMoney(input.amount, input.currency),
          status: "initialised", createdAt: now,
        };
      },

      async findByReference(reference) {
        const row = await get(`SELECT * FROM payments WHERE reference = ?`, reference);
        return row ? toPayment(row) : null;
      },

      async markPaid(reference, verifiedAt = nowIso()) {
        // Idempotent: a duplicate webhook for an already-paid reference changes
        // nothing, which is what makes replayed deliveries harmless.
        await run(`UPDATE payments SET status = 'paid', verified_at = ?, updated_at = ?
           WHERE reference = ? AND status <> 'paid'`,
          verifiedAt, nowIso(), reference,
        );
      },

      async markStatus(reference, status) {
        await run(`UPDATE payments SET status = ?, updated_at = ? WHERE reference = ?`,
          status, nowIso(), reference,
        );
      },

      async listForOrder(orderId) {
        return (await all(`SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC`,
          orderId,
        )).map(toPayment);
      },
    },

    quotes: {
      async create(input) {
        const now = nowIso();
        const id = newId("quote");
        await run(`INSERT INTO quotes
             (id,project_id,user_id,reference,currency,line_items,subtotal,shipping,fees,total,margin,status,valid_until,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          id, input.projectId, input.userId, input.reference, input.currency, toJson(input.lineItems),
          input.subtotal, input.shipping, input.fees, input.total, input.margin, "draft",
          input.validUntil, now,
        );
        const row = await get(`SELECT * FROM quotes WHERE id = ?`, id);
        if (!row) throw new Error("quote vanished immediately after insert");
        return toQuote(row);
      },

      async findForOwner(id, userId) {
        const row = await get(`SELECT * FROM quotes WHERE id = ? AND user_id = ?`, id, userId);
        return row ? toQuote(row) : null;
      },

      async listForOwner(userId) {
        return (await all(`SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC`, userId)).map(toQuote);
      },

      // The owner is in the WHERE clause alongside the project, so quoting
      // another customer's project id returns nothing rather than their prices.
      async listForProject(projectId, userId) {
        return (await all(`SELECT * FROM quotes WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC`,
          projectId,
          userId,
        )).map(toQuote);
      },

      async setStatus(id, status) {
        await run(`UPDATE quotes SET status = ? WHERE id = ?`, status, id);
      },

      async nextSequence(referencePrefix) {
        const row = await get(`SELECT COUNT(*) AS n FROM quotes WHERE reference LIKE ?`, `${referencePrefix}%`);
        return int(row?.["n"]) + 1;
      },

      async findAsAdmin(id) {
        const row = await get(`SELECT * FROM quotes WHERE id = ?`, id);
        if (!row) return null;
        const quote = toQuote(row);
        return { ...quote, margin: readMoney(row["margin"], quote.currency) };
      },

      async listAsAdmin(limit = 100) {
        return (await all(`SELECT * FROM quotes ORDER BY created_at DESC LIMIT ?`, limit)).map((row) => {
          const quote = toQuote(row);
          return { ...quote, margin: readMoney(row["margin"], quote.currency) };
        });
      },
    },

    orders: {
      async create(input) {
        const now = nowIso();
        const id = newId("order");
        await run(`INSERT INTO orders
             (id,user_id,project_id,quote_id,reference,payment_status,fulfillment_status,total,currency,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          id, input.userId, input.projectId, input.quoteId, input.reference,
          "unpaid", "pending", input.total, input.currency, now, now,
        );
        const row = await get(`SELECT * FROM orders WHERE id = ?`, id);
        if (!row) throw new Error("order vanished immediately after insert");
        return toOrder(row);
      },

      async findForOwner(id, userId) {
        const row = await get(`SELECT * FROM orders WHERE id = ? AND user_id = ?`, id, userId);
        return row ? toOrder(row) : null;
      },

      async listForOwner(userId) {
        return (await all(`SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`, userId)).map(toOrder);
      },

      // Unscoped by design: a payment provider's callback names an order by
      // reference and carries no session. Every caller of this re-checks
      // ownership before returning anything to a browser.
      async findByReference(reference) {
        const row = await get(`SELECT * FROM orders WHERE reference = ?`, reference);
        return row ? toOrder(row) : null;
      },

      async nextSequence(referencePrefix) {
        const row = await get(`SELECT COUNT(*) AS n FROM orders WHERE reference LIKE ?`, `${referencePrefix}%`);
        return int(row?.["n"]) + 1;
      },

      async setPaymentStatus(id, status) {
        await run(`UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?`, status, nowIso(), id);
      },

      async setFulfillmentStatus(id, status) {
        await run(`UPDATE orders SET fulfillment_status = ?, updated_at = ? WHERE id = ?`, status, nowIso(), id);
      },

      async addEvent(orderId, kind, actor, detail) {
        await run(`INSERT INTO order_events (id,order_id,at,kind,detail,actor) VALUES (?,?,?,?,?,?)`,
          newId("notification"), orderId, nowIso(), kind, detail ?? null, actor,
        );
      },

      async events(orderId) {
        return (await all(`SELECT * FROM order_events WHERE order_id = ? ORDER BY at ASC`, orderId)).map((row) => ({
          at: text(row["at"]),
          kind: text(row["kind"]),
          actor: text(row["actor"]),
          detail: optionalText(row["detail"]),
        }));
      },

      async findAsAdmin(id) {
        const row = await get(`SELECT * FROM orders WHERE id = ?`, id);
        return row ? toOrder(row) : null;
      },

      async listAsAdmin(limit = 100) {
        return (await all(`SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`, limit)).map(toOrder);
      },
    },
  };
}

/** Convenience for the brand result screen: everything one project owns. */
export interface ProjectBundle {
  project: ProjectRow;
  interview: InterviewRow | null;
  strategy: StrategyRow | null;
  identity: IdentityRow | null;
}

export async function loadProjectBundle(
  repos: Repositories,
  projectId: string,
  userId: string,
): Promise<ProjectBundle | null> {
  const project = await repos.projects.findForOwner(projectId, userId);
  if (!project) return null;

  // Fetched together rather than in sequence: four round trips to a managed
  // Postgres is four times the latency of one, and none of them depends on
  // another's result.
  const [interview, strategy, identity] = await Promise.all([
    repos.interviews.findForProject(projectId),
    repos.strategies.findForProject(projectId),
    repos.identities.findForProject(projectId),
  ]);

  return { project, interview, strategy, identity };
}

/** Shape a stored strategy and identity back into a BrandProfile for the engine. */
export function toBrandProfile(bundle: ProjectBundle): BrandProfile | null {
  const { project, strategy, identity } = bundle;
  if (!strategy || !identity) return null;
  return {
    id: project.id,
    userId: project.userId,
    name: strategy.name,
    description: strategy.description,
    industry: strategy.industry,
    targetCustomer: strategy.targetCustomer,
    positioning: strategy.positioning,
    personality: strategy.personality,
    promise: strategy.promise,
    mission: strategy.mission,
    vision: strategy.vision,
    slogan: strategy.slogan,
    toneOfVoice: strategy.toneOfVoice,
    brandStory: strategy.brandStory,
    palette: identity.palette,
    typography: identity.typography,
    logoBrief: identity.logoBrief,
    status: project.status === "archived" ? "archived" : "generated",
    locale: "en",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
