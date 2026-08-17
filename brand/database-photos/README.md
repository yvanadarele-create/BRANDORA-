# Database photos — supplier catalogue images

93 product photographs extracted from the supplier catalogue PDFs the founder
collected while sourcing:

| Prefix | Source catalogue | What it shows |
| --- | --- | --- |
| `yison-*` | Yison Printing | Rigid boxes, folding cartons, gift packaging, paper bags |
| `printing-*` | Printing catalogue | Notebooks, planners, case-bound books |
| `giftset-*` | Gift set catalogue 2.0 | Gift sets and presentation packaging |

Filenames carry their pixel dimensions, so a shot can be picked for a slot
without opening it.

## Why they live here and not under `apps/brandora`

Everything under `apps/brandora` is served to browsers. This is a working
archive to choose from, not 12MB of images every visitor downloads. Copy the
one you want into `apps/brandora/assets/img/products/` under the filename that
tile expects — see the README there.

## Before any of these goes on a public page

**They are the suppliers' photographs, not Brandora's.** Catalogue imagery
normally belongs to the manufacturer or their photographer. Most suppliers are
happy for a reseller to use it; ask, and keep the reply.

**Several carry the supplier's own brand.** `yison-17` has YISON printed
across the boxes and the bag; others show a customer's finished artwork —
Birch Sap Tea, cosmetics lines. A photograph of a box with somebody else's
logo on it is fine as an illustration of *what the factory can make*, and
misleading if it is presented as a Brandora product. The three currently on
the launch page were picked because the packaging, not the branding, is what
reads.

**Nothing here states a price, a lead time or a minimum quantity.** The
catalogues do quote figures; those are supplier terms subject to negotiation,
and they are deliberately not copied into the application. A number that
reaches a customer has to come from a real quote.
