/**
 * The fulfilment lifecycle, and the human gate in the middle of it.
 *
 * §17 is the rule this file exists for: **AI does not have unrestricted
 * authority to place supplier orders.** A paid order does not go to a supplier;
 * it goes to `awaiting-approval`, and a named administrator moves it on. That
 * is the whole protection while the sourcing infrastructure is young, and it is
 * worth nothing if it lives only in a document.
 *
 * So it lives in a transition table, and every move is checked against it. The
 * previous shape — an admin route that accepted any valid status name and wrote
 * it — meant an order could go from `pending` straight to `shipped`, skipping
 * the approval, the production record and the quality check. Every one of those
 * is a promise to a customer, and none of them was enforced.
 */

import { ValidationError } from "@brandora/shared";
import type { FulfillmentStatus, PaymentStatus } from "@brandora/database";

/**
 * The journey, in the order a customer experiences it.
 *
 *   pending → awaiting-approval → sourcing → processing
 *           → quality-check → shipped → delivered
 *
 * `confirmed` is kept as the state a paid order lands in before an
 * administrator has looked at it, so an existing order does not become
 * unroutable when this ships.
 */
export const FULFILMENT_FLOW: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["awaiting-approval", "cancelled"],
  // The gate. Nothing reaches a supplier from here without a person.
  "awaiting-approval": ["sourcing", "cancelled"],
  sourcing: ["processing", "cancelled"],
  processing: ["quality-check", "cancelled"],
  "quality-check": ["shipped", "processing", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const FULFILMENT_STATUSES = Object.keys(FULFILMENT_FLOW) as FulfillmentStatus[];

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
];

/**
 * Steps that spend Brandora's money or make a claim to the customer.
 *
 * Listed so the reason for the gate is legible rather than implied by position
 * in a table: `sourcing` is where an order is placed with a supplier, and
 * `shipped` and `delivered` are assertions a customer will plan around.
 */
export const REQUIRES_HUMAN: readonly FulfillmentStatus[] = [
  "sourcing",
  "quality-check",
  "shipped",
  "delivered",
];

/** What a customer should read for each state. */
export const FULFILMENT_LABELS: Record<FulfillmentStatus, string> = {
  pending: "Waiting to be confirmed",
  confirmed: "Confirmed",
  "awaiting-approval": "With our team for approval",
  sourcing: "Sourcing your products",
  processing: "In production",
  "quality-check": "Being checked before it ships",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function isFulfilmentStatus(value: string): value is FulfillmentStatus {
  return Object.prototype.hasOwnProperty.call(FULFILMENT_FLOW, value);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Refuse a move the lifecycle does not allow.
 *
 * The message names both ends and what *is* allowed, because the person reading
 * it is an operator with an order in front of them, not a developer with a
 * stack trace.
 */
export function assertFulfilmentTransition(from: FulfillmentStatus, to: FulfillmentStatus): void {
  if (from === to) {
    throw new ValidationError("fulfillmentStatus", `order is already ${from}`);
  }
  const allowed = FULFILMENT_FLOW[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ValidationError(
      "fulfillmentStatus",
      `cannot move an order from ${from} to ${to}. From ${from} it can go to: ${
        allowed.length > 0 ? allowed.join(", ") : "nowhere — it is a final state"
      }`,
    );
  }
}

/**
 * Where a paid order goes next.
 *
 * Not to a supplier. A settled payment means Brandora owes the customer goods,
 * and the next actor is a person on the operations side — which is exactly the
 * step §17 requires and the step an automated pipeline would skip.
 */
export const AFTER_PAYMENT: FulfillmentStatus = "awaiting-approval";
