/**
 * Ask a running Brandora what is wrong with it.
 *
 * This is the check to run when the site is up but nothing works. It walks the
 * same four calls a customer's first visit makes — am I signed in, create an
 * account, log in, load the catalogue — prints the raw JSON of each, and then
 * says in one line what to do about it.
 *
 * It exists because "Something went wrong" is the same sentence for a missing
 * environment variable, an unreachable database and a genuine bug, and the
 * three have completely different fixes. The server already distinguishes them
 * in its response; nothing was reading that response out loud.
 *
 * Run:
 *   node scripts/check-live.mjs https://brandoraunion.online
 *   node scripts/check-live.mjs                    (defaults to localhost:4600)
 *
 * It creates one throwaway account, `live-check-<timestamp>@example.com`. That
 * is a real row in whatever database it is pointed at — deliberately, because
 * a signup that does not write a row is the failure being looked for. Delete it
 * afterwards if you care.
 */

const BASE = (process.argv[2] || 'http://127.0.0.1:4600').replace(/\/$/, '');
const EMAIL = `live-check-${Date.now()}@example.com`;
const PASSWORD = 'correct-horse-battery-staple';

let cookie = '';
const findings = [];

async function call(method, path, body) {
  const started = Date.now();
  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'manual',
    });
  } catch (err) {
    return { ok: false, status: 0, raw: `NETWORK: ${err.message}`, json: null, ms: Date.now() - started };
  }

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  const raw = await response.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* Not JSON — an HTML error page, most likely. Shown raw below. */
  }
  return { ok: response.ok, status: response.status, raw, json, ms: Date.now() - started };
}

