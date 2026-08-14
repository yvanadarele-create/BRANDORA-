/**
 * The Vercel serverless entry point, at the repository root.
 *
 * There is a copy of this under `apps/brandora/api/` too, and that is
 * deliberate rather than sloppy: Vercel reads exactly one config per project,
 * chosen by the project's Root Directory setting. Covering both means the
 * repository deploys correctly whichever way the project was set up.
 *
 * Vercel hands a Node function the same `IncomingMessage` and `ServerResponse`
 * that `node:http` does, so the application's listener runs here unchanged —
 * there is no second copy of the routing, the auth or the pricing.
 *
 * ## Why this file is more than three lines
 *
 * It used to be `const ready = createApp()` at module scope and one `await`.
 * That had two failures which, together, produced every symptom on the live
 * site: login, signup, the interview and the catalogue all answering "Something
 * went wrong" while the static pages rendered perfectly.
 *
 * **A boot failure took down every route.** `createApp()` throws when
 * `BRANDORA_AUTH_SECRET` is unset — deliberately, because a server with a
 * guessable signing secret is worse than one that refuses to start. At module
 * scope that became an unhandled rejection and an opaque 500 on every request,
 * with nothing in the response to say which variable was missing. Static pages
 * kept working because the CDN serves those without ever touching this file,
 * which is exactly why the site looked alive and did nothing.
 *
 * **And the failure was permanent.** A rejected promise stays rejected. Once
 * this module had been evaluated, the instance answered 500 for the rest of its
 * life — so adding the variable in Vercel changed nothing until a new
 * deployment replaced the instance. That is why refreshing never helped.
 *
 * So the boot is retried rather than cached on failure, and a failure answers
 * with a code an operator can act on and a sentence a customer can read. The
 * variable *names* appear in that response because a name is not a secret, and
 * knowing which one is missing is the difference between a five-minute fix and
 * a five-day one. No value is ever included.
 */

import { createApp } from '@brandora/server';
import { configurationGaps } from '@brandora/config';

/** The booted app, or null while it has never successfully booted. */
let app = null;

/** The in-flight boot, so concurrent invocations share one attempt. */
let booting = null;

/**
 * Boot, or return the running app.
 *
 * The promise is dropped on failure rather than kept, which is the whole point:
 * the next request tries again. An instance fixed by an environment change
 * should recover on the next invocation, not on the next deployment.
 */
async function boot() {
  if (app) return app;
  if (booting) return booting;

  booting = createApp()
    .then((built) => {
      app = built;
      return built;
    })
    .finally(() => {
      booting = null;
    });

  return booting;
}


export default async function handler(req, res) {
  let ready;
  try {
    ready = await boot();
  } catch (error) {
    // The real error, in the platform log, where an operator looks for it.
    console.error('[brandora] the application could not start:', error);

    const missing = configurationGaps(process.env);
    const isConfig = missing.required.length > 0 || error?.name === 'MissingConfigError';

    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: isConfig ? 'CONFIGURATION_INCOMPLETE' : 'SERVICE_UNAVAILABLE',
          // A sentence for whoever sees it, and the variable names underneath
          // for whoever can act on it.
          message: isConfig
            ? 'The service is not fully configured yet. Nothing you entered has been lost.'
            : 'The service is temporarily unavailable. Nothing you entered has been lost.',
          ...(missing.required.length > 0 ? { missingRequired: missing.required } : {}),
          ...(missing.recommended.length > 0 ? { missingRecommended: missing.recommended } : {}),
        },
      }),
    );
    return;
  }

  return ready.listener(req, res);
}
