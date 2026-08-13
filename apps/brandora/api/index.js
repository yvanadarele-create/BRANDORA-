/**
 * The Vercel serverless entry point.
 *
 * Vercel hands a Node function the same `IncomingMessage` and `ServerResponse`
 * that `node:http` does, so the application's listener runs here unchanged —
 * there is no second copy of the routing, the auth or the pricing.
 *
 * `BRANDORA_DATABASE_URL` must be set here. Without it the server falls back to
 * SQLite on the local filesystem, which a serverless function throws away
 * between invocations — the endpoint would answer correctly and then forget,
 * and an account created by one request would not exist for the next. Use the
 * provider's *pooled* connection string: a direct one exhausts Postgres
 * connections under load, and the symptom reads like a random outage.
 *
 * The static site is served by Vercel's CDN, not by this function — `vercel.json`
 * only routes `/api/*` here.
 */

import { createApp } from '@brandora/server';

/**
 * Built once per cold start and reused across invocations on the same instance.
 *
 * The promise is created at module scope rather than per request, so concurrent
 * invocations on a warm instance share one pool and one schema migration
 * instead of racing to create their own.
 */
const ready = createApp();

export default async function handler(req, res) {
  const app = await ready;
  return app.listener(req, res);
}