function report(label, method, path, result) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${label}\n${method} ${BASE}${path}  →  ${result.status || 'no response'}  (${result.ms}ms)`);
  console.log('─'.repeat(72));
  console.log(result.raw.length > 900 ? `${result.raw.slice(0, 900)}\n… (${result.raw.length} bytes)` : result.raw);

  const error = result.json?.error;
  const code = typeof error === 'object' && error !== null ? error.code : error;

  if (result.status === 0) {
    findings.push(`Could not reach ${BASE} at all. ${result.raw}`);
    return;
  }
  if (code === 'CONFIGURATION_INCOMPLETE') {
    const missing = error.missingRequired ?? [];
    findings.push(
      missing.length > 0
        ? `THE BLOCKER: ${missing.join(', ')} is not set on the deployment. ` +
          `Nothing that touches the API can work until it is — the server refuses to start without it.`
        : 'The service reports incomplete configuration but named no variable.',
    );
    const recommended = error.missingRecommended ?? [];
    if (recommended.length > 0) {
      findings.push(`Also unset: ${recommended.join(', ')} — not fatal, but each one disables a feature.`);
    }
    return;
  }
  if (code === 'SERVICE_UNAVAILABLE') {
    findings.push(
      'The service started but could not reach a dependency — almost always the database. ' +
        'Check BRANDORA_DATABASE_URL, and that the database name in it matches exactly ' +
        '(Postgres lower-cases unquoted names, so BRANDORA_db may actually be brandora_db).',
    );
    return;
  }
  if (result.json === null && result.status >= 400) {
    findings.push(`${path} answered ${result.status} with something that is not JSON — the request never reached the application.`);
  }
}

console.log(`Checking ${BASE}`);
console.log(`Throwaway account: ${EMAIL}`);

/* 1. Is the application answering at all? */
const me = await call('GET', '/api/auth/me');
report('1. IS THE API ALIVE?  (no session expected — {"user":null} is success)', 'GET', '/api/auth/me', me);

/* 2. Can somebody create an account? */
const signup = await call('POST', '/api/auth/signup', { name: 'Live Check', email: EMAIL, password: PASSWORD });
report('2. SIGNUP', 'POST', '/api/auth/signup', signup);
if (signup.status === 201) {
  const session = await call('GET', '/api/auth/me');
  const signedIn = session.json?.user?.email === EMAIL;
  console.log(`\n   signed in immediately after signup: ${signedIn ? 'YES' : 'NO'}`);
  if (!signedIn) findings.push('Signup succeeded but no session was established — the cookie is not coming back.');
}

/* 3. And log back in with the same credentials? */
await call('POST', '/api/auth/logout', {});
const login = await call('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
report('3. LOGIN with those same credentials', 'POST', '/api/auth/login', login);
if (signup.status === 201 && login.status !== 200) {
  findings.push('The account was created but cannot log in — the password was not stored, or is not being verified.');
}

/* 4. Does the catalogue load, and does it have anything in it? */
const catalog = await call('GET', '/api/catalog?quantity=30');
report('4. CATALOGUE', 'GET', '/api/catalog?quantity=30', catalog);
if (catalog.status === 200) {
  const total = catalog.json?.total ?? 0;
  const shown = (catalog.json?.products ?? []).length;
  console.log(`\n   ${shown} orderable at 30 units, ${total} in the catalogue`);
  if (total === 0) {
    findings.push('The catalogue endpoint works but the catalogue is empty. That is an empty state, not a fault.');
  }
}

/* 5. Does brand generation actually work? */

if (login.status === 200) {
  const project = await call('POST', '/api/projects', { name: 'Live check brand' });
  const projectId = project.json?.project?.id;

  if (projectId) {
    await call('PUT', `/api/projects/${projectId}/interview`, {
      answers: [
        { field: 'business', value: 'Jus de fruits frais pressés à Abidjan' },
        { field: 'product', value: 'Jus en bouteille' },
        { field: 'audience', value: 'Jeunes de 13 à 19 ans' },
        // These two are choice fields; the values must be ones the interview
        // offers, not free text, or the request is rejected before it ever
        // reaches the model and the check would blame the wrong thing.
        { field: 'positioning', value: 'affordable' },
        { field: 'personality', value: ['playful', 'bold'] },
        { field: 'differentiation', value: 'Fruits locaux, pressés le matin' },
        { field: 'style', value: 'Coloré et moderne' },
      ],
    });

    const generated = await call('POST', `/api/projects/${projectId}/generate`, {});
    report('5. BRAND GENERATION (the step that fails after the colour palette)',
      'POST', `/api/projects/${projectId}/generate`, generated);

    if (generated.status === 201) {
      console.log(`\n   generated brand name: ${generated.json?.strategy?.name ?? '(none)'}`);
    } else {
      const reason = generated.json?.reason;
      const EXPLAIN = {
        'ai-not-configured': 'ANTHROPIC_API_KEY is not set on the deployment.',
        'ai-key-rejected': 'ANTHROPIC_API_KEY is set but the provider rejected it — wrong, revoked, or from a different account.',
        'ai-model-not-permitted': 'The key is valid but has no access to the model. Check ANTHROPIC_MODEL.',
        'ai-rate-limited': 'The provider rate limited Brandora. This one clears on its own.',
        'ai-timeout': 'The provider did not answer in time. If this is constant rather than occasional, raise maxDuration in vercel.json.',
        'ai-unreachable': 'Brandora could not reach the provider at all — a network or DNS problem on the deployment.',
        'ai-http-402': 'Payment required: the account behind ANTHROPIC_API_KEY has no credit left.',
        'ai-http-400': 'The provider rejected the request itself — most often an ANTHROPIC_MODEL that does not exist.',
        'ai-http-529': 'The provider is overloaded. Try again shortly.',
      };
      findings.push(
        reason
          ? `BRAND GENERATION FAILS — ${reason}. ${EXPLAIN[reason] ?? 'See the deployment logs for the detail.'}`
          : `BRAND GENERATION FAILS with ${generated.status} and no reason code. Check the deployment logs.`,
      );
    }
  }
}

/* --- What to do about it -------------------------------------------------- */

console.log(`\n${'═'.repeat(72)}\nDIAGNOSIS\n${'═'.repeat(72)}`);

if (findings.length === 0) {
  console.log('Signup, login and the catalogue all answered correctly. The API is working.');
} else {
  for (const finding of [...new Set(findings)]) console.log(`\n• ${finding}`);
  console.log(
    '\nTo set a missing variable: Vercel → the project → Settings → Environment\n' +
      'Variables → Add New, tick Production and Preview, then Deployments →\n' +
      'Redeploy. Generate an auth secret with:  openssl rand -base64 32',
  );
}

process.exit(findings.length === 0 ? 0 : 1);
