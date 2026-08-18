# Product photographs

Drop a real photograph in here and the launch page picks it up on the next
load. No code change, no rebuild step of its own — `fr-launch.js` asks the
server whether each file exists and swaps the drawn placeholder for the
photograph only when one answers with an image.

## The filenames the page looks for

Exactly these, lowercase, `.jpg`:

Three tiles are already filled from `assets/img/sourcing/` — the cleaned
supplier photographs prepared by `scripts/prepare-product-photos.py`. Prefer
that directory: those images are cropped square, redacted of third-party
wordmarks and a third of the size. Add a file here only for a category the
sourcing set does not cover.

| File | Tile on the page |
| --- | --- |
| `emballages.jpg` | Emballages |
| `gobelets.jpg` | Gobelets |
| `boites.jpg` | Boîtes |
| `sachets.jpg` | Sachets |
| `stickers.jpg` | Stickers |
| `cartes.jpg` | Cartes de remerciement |
| `supports.jpg` | Supports de marque |

A missing file is not a bug. That tile keeps its drawn silhouette and its
"Visuel à venir" label, which is the honest state for a category Brandora
cannot yet show.

## What belongs here, and what does not

**A photograph of the product Brandora will actually supply for that
category.** A picture of paper bags goes in `sachets.jpg` and nowhere else —
using it for `boites.jpg` because both are brown and made of paper is telling
a customer they are looking at a box when they are looking at a bag.

Two things to check before adding a supplier's image:

1. **Permission.** Listing photographs on a supplier marketplace usually
   belong to the supplier or their photographer, not to whoever downloaded
   them. Most suppliers will agree to their reseller using them — ask, and
   keep the reply.
2. **Burnt-in text and other companies' brands.** Marketplace listing images
   often carry the seller's own marketing across them, frequently in another
   language, and sometimes show a sample print carrying a *third party's*
   logo. Either one on Brandora's page reads as scraped content at best; a
   third party's brand on a page that appears to be selling it is a
   trademark problem. Crop it, or ask the supplier for the clean studio shot
   — they almost always have one.

## Size

Roughly 800×800, under ~200KB. These load on phones on mobile data in the
launch market; a 4MB photograph is a tile nobody waits for.
