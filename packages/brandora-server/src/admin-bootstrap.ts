/**
 * Auto-promoting the administrator on boot.
 *
 * `docs/deployment.md` used to say "there is no route that grants a role —
 * promote the first admin directly [with a hand-written SQL statement]." That
 * is still true in spirit — no *public* route can ever grant a role — but it
 * meant the admin identity depended on someone remembering to run that SQL
 * against the right database after every fresh deploy, which is exactly the
 * kind of manual step this codebase's own conventions (see catalog-seed.ts)
 * treat as a bug waiting to happen.
 *
 * This does the same promotion, but on every boot, from one env var:
 * `BRANDORA_ADMIN_EMAIL`. It never creates an account and never touches a
 * password — only `role`. Concretely:
 *
 *   - No `BRANDORA_ADMIN_EMAIL` set: does nothing. Not every deployment
 *     (tests, a preview branch) wants an auto-admin.
 *   - Set, but nobody has signed up with that address yet: does nothing and
 *     logs why. Sign up with that address once, through the ordinary signup
 *     form — you choose your own password, which this code never sees — and
 *     the *next* boot promotes it.
 *   - Set, and the account exists but is not already `admin`: promotes it.
 *   - Set, and the account is already `admin`: no-op, silently. This runs on
 *     every single boot, so it has to be safe to run a thousand times.
 *
 * The password is never generated, reset, or even read here — only `role`
 * changes. Whoever signed up with the admin address is the only person who
 * has ever known that password, which is the property "the admin identity
 * must not disappear after deployment, and I don't want a temporary
 * development credential" actually asks for.
 */

import type { Repositories } from "@brandora/database";

import type { ServerLogger } from "./http.js";

export async function bootstrapAdmin(
  repos: Repositories,
  logger: ServerLogger,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const email = (env["BRANDORA_ADMIN_EMAIL"] ?? "").trim().toLowerCase();
  if (email === "") return;

  try {
    const user = await repos.users.findByEmail(email);
    if (!user) {
      // Not an error — the very first boot after setting this variable is
      // expected to find nobody yet, if the administrator hasn't signed up.
      console.log(
        `[brandora] BRANDORA_ADMIN_EMAIL is set to ${email}, but no account exists yet — ` +
          "sign up with that address and it will be promoted to admin on the next boot",
      );
      return;
    }

    if (user.role === "admin") return;

    await repos.users.setRole(user.id, "admin");
    console.log(`[brandora] promoted ${email} to admin (BRANDORA_ADMIN_EMAIL)`);
  } catch (err) {
    // Same posture as catalog auto-seed: never block startup over this.
    logger.error(`admin auto-bootstrap failed, continuing without it: ${String(err)}`);
  }
}
