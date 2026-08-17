# Sourcing data

The manufacturers, the people at them, and what they have offered.

**Nothing in this folder is committed except this file and `example.json`.**
`.gitignore` excludes the rest, and that is deliberate — see below.

## Why the data is not in the repository

This repository is **public**. A `contacts.json` holding the personal mobile
numbers of named salespeople at six companies would publish those numbers to the
open internet, and git keeps every version: deleting the file later leaves the
numbers in the history for anyone who clones it.

There is a second reason. Vercel serves a build. A JSON file committed beside
the source is not something the admin screens can write to, so the moment a
price is corrected in one place and not the other there are two answers to
"what does this cost". Postgres is the one answer.

So: **the shape lives here, the data lives in Postgres.** Keep your working
file wherever suits you — a local file in this folder, an export from the Excel
workbook, a Drive download — and load it with:

```bash
BRANDORA_DATABASE_URL=… node scripts/import-suppliers.mjs sourcing/suppliers.json
node scripts/import-suppliers.mjs sourcing/suppliers.json --dry-run   # read it back first
```

## The shape

Four things, normalised, so nothing is written twice.

```
manufacturers ──< contacts
      │              │
      └──────< offers >── products
```

**A supplier is a company.** Zanbond Group is one row however many people work
there.

**A contact is a person.** LEE is a row; if Alice joins, she is another row
against the same company. This is the one structural point that matters most:
holding a contact on the supplier row means the second salesperson either
overwrites the first or duplicates the whole company.

**An offer is what one supplier will do for one product.** The wooden spoon is
one product; three suppliers quoting it are three offers. Price and MOQ live
here, never on the product, because they differ per supplier.

**A product is a thing Brandora sells.** It has no price of its own.

### Prices: listed is not quoted

`price_type` is the most important field in an offer.

| value | what it means |
| --- | --- |
| `listed` | The number on the marketplace page. Advertising: best case, biggest tier, before customisation. Nobody has agreed to it. |
| `quoted` | A salesperson sent this for your specification. |
| `negotiated` | Agreed, after back and forth. |

Pricing a customer's order from a `listed` figure as though it were `quoted` is
how a margin disappears between the spreadsheet and the invoice. The quote
engine reads this field.

### Tiers, not a range

A supplier who charges $0.04 at ten thousand and $0.01 at a hundred thousand has
not quoted "$0.01–0.04". Record the breaks:

```json
"tiers": [
  { "min_quantity": 10000, "max_quantity": 49999,  "unit_price": 0.04 },
  { "min_quantity": 50000, "max_quantity": 99999,  "unit_price": 0.016 },
  { "min_quantity": 100000, "max_quantity": null,  "unit_price": 0.01 }
]
```

Each becomes a row in `supplier_offers`, so a quote picks the tier the order
actually falls in rather than interpolating between numbers nobody said.

### Where the relationship stands

`relationship.status` is not the same as whether a supplier is usable. A factory
can be excellent and still be one nobody has written to yet, and sourcing is
mostly the business of knowing which of those is true for each of forty
companies.

```
new · contacted · responded · awaiting-information · sample-requested
sample-received · negotiating · verified · approved · rejected · inactive
```

### Missing is missing

A price you do not have stays absent. The importer records an offer with no
price, because "found this supplier, no price yet" is a real and useful state —
and the alternative is somebody typing a plausible number to make the import
pass. Nothing here is ever filled in with an estimate.

A contact detail that arrived without a name gets `"unassigned": true` rather
than being attributed to whoever was listed first. A phone number filed against
the wrong salesperson is worse than one filed against nobody.

See `example.json` for a complete file. Its contact details are placeholders —
real ones do not belong in a public repository.
