/**
 * The Vercel serverless entry point, at the repository root.
 *
 * There is a copy of this under `apps/brandora/api/` too, and that is
 * deliberate rather than sloppy: Vercel reads exactly one config per project,
 * chosen by the project's Root Directory setting. A project rooted at `/` reads
 * the config beside this file; a project rooted at `apps/brandora` reads the
 * one there. Covering both means the repository deploys correctly whichever way
 * the project was set up, instead of depending on a dashboard setting nobody
 * can see from the code.
 *
 * Vercel hands a Node function the same `IncomingMessage` and `ServerResponse`
 * that `node:http` does, so the application's listener runs here unchanged —
 * there is no second copy of the routing, the auth or the pricing.
 *
 * `BRANDORA_DATABASE_URL` must be set. Without it the server falls back to
 * SQLite on the local filesystem, which a serverless function throws away
 * between invocations: the endpoint would answer correctly and then forget.
 */

import { createApp } from '@brandora/server';

/**
 * Built once per cold start, not per request, so concurrent invocations on a
 * warm instance share one connection pool and one schema migration instead of
 * racing to create their own.
 */
const ready = createApp();

export default async function handler(req, res) {
  const app = await ready;
  return app.listener(req, res);
}
