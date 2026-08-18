/**
 * Notification delivery.
 *
 * `docs/status.md` listed notifications as partial with one sentence against
 * them: *nothing is sent*. A row saying "we meant to email them" is worth
 * nothing during a complaint, and worse than nothing on a dashboard, because it
 * looks like the customer was told.
 *
 * So delivery is two separable things and this file keeps them separate.
 *
 * **The record** is written first, always, by whoever caused the event. It
 * exists whether or not a transport is configured, because the fact that a
 * customer should have been told about their payment is worth keeping even in
 * a deployment that cannot yet send email.
 *
 * **The attempt** is made against that record and its outcome is written back.
 * `sent` means a provider accepted it. `failed`/`pending` means it will be
 * tried again. `abandoned` means it will not. Nothing here ever marks a row
 * `sent` because the code path completed — only because a transport said so.
 *
 * When no transport is configured the queue simply fills. That is the honest
 * state: an administrator can see exactly what would have gone out, and
 * connecting a provider drains it. It is not reported as delivered.
 */

import type { NotificationRow, Repositories } from "@brandora/database";

export interface OutboundMessage {
  to: string;
  subject: string;
  body: string;
  /** For the transport's own logging. Never shown to the recipient. */
  kind: string;
}

export interface NotificationTransport {
  readonly name: string;
  readonly configured: boolean;
  /** Resolves only when a provider accepted the message. Throws otherwise. */
  send(message: OutboundMessage): Promise<void>;
}

/** The HTTP call, injected so a transport is testable without a network. */
export type NotificationHttp = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; text: string }>;

const fetchHttp: NotificationHttp = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, text: await response.text() };
};

/**
 * What Brandora does before an email provider is connected.
 *
 * It refuses. A transport that quietly succeeds would mark every queued row
 * `sent` and destroy the only evidence that the customer was never told.
 */
export class UnconfiguredTransport implements NotificationTransport {
  readonly name = "not-configured";
  readonly configured = false;

  async send(): Promise<never> {
    throw new Error("no notification transport is configured");
  }
}

/**
 * Email over Resend's HTTPS API.
 *
 * Chosen over SMTP because a serverless function cannot hold a connection open
 * and because it needs no dependency: one POST, one status code. The key is
 * read from the environment by the caller and never leaves this process — it
 * appears in exactly one header, and the error path below reports the status
 * and the recipient, never the request.
 */
export class ResendTransport implements NotificationTransport {
  readonly name = "resend";
  readonly configured = true;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly http: NotificationHttp = fetchHttp,
    private readonly endpoint = "https://api.resend.com/emails",
  ) {}

  async send(message: OutboundMessage): Promise<void> {
    const response = await this.http(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.body,
      }),
    });

    if (response.status >= 300) {
      // The body can carry a provider message worth keeping, but it is
      // truncated: it ends up in `notifications.last_error`, which an admin
      // reads, and an unbounded provider response does not belong in a column.
      throw new Error(`resend returned ${response.status}: ${response.text.slice(0, 200)}`);
    }
  }
}

/**
 * Pick a transport from the environment.
 *
 * Never throws for a missing credential — an unconfigured deployment gets a
 * transport that refuses, not a crash at boot.
 */
export function resolveNotificationTransport(
  source: Record<string, string | undefined> = process.env,
  http?: NotificationHttp,
): NotificationTransport {
  const key = (source["RESEND_API_KEY"] ?? "").trim();
  const from = (source["BRANDORA_EMAIL_FROM"] ?? "").trim();
  // Both, or neither. A key with no From address produces a 422 on every
  // single send, which is a queue full of `abandoned` rows and no email.
  if (key === "" || from === "") return new UnconfiguredTransport();
  return new ResendTransport(key, from, http);
}

export interface DeliveryReport {
  attempted: number;
  sent: number;
  failed: number;
  /** True when nothing was tried because no transport is configured. */
  skipped: boolean;
  transport: string;
}

/**
 * Attempt delivery of one queued notification.
 *
 * The address is looked up from the account rather than stored on the row, so
 * a customer who corrects their email gets the retry at the new one — and so a
 * notification row can never carry a stale address that nobody can trace back
 * to a person.
 */
export async function deliverOne(
  repos: Repositories,
  transport: NotificationTransport,
  notification: NotificationRow,
  maxAttempts = 5,
): Promise<boolean> {
  const user = await repos.users.findById(notification.userId);
  if (!user) {
    // The account is gone. Retrying cannot help, so it is abandoned rather
    // than left to circle the queue for ever.
    await repos.notifications.markFailed(notification.id, "recipient account no longer exists", 1);
    return false;
  }

  if (notification.channel !== "email") {
    // The column allows sms/whatsapp/in-app because those are real plans, and
    // saying so here is better than a silent success on a channel nothing can
    // yet deliver.
    await repos.notifications.markFailed(
      notification.id,
      `no transport for channel ${notification.channel}`,
      1,
    );
    return false;
  }

  try {
    await transport.send({
      // A quote request sets recipientEmail to Brandora's own inbox — see
      // the column's comment in schema.sql. Everything else is unset and
      // goes to the account the notification is about.
      to: notification.recipientEmail ?? user.email,
      subject: notification.subject,
      body: notification.body,
      kind: notification.kind,
    });
    await repos.notifications.markSent(notification.id);
    return true;
  } catch (err) {
    await repos.notifications.markFailed(
      notification.id,
      err instanceof Error ? err.message : String(err),
      maxAttempts,
    );
    return false;
  }
}

/**
 * Drain the queue.
 *
 * Sequential rather than parallel: providers rate-limit, and a burst that
 * trips a limit turns a queue of deliverable messages into a queue of failures
 * with the attempt counter burned. A batch of fifty at a time is plenty for
 * this volume and bounded enough to run inside a request.
 */
export async function deliverPending(
  repos: Repositories,
  transport: NotificationTransport,
  options: { limit?: number; maxAttempts?: number } = {},
): Promise<DeliveryReport> {
  if (!transport.configured) {
    const waiting = await repos.notifications.pending(options.limit ?? 50);
    return { attempted: 0, sent: 0, failed: 0, skipped: waiting.length > 0, transport: transport.name };
  }

  const queue = await repos.notifications.pending(options.limit ?? 50);
  let sent = 0;

  for (const notification of queue) {
    const ok = await deliverOne(repos, transport, notification, options.maxAttempts);
    if (ok) sent += 1;
  }

  return {
    attempted: queue.length,
    sent,
    failed: queue.length - sent,
    skipped: false,
    transport: transport.name,
  };
}
