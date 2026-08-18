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
import type { Row, SqlDriver } from "./driver.js";
import {
  fromJson,
  fromJsonArray,
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
    : fromJsonArray<ColorSwatch>(row["palette"], []),
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

/* --- Suppliers ------------------------------------------------------------ */

export type SupplierStatus = "active" | "paused" | "blocked" | "unverified";

export interface SupplierRow {
  id: string;
  name: string;
  platform: string;
  externalId?: string;
  externalUrl?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  categories: string[];
  certifications: string[];
  customization: string[];
  minimumOrder: number;
  leadTimeDays?: number;
  completedOrders: number;
  lateOrders: number;
  defectReports: number;
  disputes: number;
  status: SupplierStatus;
  riskFlag?: string;
  notes?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOfferRow {
  id: string;
  supplierId: string;
  productId: string;
  externalProductId?: string;
  externalProductUrl?: string;
  fromQuantity: number;
  unitCost: Money;
  customizationCost: Money;
  setupCost: Money;
  minimumOrder: number;
  availableQuantity: number;
  productionDays?: number;
  shippingCost?: Money;
  customization: string[];
  lastCheckedAt: string;
}

const toSupplier = (row: Record<string, unknown>): SupplierRow => ({
  id: text(row["id"]),
  name: text(row["name"]),
  platform: text(row["platform"]),
  externalId: optionalText(row["external_id"]),
  externalUrl: optionalText(row["external_url"]),
  country: optionalText(row["country"]),
  city: optionalText(row["city"]),
  // Read as a number when present and left undefined when not. A coordinate
  // that came back null must not become 0 — 0,0 is a real place in the Gulf of
  // Guinea, and a map would plot a factory there.
  ...(typeof row["latitude"] === "number" ? { latitude: row["latitude"] } : {}),
  ...(typeof row["longitude"] === "number" ? { longitude: row["longitude"] } : {}),
  contactName: optionalText(row["contact_name"]),
  contactEmail: optionalText(row["contact_email"]),
  contactPhone: optionalText(row["contact_phone"]),
  categories: fromJsonArray<string>(row["categories"], []),
  certifications: fromJsonArray<string>(row["certifications"], []),
  customization: fromJsonArray<string>(row["customization"], []),
  minimumOrder: int(row["minimum_order"]),
  leadTimeDays: row["lead_time_days"] === null ? undefined : int(row["lead_time_days"]),
  completedOrders: int(row["completed_orders"]),
  lateOrders: int(row["late_orders"]),
  defectReports: int(row["defect_reports"]),
  disputes: int(row["disputes"]),
  status: text(row["status"]) as SupplierStatus,
  riskFlag: optionalText(row["risk_flag"]),
  notes: optionalText(row["notes"]),
  verifiedAt: optionalText(row["verified_at"]),
  createdAt: text(row["created_at"]),
  updatedAt: text(row["updated_at"]),
});

const toOffer = (row: Record<string, unknown>): SupplierOfferRow => ({
  id: text(row["id"]),
  supplierId: text(row["supplier_id"]),
  productId: text(row["product_id"]),
  externalProductId: optionalText(row["external_product_id"]),
  externalProductUrl: optionalText(row["external_product_url"]),
  fromQuantity: int(row["from_quantity"]),
  unitCost: readMoney(row["unit_cost"], row["currency"]),
  customizationCost: readMoney(row["customization_cost"], row["currency"]),
  setupCost: readMoney(row["setup_cost"], row["currency"]),
  minimumOrder: int(row["minimum_order"]),
  availableQuantity: int(row["available_quantity"]),
  productionDays: row["production_days"] === null ? undefined : int(row["production_days"]),
  shippingCost: row["shipping_cost"] === null ? undefined : readMoney(row["shipping_cost"], row["currency"]),
  customization: fromJsonArray<string>(row["customization"], []),
  lastCheckedAt: text(row["last_checked_at"]),
});

/* --- Quality, shipments, notifications ------------------------------------ */

export type QualityOutcome = "pending" | "passed" | "failed" | "passed-with-notes";

export interface QualityCheckRow {
  id: string;
  orderId: string;
  kind: "sample" | "production" | "pre-shipment";
  outcome: QualityOutcome;
  inspectedBy: string;
  defects: string[];
  notes?: string;
  evidence: string[];
  inspectedAt?: string;
  createdAt: string;
}

const toQualityCheck = (row: Record<string, unknown>): QualityCheckRow => ({
  id: text(row["id"]),
  orderId: text(row["order_id"]),
  kind: text(row["kind"]) as QualityCheckRow["kind"],
  outcome: text(row["outcome"]) as QualityOutcome,
  inspectedBy: text(row["inspected_by"]),
  defects: fromJsonArray<string>(row["defects"], []),
  notes: optionalText(row["notes"]),
  evidence: fromJsonArray<string>(row["evidence"], []),
  inspectedAt: optionalText(row["inspected_at"]),
  createdAt: text(row["created_at"]),
});

export type ShipmentStatus =
  | "preparing" | "shipped" | "in-transit" | "customs" | "out-for-delivery" | "delivered" | "exception";

export interface ShipmentRow {
  id: string;
  orderId: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  estimatedDelivery?: string;
  actualDelivery?: string;
  exceptionNote?: string;
  createdAt: string;
  updatedAt: string;
}

const toShipment = (row: Record<string, unknown>): ShipmentRow => ({
  id: text(row["id"]),
  orderId: text(row["order_id"]),
  carrier: optionalText(row["carrier"]),
  trackingNumber: optionalText(row["tracking_number"]),
  trackingUrl: optionalText(row["tracking_url"]),
  status: text(row["status"]) as ShipmentStatus,
  estimatedDelivery: optionalText(row["estimated_delivery"]),
  actualDelivery: optionalText(row["actual_delivery"]),
  exceptionNote: optionalText(row["exception_note"]),
  createdAt: text(row["created_at"]),
  updatedAt: text(row["updated_at"]),
});

export type NotificationStatus = "pending" | "sent" | "failed" | "abandoned";

export interface NotificationRow {
  id: string;
  userId: string;
  orderId?: string;
  kind: string;
  channel: "email" | "sms" | "whatsapp" | "in-app";
  subject: string;
  body: string;
  /** Overrides the recipient's own email. See the column's comment in schema.sql. */
  recipientEmail?: string;
  status: NotificationStatus;
  attempts: number;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
}

const toNotification = (row: Record<string, unknown>): NotificationRow => ({
  id: text(row["id"]),
  userId: text(row["user_id"]),
  orderId: optionalText(row["order_id"]),
  kind: text(row["kind"]),
  recipientEmail: optionalText(row["recipient_email"]),
  channel: text(row["channel"]) as NotificationRow["channel"],
  subject: text(row["subject"]),
  body: text(row["body"]),
  status: text(row["status"]) as NotificationStatus,
  attempts: int(row["attempts"]),
  lastError: optionalText(row["last_error"]),
  sentAt: optionalText(row["sent_at"]),
  createdAt: text(row["created_at"]),
});

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
  /** The human gate (§17): a paid order waits here for an administrator. */
  | "awaiting-approval"
  | "sourcing"
  | "processing"
  | "quality-check"
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
    lineItems: fromJsonArray<QuoteLineRow>(row["line_items"], []),
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

const toTestimonial = (row: Record<string, unknown>): TestimonialRow => ({
  id: text(row["id"]),
  quote: text(row["quote"]),
  authorName: text(row["author_name"]),
  ...(optionalText(row["author_role"]) ? { authorRole: optionalText(row["author_role"])! } : {}),
  ...(optionalText(row["company"]) ? { company: optionalText(row["company"])! } : {}),
  ...(optionalText(row["country"]) ? { country: optionalText(row["country"])! } : {}),
  locale: text(row["locale"]),
  // SQLite stores 0/1, Postgres may hand back a boolean. Both mean the same
  // thing and neither may reach the caller as the other.
  approved: row["approved"] === true || row["approved"] === 1 || row["approved"] === "1",
  ...(optionalText(row["consent_at"]) ? { consentAt: optionalText(row["consent_at"])! } : {}),
  position: int(row["position"]),
  createdAt: text(row["created_at"]),
});

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

  passwordResets: {
    create(userId: string, token: string, expiresAt: string): Promise<void>;
    find(
      token: string,
    ): Promise<{ token: string; userId: string; expiresAt: string; usedAt: string | null } | null>;
    /** One-shot: called the moment the password actually changes. */
    markUsed(token: string): Promise<void>;
    /** A fresh reset request should not leave an earlier link still live. */
    destroyAllFor(userId: string): Promise<void>;
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
    /**
     * Who to tell about this order, and what to call it.
     *
     * Unscoped, like `findByReference`, because a payment provider's webhook
     * carries no session — but deliberately narrower than an admin read. Two
     * fields are what addressing an email needs; handing the settlement path a
     * whole order row would put an admin-shaped object somewhere a customer's
     * response is assembled.
     */
    notificationTarget(orderId: string): Promise<{ userId: string; reference: string } | null>;
    findAsAdmin(id: string): Promise<OrderRow | null>;
    listAsAdmin(limit?: number): Promise<OrderRow[]>;
  };

  /**
   * Suppliers.
   *
   * Admin-only throughout — there is no owner to scope these by, so no
   * customer-facing route may call any of them. §7 of the procurement brief: a
   * customer never sees a supplier name or a supplier cost.
   */
  suppliers: {
    create(input: SupplierInput): Promise<SupplierRow>;
    update(id: string, patch: Partial<SupplierInput>): Promise<SupplierRow | null>;
    findById(id: string): Promise<SupplierRow | null>;
    /** How a marketplace result is matched to a supplier we already know. */
    findByExternal(platform: string, externalId: string): Promise<SupplierRow | null>;
    list(options?: { status?: SupplierStatus; category?: string; limit?: number }): Promise<SupplierRow[]>;
    setStatus(id: string, status: SupplierStatus, riskFlag?: string): Promise<void>;
    /**
     * Record something that happened.
     *
     * Counts, never a score. A stored score cannot be recomputed when the
     * weighting changes and cannot be defended when a supplier disputes it;
     * these four numbers can each be pointed back at individual orders.
     */
    recordOutcome(id: string, outcome: SupplierOutcome): Promise<void>;
    markVerified(id: string, at?: string): Promise<void>;
    /**
     * Create, or update the one already matched by (platform, externalId).
     *
     * Importing a sourcing file twice must not produce two Zanbonds. Matching
     * on the marketplace's own identifier rather than on the company name,
     * because names arrive punctuated differently every time — "Zanbond Group
     * Co., Ltd" and "Zanbond Group Co.,Ltd" are one supplier.
     */
    upsert(input: SupplierInput & SupplierRelationship): Promise<SupplierRow>;
    /** Where the conversation stands, separate from whether the supplier is usable. */
    setRelationship(id: string, relationship: SupplierRelationship): Promise<void>;
    remove(id: string): Promise<void>;
  };

  /**
   * The people at a supplier.
   *
   * A company is not a person: Zanbond may have LEE today and Alice next month,
   * and one contact column on the supplier row means the second either
   * overwrites the first or duplicates the whole company.
   */
  supplierContacts: {
    upsert(supplierId: string, input: SupplierContactInput): Promise<SupplierContactRow>;
    listForSupplier(supplierId: string): Promise<SupplierContactRow[]>;
    remove(id: string): Promise<void>;
  };

  supplierOffers: {
    /** Upsert on (supplier, product, tier) — re-checking a price replaces it. */
    save(input: SupplierOfferInput): Promise<SupplierOfferRow>;
    findById(id: string): Promise<SupplierOfferRow | null>;
    /**
     * Every offer for a product, cheapest applicable tier first.
     *
     * With a quantity, only tiers that quantity actually reaches are returned:
     * a price break at 500 is not a price at 30.
     */
    listForProduct(productId: string, quantity?: number): Promise<SupplierOfferRow[]>;
    listForSupplier(supplierId: string): Promise<SupplierOfferRow[]>;
    /** Offers whose price has not been confirmed since `before`. */
    listStale(before: string, limit?: number): Promise<SupplierOfferRow[]>;
    remove(id: string): Promise<void>;
  };

  qualityChecks: {
    create(input: QualityCheckInput): Promise<QualityCheckRow>;
    findById(id: string): Promise<QualityCheckRow | null>;
    listForOrder(orderId: string): Promise<QualityCheckRow[]>;
    recordOutcome(id: string, outcome: QualityCheckOutcomeInput): Promise<QualityCheckRow | null>;
  };

  shipments: {
    create(input: ShipmentInput): Promise<ShipmentRow>;
    findById(id: string): Promise<ShipmentRow | null>;
    listForOrder(orderId: string): Promise<ShipmentRow[]>;
    update(id: string, patch: Partial<Omit<ShipmentInput, "orderId">>): Promise<ShipmentRow | null>;
  };

  notifications: {
    create(input: NotificationInput): Promise<NotificationRow>;
    findById(id: string): Promise<NotificationRow | null>;
    /** The delivery worker's queue: unsent, oldest first. */
    pending(limit?: number): Promise<NotificationRow[]>;
    listForUser(userId: string, limit?: number): Promise<NotificationRow[]>;
    markSent(id: string, at?: string): Promise<void>;
    /**
     * Record a failed attempt.
     *
     * `maxAttempts` decides whether it is worth trying again or the row is
     * abandoned, so a permanently-bouncing address is not retried until the end
     * of time.
     */
    markFailed(id: string, error: string, maxAttempts?: number): Promise<void>;
  };

  testimonials: {
    create(input: TestimonialInput): Promise<TestimonialRow>;
    findById(id: string): Promise<TestimonialRow | null>;
    /**
     * What the public site may show.
     *
     * Approved only, and there is no variant of this that returns an
     * unapproved row — a quote reaches a visitor because somebody decided it
     * should, never because it exists.
     */
    listApproved(limit?: number): Promise<TestimonialRow[]>;
    listAsAdmin(limit?: number): Promise<TestimonialRow[]>;
    /** Approving requires a recorded consent date; the route enforces it. */
    setApproved(id: string, approved: boolean): Promise<void>;
    remove(id: string): Promise<void>;
  };

  subscribers: {
    /**
     * Record an address, or do nothing if it is already recorded.
     *
     * `added` is returned rather than thrown, because the caller must answer
     * the same thing either way: a form that says "you are already on the list"
     * tells whoever typed the address whether someone else subscribed with it.
     */
    add(input: {
      email: string;
      locale?: string;
      source?: string;
      name?: string;
      business?: string;
      interest?: string;
      quantity?: number;
    }): Promise<{ added: boolean }>;
    count(): Promise<number>;
    listAsAdmin(limit?: number): Promise<SubscriberRow[]>;
    remove(email: string): Promise<void>;
  };

  /**
   * The margins and minimums, editable without a deploy.
   *
   * `read` returns null when nothing has been saved, so the caller decides what
   * the default is. A repository that invented a 27% margin because the table
   * was empty would be picking a business decision.
   */
  pricingPolicy: {
    read(): Promise<PricingPolicyRow | null>;
    save(input: PricingPolicyRow, updatedBy?: string): Promise<void>;
  };
}

/**
 * The stored form of a pricing policy.
 *
 * Rates are fractions and money is minor units, matching the rest of the
 * schema. Kept structural rather than importing the server's `PricingPolicy`,
 * because the database package must not depend on the server package.
 */
export interface PricingPolicyRow {
  currency: string;
  bands: { upToCost: number | null; targetMargin: number; label: string }[];
  repeatCustomerMargin?: number;
  minimumMargin: number;
  minimumOrderValue: number;
  minimumGrossProfit: number;
  contingencyRate: number;
  paymentFeeRate: number;
  roundingStep: number;
  sampleCreditedToProduction: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

/** Where the conversation with a supplier stands. */
export interface SupplierRelationship {
  relationship?: string;
  lastContactAt?: string;
  nextAction?: string;
}

export interface SupplierContactInput {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  /** Where the conversation happens — a platform messenger, WhatsApp, email. */
  channel?: string;
  /**
   * A contact detail that arrived without a name attached.
   *
   * Recorded rather than dropped, and never attributed to whoever happened to
   * be listed first: a phone number filed against the wrong salesperson is
   * worse than one filed against nobody.
   */
  unassigned?: boolean;
  notes?: string;
}

export interface SupplierContactRow {
  id: string;
  supplierId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  channel?: string;
  unassigned: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** A contact row, read back. */
function readContact(row: Row): SupplierContactRow {
  return {
    id: text(row["id"]),
    supplierId: text(row["supplier_id"]),
    name: text(row["name"]),
    ...(optionalText(row["role"]) ? { role: text(row["role"]) } : {}),
    ...(optionalText(row["email"]) ? { email: text(row["email"]) } : {}),
    ...(optionalText(row["phone"]) ? { phone: text(row["phone"]) } : {}),
    ...(optionalText(row["whatsapp"]) ? { whatsapp: text(row["whatsapp"]) } : {}),
    ...(optionalText(row["channel"]) ? { channel: text(row["channel"]) } : {}),
    unassigned: int(row["unassigned"]) === 1,
    ...(optionalText(row["notes"]) ? { notes: text(row["notes"]) } : {}),
    createdAt: text(row["created_at"]),
    updatedAt: text(row["updated_at"]),
  };
}

export interface SupplierInput {
  name: string;
  platform: string;
  externalId?: string;
  externalUrl?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  categories?: readonly string[];
  certifications?: readonly string[];
  customization?: readonly string[];
  minimumOrder?: number;
  leadTimeDays?: number;
  status?: SupplierStatus;
  riskFlag?: string;
  notes?: string;
}

export interface SupplierOutcome {
  completed?: boolean;
  late?: boolean;
  defect?: boolean;
  dispute?: boolean;
}

export interface SupplierOfferInput {
  supplierId: string;
  productId: string;
  externalProductId?: string;
  externalProductUrl?: string;
  fromQuantity?: number;
  unitCost: number;
  currency: CurrencyCode;
  customizationCost?: number;
  setupCost?: number;
  minimumOrder?: number;
  availableQuantity?: number;
  productionDays?: number;
  shippingCost?: number;
  customization?: readonly string[];
  lastCheckedAt?: string;
}

export interface QualityCheckInput {
  orderId: string;
  kind: QualityCheckRow["kind"];
  inspectedBy: string;
  outcome?: QualityOutcome;
  defects?: readonly string[];
  notes?: string;
  evidence?: readonly string[];
}

export interface QualityCheckOutcomeInput {
  outcome: QualityOutcome;
  defects?: readonly string[];
  notes?: string;
  evidence?: readonly string[];
  inspectedAt?: string;
}

export interface ShipmentInput {
  orderId: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status?: ShipmentStatus;
  estimatedDelivery?: string;
  actualDelivery?: string;
  exceptionNote?: string;
}

export interface SubscriberRow {
  id: string;
  email: string;
  locale: string;
  source: string;
  /** Optional on the form, so optional here. Absent means not asked, not empty. */
  name?: string;
  business?: string;
  interest?: string;
  quantity?: number;
  createdAt: string;
}

export interface TestimonialRow {
  id: string;
  quote: string;
  authorName: string;
  authorRole?: string;
  company?: string;
  country?: string;
  locale: string;
  approved: boolean;
  consentAt?: string;
  position: number;
  createdAt: string;
}

export interface TestimonialInput {
  quote: string;
  authorName: string;
  authorRole?: string;
  company?: string;
  country?: string;
  locale?: string;
  /** When the person agreed to be quoted publicly. Required to approve. */
  consentAt?: string;
  position?: number;
}

export interface NotificationInput {
  userId: string;
  orderId?: string;
  kind: string;
  channel: NotificationRow["channel"];
  subject: string;
  body: string;
  recipientEmail?: string;
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

    passwordResets: {
      async create(userId, token, expiresAt) {
        await run(`INSERT INTO password_resets (token,user_id,expires_at,created_at) VALUES (?,?,?,?)`,
          token, userId, expiresAt, nowIso(),
        );
      },

      async find(token) {
        const row = await get(`SELECT * FROM password_resets WHERE token = ?`, token);
        return row
          ? {
              token: text(row["token"]),
              userId: text(row["user_id"]),
              expiresAt: text(row["expires_at"]),
              usedAt: optionalText(row["used_at"]) ?? null,
            }
          : null;
      },

      async markUsed(token) {
        await run(`UPDATE password_resets SET used_at = ? WHERE token = ?`, nowIso(), token);
      },

      async destroyAllFor(userId) {
        await run(`DELETE FROM password_resets WHERE user_id = ?`, userId);
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
          personality: fromJsonArray<string>(row["personality"], []),
          promise: text(row["promise"]),
          mission: text(row["mission"]),
          vision: text(row["vision"]),
          slogan: text(row["slogan"]),
          toneOfVoice: text(row["tone_of_voice"]),
          brandStory: text(row["brand_story"]),
          nameAlternatives: fromJsonArray<string>(row["name_alternatives"], []),
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
          palette: fromJsonArray<ColorSwatch>(row["palette"], []),
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

      async notificationTarget(orderId) {
        const row = await get(`SELECT user_id, reference FROM orders WHERE id = ?`, orderId);
        return row ? { userId: text(row["user_id"]), reference: text(row["reference"]) } : null;
      },

      async findAsAdmin(id) {
        const row = await get(`SELECT * FROM orders WHERE id = ?`, id);
        return row ? toOrder(row) : null;
      },

      async listAsAdmin(limit = 100) {
        return (await all(`SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`, limit)).map(toOrder);
      },
    },

    /* --- Suppliers -------------------------------------------------------- */

    suppliers: {
      async create(input) {
        const now = nowIso();
        const id = newId("supplier");
        await run(`INSERT INTO suppliers
             (id,name,platform,external_id,external_url,country,city,latitude,longitude,
              contact_name,contact_email,contact_phone,
              categories,certifications,customization,
              minimum_order,lead_time_days,status,risk_flag,notes,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          id, input.name.trim(), input.platform,
          input.externalId ?? null, input.externalUrl ?? null,
          input.country ?? null, input.city ?? null,
          input.latitude ?? null, input.longitude ?? null,
          input.contactName ?? null, input.contactEmail ?? null, input.contactPhone ?? null,
          toJson(input.categories ?? []), toJson(input.certifications ?? []),
          toJson(input.customization ?? []),
          input.minimumOrder ?? 1, input.leadTimeDays ?? null,
          // A supplier nobody has checked is `unverified`, not `active`. §12:
          // a new supplier cannot take a large order without a sample, and the
          // authorisation rule reads this column to know that.
          input.status ?? "unverified",
          input.riskFlag ?? null, input.notes ?? null, now, now,
        );
        const row = await get(`SELECT * FROM suppliers WHERE id = ?`, id);
        if (!row) throw new Error("supplier vanished immediately after insert");
        return toSupplier(row);
      },

      async update(id, patch) {
        // Built from the keys actually present, so an omitted field is left
        // alone rather than overwritten with undefined.
        const columns: Record<string, unknown> = {};
        const set = <K extends keyof SupplierInput>(key: K, column: string, map?: (value: NonNullable<SupplierInput[K]>) => unknown) => {
          if (!(key in patch)) return;
          const value = patch[key];
          columns[column] = value === undefined || value === null ? null : map ? map(value as NonNullable<SupplierInput[K]>) : value;
        };

        set("name", "name", (value) => String(value).trim());
        set("platform", "platform");
        set("externalId", "external_id");
        set("externalUrl", "external_url");
        set("country", "country");
        set("city", "city");
        set("latitude", "latitude");
        set("longitude", "longitude");
        set("contactName", "contact_name");
        set("contactEmail", "contact_email");
        set("contactPhone", "contact_phone");
        set("categories", "categories", toJson);
        set("certifications", "certifications", toJson);
        set("customization", "customization", toJson);
        set("minimumOrder", "minimum_order");
        set("leadTimeDays", "lead_time_days");
        set("status", "status");
        set("riskFlag", "risk_flag");
        set("notes", "notes");

        const names = Object.keys(columns);
        if (names.length > 0) {
          // Column names come from the fixed list above, never from the caller.
          await run(
            `UPDATE suppliers SET ${names.map((name) => `${name} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
            ...names.map((name) => columns[name]), nowIso(), id,
          );
        }

        const row = await get(`SELECT * FROM suppliers WHERE id = ?`, id);
        return row ? toSupplier(row) : null;
      },

      async findById(id) {
        const row = await get(`SELECT * FROM suppliers WHERE id = ?`, id);
        return row ? toSupplier(row) : null;
      },

      async findByExternal(platform, externalId) {
        const row = await get(
          `SELECT * FROM suppliers WHERE platform = ? AND external_id = ?`,
          platform, externalId,
        );
        return row ? toSupplier(row) : null;
      },

      async list(options = {}) {
        const where: string[] = [];
        const params: unknown[] = [];
        if (options.status) {
          where.push("status = ?");
          params.push(options.status);
        }
        if (options.category) {
          // The categories column is JSON on both backends, and the two
          // disagree about how to index into it. A LIKE on the serialised
          // array is portable, and the quoted form stops "cup" matching
          // "cupboard".
          where.push("categories LIKE ?");
          params.push(`%"${options.category}"%`);
        }
        const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
        const rows = await all(
          `SELECT * FROM suppliers ${clause} ORDER BY name ASC LIMIT ?`,
          ...params, options.limit ?? 200,
        );
        return rows.map(toSupplier);
      },

      async setStatus(id, status, riskFlag) {
        await run(
          `UPDATE suppliers SET status = ?, risk_flag = ?, updated_at = ? WHERE id = ?`,
          status, riskFlag ?? null, nowIso(), id,
        );
      },

      async recordOutcome(id, outcome) {
        // Incremented in SQL rather than read-modify-written, so two orders
        // completing at the same moment do not lose one of the counts.
        const increments = [
          outcome.completed ? "completed_orders = completed_orders + 1" : "",
          outcome.late ? "late_orders = late_orders + 1" : "",
          outcome.defect ? "defect_reports = defect_reports + 1" : "",
          outcome.dispute ? "disputes = disputes + 1" : "",
        ].filter(Boolean);
        if (increments.length === 0) return;
        await run(
          `UPDATE suppliers SET ${increments.join(", ")}, updated_at = ? WHERE id = ?`,
          nowIso(), id,
        );
      },

      async markVerified(id, at) {
        const now = nowIso();
        await run(
          `UPDATE suppliers SET verified_at = ?, status = CASE WHEN status = 'unverified' THEN 'active' ELSE status END, updated_at = ? WHERE id = ?`,
          at ?? now, now, id,
        );
      },

      async upsert(input) {
        const existing = input.externalId
          ? await this.findByExternal(input.platform, input.externalId)
          : null;

        const relationship = {
          ...(input.relationship ? { relationship: input.relationship } : {}),
          ...(input.lastContactAt ? { lastContactAt: input.lastContactAt } : {}),
          ...(input.nextAction ? { nextAction: input.nextAction } : {}),
        };

        if (existing) {
          const patched = await this.update(existing.id, input);
          if (Object.keys(relationship).length > 0) {
            await this.setRelationship(existing.id, relationship);
          }
          return patched ?? existing;
        }

        const created = await this.create(input);
        if (Object.keys(relationship).length > 0) {
          await this.setRelationship(created.id, relationship);
        }
        return created;
      },

      async setRelationship(id, relationship) {
        const now = nowIso();
        // Only the fields given. A partial update from an import must not wipe
        // a next action somebody typed into the admin screen this morning.
        if (relationship.relationship !== undefined) {
          await run(`UPDATE suppliers SET relationship = ?, updated_at = ? WHERE id = ?`,
            relationship.relationship, now, id);
        }
        if (relationship.lastContactAt !== undefined) {
          await run(`UPDATE suppliers SET last_contact_at = ?, updated_at = ? WHERE id = ?`,
            relationship.lastContactAt, now, id);
        }
        if (relationship.nextAction !== undefined) {
          await run(`UPDATE suppliers SET next_action = ?, updated_at = ? WHERE id = ?`,
            relationship.nextAction, now, id);
        }
      },

      async remove(id) {
        await run(`DELETE FROM suppliers WHERE id = ?`, id);
      },
    },

    /* --- The people at a supplier ----------------------------------------- */

    supplierContacts: {
      async upsert(supplierId, input) {
        const now = nowIso();
        // Matched on name within the supplier: re-importing the same file must
        // update LEE rather than add a second LEE. Two genuinely different
        // people with one name at one company is a collision worth accepting
        // over a duplicate on every import.
        const existing = await get(
          `SELECT * FROM supplier_contacts WHERE supplier_id = ? AND name = ?`,
          supplierId, input.name,
        );

        const id = existing ? text(existing["id"]) : newId("supplierContact");
        if (existing) {
          await run(
            `UPDATE supplier_contacts
                SET role = ?, email = ?, phone = ?, whatsapp = ?, channel = ?,
                    unassigned = ?, notes = ?, updated_at = ?
              WHERE id = ?`,
            input.role ?? null, input.email ?? null, input.phone ?? null,
            input.whatsapp ?? null, input.channel ?? null,
            input.unassigned ? 1 : 0, input.notes ?? null, now, id,
          );
        } else {
          await run(
            `INSERT INTO supplier_contacts
               (id, supplier_id, name, role, email, phone, whatsapp, channel, unassigned, notes, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            id, supplierId, input.name, input.role ?? null, input.email ?? null,
            input.phone ?? null, input.whatsapp ?? null, input.channel ?? null,
            input.unassigned ? 1 : 0, input.notes ?? null, now, now,
          );
        }

        const row = await get(`SELECT * FROM supplier_contacts WHERE id = ?`, id);
        return readContact(row!);
      },

      async listForSupplier(supplierId) {
        const rows = await all(
          `SELECT * FROM supplier_contacts WHERE supplier_id = ? ORDER BY unassigned, name`,
          supplierId,
        );
        return rows.map(readContact);
      },

      async remove(id) {
        await run(`DELETE FROM supplier_contacts WHERE id = ?`, id);
      },
    },

    /* --- Supplier offers -------------------------------------------------- */

    supplierOffers: {
      async save(input) {
        const now = nowIso();
        const id = newId("supplierProduct");
        const fromQuantity = input.fromQuantity ?? 1;

        await run(`INSERT INTO supplier_offers
             (id,supplier_id,product_id,external_product_id,external_product_url,
              from_quantity,unit_cost,currency,customization_cost,setup_cost,
              minimum_order,available_quantity,production_days,shipping_cost,
              customization,last_checked_at,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(supplier_id,product_id,from_quantity) DO UPDATE SET
             external_product_id  = excluded.external_product_id,
             external_product_url = excluded.external_product_url,
             unit_cost            = excluded.unit_cost,
             currency             = excluded.currency,
             customization_cost   = excluded.customization_cost,
             setup_cost           = excluded.setup_cost,
             minimum_order        = excluded.minimum_order,
             available_quantity   = excluded.available_quantity,
             production_days      = excluded.production_days,
             shipping_cost        = excluded.shipping_cost,
             customization        = excluded.customization,
             last_checked_at      = excluded.last_checked_at,
             updated_at           = excluded.updated_at`,
          id, input.supplierId, input.productId,
          input.externalProductId ?? null, input.externalProductUrl ?? null,
          fromQuantity, input.unitCost, input.currency,
          input.customizationCost ?? 0, input.setupCost ?? 0,
          input.minimumOrder ?? fromQuantity, input.availableQuantity ?? 0,
          input.productionDays ?? null, input.shippingCost ?? null,
          toJson(input.customization ?? []),
          input.lastCheckedAt ?? now, now, now,
        );

        // Read back by the unique key rather than by `id`: on an update the
        // row that exists is the one already there, not the id we generated.
        const row = await get(
          `SELECT * FROM supplier_offers WHERE supplier_id = ? AND product_id = ? AND from_quantity = ?`,
          input.supplierId, input.productId, fromQuantity,
        );
        if (!row) throw new Error("supplier offer vanished immediately after write");
        return toOffer(row);
      },

      async findById(id) {
        const row = await get(`SELECT * FROM supplier_offers WHERE id = ?`, id);
        return row ? toOffer(row) : null;
      },

      async listForProduct(productId, quantity) {
        if (quantity === undefined) {
          return (await all(
            `SELECT * FROM supplier_offers WHERE product_id = ? ORDER BY unit_cost ASC, from_quantity DESC`,
            productId,
          )).map(toOffer);
        }
        // The tier that applies is the highest break at or below the quantity,
        // and the supplier's own minimum still has to be met. Ordered by tier
        // descending so the caller taking the first row per supplier gets the
        // right price rather than the list price.
        return (await all(
          `SELECT * FROM supplier_offers
             WHERE product_id = ? AND from_quantity <= ? AND minimum_order <= ?
             ORDER BY unit_cost ASC, from_quantity DESC`,
          productId, quantity, quantity,
        )).map(toOffer);
      },

      async listForSupplier(supplierId) {
        return (await all(
          `SELECT * FROM supplier_offers WHERE supplier_id = ? ORDER BY product_id ASC, from_quantity ASC`,
          supplierId,
        )).map(toOffer);
      },

      async listStale(before, limit = 200) {
        return (await all(
          `SELECT * FROM supplier_offers WHERE last_checked_at < ? ORDER BY last_checked_at ASC LIMIT ?`,
          before, limit,
        )).map(toOffer);
      },

      async remove(id) {
        await run(`DELETE FROM supplier_offers WHERE id = ?`, id);
      },
    },

    /* --- Quality checks --------------------------------------------------- */

    qualityChecks: {
      async create(input) {
        const now = nowIso();
        const id = newId("qualityCheck");
        await run(`INSERT INTO quality_checks
             (id,order_id,kind,outcome,inspected_by,defects,notes,evidence,inspected_at,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          id, input.orderId, input.kind, input.outcome ?? "pending", input.inspectedBy,
          toJson(input.defects ?? []), input.notes ?? null, toJson(input.evidence ?? []),
          // `inspected_at` stays null until someone actually looked. A check
          // that was opened is not a check that was carried out.
          null, now, now,
        );
        const row = await get(`SELECT * FROM quality_checks WHERE id = ?`, id);
        if (!row) throw new Error("quality check vanished immediately after insert");
        return toQualityCheck(row);
      },

      async findById(id) {
        const row = await get(`SELECT * FROM quality_checks WHERE id = ?`, id);
        return row ? toQualityCheck(row) : null;
      },

      async listForOrder(orderId) {
        return (await all(
          `SELECT * FROM quality_checks WHERE order_id = ? ORDER BY created_at ASC`,
          orderId,
        )).map(toQualityCheck);
      },

      async recordOutcome(id, outcome) {
        const now = nowIso();
        await run(`UPDATE quality_checks
             SET outcome = ?, defects = ?, notes = ?, evidence = ?, inspected_at = ?, updated_at = ?
             WHERE id = ?`,
          outcome.outcome, toJson(outcome.defects ?? []), outcome.notes ?? null,
          toJson(outcome.evidence ?? []),
          outcome.outcome === "pending" ? null : (outcome.inspectedAt ?? now),
          now, id,
        );
        const row = await get(`SELECT * FROM quality_checks WHERE id = ?`, id);
        return row ? toQualityCheck(row) : null;
      },
    },

    /* --- Shipments -------------------------------------------------------- */

    shipments: {
      async create(input) {
        const now = nowIso();
        const id = newId("shipment");
        await run(`INSERT INTO shipments
             (id,order_id,carrier,tracking_number,tracking_url,status,
              estimated_delivery,actual_delivery,exception_note,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          id, input.orderId, input.carrier ?? null,
          input.trackingNumber ?? null, input.trackingUrl ?? null,
          input.status ?? "preparing",
          // Only ever what a carrier gave us. §38: never a guess dressed up as
          // a date the customer can plan around.
          input.estimatedDelivery ?? null, input.actualDelivery ?? null,
          input.exceptionNote ?? null, now, now,
        );
        const row = await get(`SELECT * FROM shipments WHERE id = ?`, id);
        if (!row) throw new Error("shipment vanished immediately after insert");
        return toShipment(row);
      },

      async findById(id) {
        const row = await get(`SELECT * FROM shipments WHERE id = ?`, id);
        return row ? toShipment(row) : null;
      },

      async listForOrder(orderId) {
        return (await all(
          `SELECT * FROM shipments WHERE order_id = ? ORDER BY created_at ASC`,
          orderId,
        )).map(toShipment);
      },

      async update(id, patch) {
        const columns: Record<string, unknown> = {};
        const map: Record<string, string> = {
          carrier: "carrier",
          trackingNumber: "tracking_number",
          trackingUrl: "tracking_url",
          status: "status",
          estimatedDelivery: "estimated_delivery",
          actualDelivery: "actual_delivery",
          exceptionNote: "exception_note",
        };
        for (const [key, column] of Object.entries(map)) {
          if (!(key in patch)) continue;
          columns[column] = (patch as Record<string, unknown>)[key] ?? null;
        }

        const names = Object.keys(columns);
        if (names.length > 0) {
          await run(
            `UPDATE shipments SET ${names.map((name) => `${name} = ?`).join(", ")}, updated_at = ? WHERE id = ?`,
            ...names.map((name) => columns[name]), nowIso(), id,
          );
        }

        const row = await get(`SELECT * FROM shipments WHERE id = ?`, id);
        return row ? toShipment(row) : null;
      },
    },

    /* --- Notifications ---------------------------------------------------- */

    notifications: {
      async create(input) {
        const now = nowIso();
        const id = newId("notification");
        await run(`INSERT INTO notifications
             (id,user_id,order_id,kind,channel,subject,body,recipient_email,status,attempts,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          id, input.userId, input.orderId ?? null, input.kind, input.channel,
          input.subject, input.body, input.recipientEmail ?? null, "pending", 0, now, now,
        );
        const row = await get(`SELECT * FROM notifications WHERE id = ?`, id);
        if (!row) throw new Error("notification vanished immediately after insert");
        return toNotification(row);
      },

      async findById(id) {
        const row = await get(`SELECT * FROM notifications WHERE id = ?`, id);
        return row ? toNotification(row) : null;
      },

      async pending(limit = 50) {
        return (await all(
          `SELECT * FROM notifications WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
          limit,
        )).map(toNotification);
      },

      async listForUser(userId, limit = 50) {
        return (await all(
          `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
          userId, limit,
        )).map(toNotification);
      },

      async markSent(id, at) {
        const now = nowIso();
        await run(
          `UPDATE notifications SET status = ?, attempts = attempts + 1, sent_at = ?, last_error = NULL, updated_at = ? WHERE id = ?`,
          "sent", at ?? now, now, id,
        );
      },

      async markFailed(id, error, maxAttempts = 5) {
        const now = nowIso();
        // `pending` means it will be picked up again; `abandoned` means it will
        // not. Deciding that here rather than in the worker keeps a crashed
        // worker from silently retrying a dead address for ever.
        await run(`UPDATE notifications
             SET attempts    = attempts + 1,
                 last_error  = ?,
                 status      = CASE WHEN attempts + 1 >= ? THEN 'abandoned' ELSE 'pending' END,
                 updated_at  = ?
             WHERE id = ?`,
          error.slice(0, 500), maxAttempts, now, id,
        );
      },
    },

    /* --- Testimonials ----------------------------------------------------- */

    testimonials: {
      async create(input) {
        const now = nowIso();
        const id = newId("testimonial");
        await run(`INSERT INTO testimonials
             (id,quote,author_name,author_role,company,country,locale,approved,consent_at,position,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          id, input.quote.trim(), input.authorName.trim(),
          input.authorRole ?? null, input.company ?? null, input.country ?? null,
          input.locale ?? "en",
          // Never approved on creation. Something typed into an admin form is
          // a draft until a person says otherwise, and the site shows approved
          // rows only.
          0,
          input.consentAt ?? null, input.position ?? 0, now, now,
        );
        const row = await get(`SELECT * FROM testimonials WHERE id = ?`, id);
        if (!row) throw new Error("testimonial vanished immediately after insert");
        return toTestimonial(row);
      },

      async findById(id) {
        const row = await get(`SELECT * FROM testimonials WHERE id = ?`, id);
        return row ? toTestimonial(row) : null;
      },

      async listApproved(limit = 12) {
        return (await all(
          `SELECT * FROM testimonials WHERE approved = 1 ORDER BY position ASC, created_at ASC LIMIT ?`,
          limit,
        )).map(toTestimonial);
      },

      async listAsAdmin(limit = 200) {
        return (await all(
          `SELECT * FROM testimonials ORDER BY approved DESC, position ASC, created_at DESC LIMIT ?`,
          limit,
        )).map(toTestimonial);
      },

      async setApproved(id, approved) {
        await run(`UPDATE testimonials SET approved = ?, updated_at = ? WHERE id = ?`,
          approved ? 1 : 0, nowIso(), id);
      },

      async remove(id) {
        await run(`DELETE FROM testimonials WHERE id = ?`, id);
      },
    },

    /* --- Subscribers ------------------------------------------------------ */

    subscribers: {
      async add(input) {
        const email = input.email.trim().toLowerCase();
        const id = newId("subscriber");

        // ON CONFLICT DO NOTHING rather than a SELECT then an INSERT: two people
        // submitting the same address at the same moment would both see no row
        // and both insert, and one of them would get a UNIQUE violation as a
        // 500 on a newsletter form.
        await run(
          `INSERT INTO subscribers (id,email,locale,source,name,business,interest,quantity,created_at)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(email) DO NOTHING`,
          id,
          email,
          input.locale ?? "en",
          input.source ?? "homepage",
          // Null rather than "" for anything unanswered: a blank string reads
          // as "they were asked and said nothing", and these fields are
          // optional precisely so that people can skip them.
          input.name ?? null,
          input.business ?? null,
          input.interest ?? null,
          input.quantity ?? null,
          nowIso(),
        );

        // Whether *this* call was the one that added it, decided by reading the
        // id back rather than by looking before the insert — a check-then-insert
        // has a gap between the two and this does not. The id is used rather
        // than the timestamp because two submissions in the same millisecond
        // share a timestamp, and the first version of this reported both as
        // new. Used for the log; never for what the visitor is told.
        const row = await get(`SELECT id FROM subscribers WHERE email = ?`, email);
        return { added: row !== null && text(row["id"]) === id };
      },

      async count() {
        const row = await get(`SELECT COUNT(*) AS n FROM subscribers`);
        return int(row?.["n"]);
      },

      async listAsAdmin(limit = 500) {
        return (await all(`SELECT * FROM subscribers ORDER BY created_at DESC LIMIT ?`, limit)).map((row) => ({
          id: text(row["id"]),
          email: text(row["email"]),
          locale: text(row["locale"]),
          source: text(row["source"]),
          ...(optionalText(row["name"]) ? { name: optionalText(row["name"]) as string } : {}),
          ...(optionalText(row["business"]) ? { business: optionalText(row["business"]) as string } : {}),
          ...(optionalText(row["interest"]) ? { interest: optionalText(row["interest"]) as string } : {}),
          // A quantity of 0 is not a quantity anybody typed; null and 0 both
          // mean "not stated" here, and neither should render as "0 units".
          ...(typeof row["quantity"] === "number" && row["quantity"] > 0
            ? { quantity: row["quantity"] }
            : {}),
          createdAt: text(row["created_at"]),
        }));
      },

      async remove(email) {
        await run(`DELETE FROM subscribers WHERE email = ?`, email.trim().toLowerCase());
      },
    },

    /* --- Pricing policy --------------------------------------------------- */

    pricingPolicy: {
      async read() {
        const row = await get(`SELECT * FROM pricing_policy WHERE id = 'current'`);
        if (!row) return null;

        const bands = fromJson<PricingPolicyRow["bands"]>(row["bands"], []);
        const repeat = row["repeat_customer_margin"];

        return {
          currency: text(row["currency"]),
          bands,
          // A null repeat margin means "no loyalty rate", which is not the same
          // as a loyalty rate of zero.
          ...(typeof repeat === "number" ? { repeatCustomerMargin: repeat } : {}),
          minimumMargin: Number(row["minimum_margin"] ?? 0),
          minimumOrderValue: int(row["minimum_order_value"]),
          minimumGrossProfit: int(row["minimum_gross_profit"]),
          contingencyRate: Number(row["contingency_rate"] ?? 0),
          paymentFeeRate: Number(row["payment_fee_rate"] ?? 0),
          roundingStep: int(row["rounding_step"]),
          // SQLite has no boolean; Postgres returns the integer it was given.
          sampleCreditedToProduction: int(row["sample_credited"]) === 1,
          updatedAt: text(row["updated_at"]),
          ...(optionalText(row["updated_by"]) ? { updatedBy: text(row["updated_by"]) } : {}),
        } satisfies PricingPolicyRow;
      },

      async save(input, updatedBy) {
        // One row, replaced wholesale. A partial update would let a half-saved
        // policy price an order — a new margin against an old minimum.
        await run(`DELETE FROM pricing_policy WHERE id = 'current'`);
        await run(
          `INSERT INTO pricing_policy (
             id, currency, bands, repeat_customer_margin, minimum_margin,
             minimum_order_value, minimum_gross_profit, contingency_rate,
             payment_fee_rate, rounding_step, sample_credited, updated_at, updated_by
           ) VALUES ('current',?,?,?,?,?,?,?,?,?,?,?,?)`,
          input.currency,
          toJson(input.bands),
          input.repeatCustomerMargin ?? null,
          input.minimumMargin,
          input.minimumOrderValue,
          input.minimumGrossProfit,
          input.contingencyRate,
          input.paymentFeeRate,
          input.roundingStep,
          input.sampleCreditedToProduction ? 1 : 0,
          nowIso(),
          updatedBy ?? null,
        );
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
