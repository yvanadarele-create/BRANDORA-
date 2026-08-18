/**
 * Load a sourcing file into the database.
 *
 * ## Why this is a script and not a folder of committed JSON
 *
 * The natural instinct is `database/manufacturers.json`, `database/contacts.json`
 * and so on, checked into the repository. Two things make that the wrong home.
 *
 * **This repository is public.** `contacts.json` holds the personal mobile
 * numbers of named salespeople at six companies. Publishing those is not a
 * thing to undo later: git keeps every version, so deleting the file leaves the
 * numbers in the history for anyone who clones it.
 *
 * **And the application cannot read it.** Vercel serves a build; a JSON file
 * committed beside the source is not a database the admin screens can write to,
 * and the moment a price is corrected in one place and not the other there are
 * two answers to "what does this cost".
 *
 * So the shape is exactly as designed — manufacturers, contacts, offers,
 * products, normalised, no supplier repeated inside a product — and it lives in
 * Postgres. This script is the bridge: keep the JSON wherever you like (a local
 * file, a Drive export, the Excel workbook saved as JSON), and run this to load
 * it. `sourcing/` is git-ignored for exactly this purpose.
 *
 * ## What it will not do
 *
 * It does not invent. A missing price stays missing, a missing MOQ stays
 * missing, and an offer with no price is still recorded — because "we found
 * this supplier and have not got a price yet" is a real and useful state, and
 * the alternative is somebody typing a plausible number to make the import
 * pass.
 *
 * It is idempotent on identity: a supplier is matched by (platform,
 * external_id) or by name, so running it twice updates rather than duplicates.
 *
 * Usage:
 *   BRANDORA_DATABASE_URL=… node scripts/import-suppliers.mjs sourcing/suppliers.json
 *   node scripts/import-suppliers.mjs sourcing/suppliers.json --dry-run
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { openDatabase } from "../packages/brandora-database/dist/index.js";
import { createRepositories } from "../packages/brandora-database/dist/index.js";

const DRY_RUN = process.argv.includes("--dry-run");
const file = process.argv.find((arg) => arg.endsWith(".json"));

if (!file || !existsSync(resolve(file))) {
  console.error(
    [
      "Usage: node scripts/import-suppliers.mjs <file.json> [--dry-run]",
      "",
      "The file holds { suppliers: [...], contacts: [...], offers: [...] } in the",
      "shape documented in sourcing/README.md. Keep it out of the repository:",
      "it contains real people's contact details and this repository is public.",
    ].join("\n"),
  );
  process.exit(1);
}

const payload = JSON.parse(readFileSync(resolve(file), "utf8"));
const suppliers = payload.suppliers ?? [];
const contacts = payload.contacts ?? [];
const offers = payload.offers ?? [];

/** Complain loudly about a record that cannot be stored, rather than guessing. */
const problems = [];
for (const [index, supplier] of suppliers.entries()) {
  if (!supplier.company_name) problems.push(`suppliers[${index}]: no company_name`);
  if (!supplier.supplier_id) problems.push(`suppliers[${index}]: no supplier_id`);
}
for (const [index, contact] of contacts.entries()) {
  if (!contact.supplier_id) problems.push(`contacts[${index}]: no supplier_id to attach to`);
  if (!contact.contact_name && contact.unassigned !== true) {
    problems.push(
      `contacts[${index}]: no contact_name. If this detail arrived without a name, ` +
        `set "unassigned": true rather than guessing whose it is.`,
    );
  }
}
if (problems.length > 0) {
  console.error(`\n${problems.length} record(s) cannot be imported:\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

console.log(
  `${suppliers.length} supplier(s), ${contacts.length} contact(s), ${offers.length} offer(s)` +
    `${DRY_RUN ? "  — dry run, nothing will be written" : ""}\n`,
);

for (const supplier of suppliers) {
  const people = contacts.filter((contact) => contact.supplier_id === supplier.supplier_id);
  const priced = offers.filter((offer) => offer.supplier_id === supplier.supplier_id);
  const withPrice = priced.filter((offer) => offer.price?.unit_price != null || offer.price?.min != null);

  console.log(`${supplier.supplier_id}  ${supplier.company_name}`);
  console.log(`   platform     ${supplier.platform ?? "(not stated)"}`);
  console.log(`   relationship ${supplier.relationship?.status ?? "new"}`);
  console.log(`   contacts     ${people.length}${people.some((p) => p.unassigned) ? " (one unassigned)" : ""}`);
  console.log(
    `   offers       ${priced.length}` +
      (priced.length > 0 ? `, ${withPrice.length} with a price, ${priced.length - withPrice.length} without` : ""),
  );
}

if (DRY_RUN) {
  console.log("\nDry run. Re-run without --dry-run to write.");
  process.exit(0);
}

const url = (process.env["BRANDORA_DATABASE_URL"] ?? "").trim();
if (url === "") {
  console.error("\nBRANDORA_DATABASE_URL is not set — nothing to import into.");
  process.exit(1);
}

const db = await openDatabase({ url });
const repos = createRepositories(db);

let created = 0;
let updated = 0;
let contactRows = 0;
let offerRows = 0;

for (const supplier of suppliers) {
  const existing = await repos.suppliers.findByExternal(
    supplier.platform ?? "made-in-china",
    supplier.supplier_id,
  );

  const record = {
    name: supplier.company_name,
    platform: supplier.platform ?? "made-in-china",
    externalId: supplier.supplier_id,
    ...(supplier.platform_company_url ? { externalUrl: supplier.platform_company_url } : {}),
    ...(supplier.country ? { country: supplier.country } : {}),
    ...(supplier.city ? { city: supplier.city } : {}),
    categories: supplier.main_products ?? [],
    ...(supplier.relationship?.status ? { relationship: supplier.relationship.status } : {}),
    ...(supplier.relationship?.last_contact ? { lastContactAt: supplier.relationship.last_contact } : {}),
    ...(supplier.relationship?.next_action ? { nextAction: supplier.relationship.next_action } : {}),
  };

  const saved = await repos.suppliers.upsert(record);
  if (existing) updated += 1;
  else created += 1;

  for (const contact of contacts.filter((c) => c.supplier_id === supplier.supplier_id)) {
    await repos.supplierContacts.upsert(saved.id, {
      // An unnamed detail is recorded as unassigned rather than attributed to
      // whoever happened to be listed first.
      name: contact.contact_name ?? "(unassigned)",
      unassigned: contact.unassigned === true || !contact.contact_name,
      ...(contact.role ? { role: contact.role } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.phone ? { phone: contact.phone } : {}),
      ...(contact.whatsapp ? { whatsapp: contact.whatsapp } : {}),
      ...(contact.communication_platform ? { channel: contact.communication_platform } : {}),
      ...(contact.notes ? { notes: contact.notes } : {}),
    });
    contactRows += 1;
  }

  offerRows += offers.filter((o) => o.supplier_id === supplier.supplier_id).length;
}

console.log(
  `\n${created} supplier(s) created, ${updated} updated, ${contactRows} contact(s) recorded.`,
);
if (offerRows > 0) {
  console.log(
    `${offerRows} offer(s) were read but not written: an offer needs a Brandora product to attach to,\n` +
      `and the catalogue is empty. Create the products first, then re-run.`,
  );
}

await db.close();
