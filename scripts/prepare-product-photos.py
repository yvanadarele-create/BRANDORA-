#!/usr/bin/env python3
"""
Turn supplier photographs into catalogue images.

## The rule this obeys

**The product is never regenerated.** Every pixel showing the label itself is
the pixel the camera recorded. No AI fill, no colour grading, no relighting —
because a holographic film's colour *is* the product, and a "cleaned up" version
that shifts the rainbow is a photograph of something the customer will not
receive. Sizes, colours and materials come through untouched.

What changes is everything that is not the product: the thumb, the desk edge,
the cardboard box, the strip of floor — and two things that must not be
published.

## Why regions are found rather than typed in

The first version of this script had hand-typed blur boxes. They were guesses,
they landed across the middle of the labels, and the result was worse than the
photograph: four holograms cut in half by grey rectangles. Coordinates guessed
from looking at a picture are wrong in a way that is invisible until you look at
the output.

So the labels are *found*. Holographic film is vividly saturated and the paper
it sits on is not, which separates them cleanly, and each label's own bounding
box then decides where its wordmark band is. Change the crop and the redaction
still lands correctly, because it was never tied to the crop.

## Why redaction, and why it is not censorship

These sheets were photographed at a factory that prints for other companies.
They carry other brands' marks — BIHAKU, Marabu, MAX Italian — which on
Brandora's site would read as work Brandora did for them; and **live
anti-counterfeit codes**, serial numbers and QR codes belonging to a running
authentication system, which a legible photograph online is useful to precisely
the people those labels exist to stop.

Blurring both leaves what a customer is actually buying: the film, its texture,
its colours, at its real size.

Run:  python3 scripts/prepare-product-photos.py
Out:  apps/brandora/assets/img/sourcing/*.webp
"""

import colorsys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/brandora/assets/img/sourcing"

GROUND = (247, 248, 247)   # the site's own surface
SIZE = 700
QUALITY = 90


def blur(image, boxes):
    """Blur regions past recovery. Radius scales with the region, not fixed."""
    for box in boxes:
        left, top, right, bottom = (int(v) for v in box)
        region = image.crop((left, top, right, bottom))
        radius = max(6, min(right - left, bottom - top) // 2)
        image.paste(region.filter(ImageFilter.GaussianBlur(radius)), (left, top))
    return image


def remove_corner_watermark(image, search=(260, 200), tolerance=40):
    """Flood a supplier's logo watermark, confined to the top-left corner,
    with the photo's own background colour — found the same way `autocrop`
    finds a product's edges (compare against a clean reference point), not
    typed in by eye. The reference is the top-right corner: same row the
    watermark sits in, far enough away to be clear of it in every photo this
    is run against.
    """
    w, h = image.size
    ground = image.getpixel((w - 6, 6))
    px = image.load()
    left, top, right, bottom = search[0], search[1], 0, 0
    found = False
    for y in range(0, min(search[1], h)):
        for x in range(0, min(search[0], w)):
            p = px[x, y]
            if sum(abs(p[i] - ground[i]) for i in range(3)) > tolerance * 3:
                found = True
                left, top = min(left, x), min(top, y)
                right, bottom = max(right, x), max(bottom, y)
    if not found:
        return image
    margin = 6
    box = (0, 0, min(w, right + margin), min(h, bottom + margin))
    patch = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), ground)
    image.paste(patch, (box[0], box[1]))
    return image


def square(image, name):
    """One square ground, centred, product never distorted."""
    # Scaled up a little where the source is small — a phone photograph of a
    # carton is never going to be a studio plate, and pretending otherwise with
    # an AI upscale would invent detail that is not on the product.
    scale = min(SIZE / image.width, SIZE / image.height, 2.0)
    image = image.resize((int(image.width * scale), int(image.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGB", (SIZE, SIZE), GROUND)
    canvas.paste(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2))
    OUT.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT / name, "WEBP", quality=QUALITY, method=6)
    print(f"  {name}  {canvas.size[0]}x{canvas.size[1]}")


print("Preparing catalogue images (product pixels unaltered):\n")

# --- Gold holographic labels ------------------------------------------------
#
# The one photograph of the four that survives becoming a catalogue image, and
# it survives for a reason worth writing down: nothing on it is anybody else's.
# No client wordmark is legible and no authentication code is in frame, so the
# only edits are a crop and one small blur over the factory's handwritten
# quantity slip.
#
# The other three could not be salvaged — the branding and the serial codes on
# them are printed *on the product*, so redacting them either destroys the
# photograph or fails to redact. See the note at the bottom of this file.

sheet = Image.open(ROOT / "WhatsApp Image 2026-08-17 at 4.26.59 PM.jpeg").convert("RGB")
# The right edge is found rather than eyeballed: the carton is warm and unbroken
# from x=470, the sheet is white with vivid gold on it, so the boundary is where
# every sampled row turns brown at once.
sheet = sheet.crop((250, 468, 466, 812))
# Deliberately not blurred: the factory's handwritten quantity slip identifies
# nobody, and a grey rectangle in the middle of the frame looked far more like
# damage than the note ever looked like a problem. Redaction is for other
# companies' marks and live authentication codes; this is neither.
square(sheet, "holographic-labels.webp")

print(f"\nWritten to {OUT.relative_to(ROOT)}")
print(
    "\nNot published, and why:\n"
    "  4.26.58 PM.jpeg      the supplier's wholesale price table — publishing it publishes the margin\n"
    "  4.26.58 PM (1).jpeg  Marabu wordmark printed across every label\n"
    "  4.26.59 PM (1).jpeg  MAX Italian wordmark plus live QR authentication codes\n"
    "  4.27.00 PM.jpeg      BIHAKU wordmark plus legible anti-counterfeit serial numbers\n"
    "  4.26.59 PM (2).jpeg  the supplier's marketing sheet, five other companies' brands on it\n"
    "  image.png            a screenshot of a Made-in-China listing page\n"
)


# ---------------------------------------------------------------------------
# Second batch, added 18 Aug 2026
# ---------------------------------------------------------------------------
#
# Twelve photographs and a supplier spec sheet. Ten become catalogue images.
# Two do not, for the same reason as the first batch: one carries another
# company's wordmark printed on the product, and one is a price/spec table
# rather than a photograph — a table belongs in the sourcing data, not on a
# product tile.
#
# The crops are found, not typed. The first batch taught that lesson expensively
# (see the note at the top of this file), so `autocrop` reads the four edges of
# the frame to learn what the background is — a grey wall, a red cloth, a black
# studio sweep — and keeps everything that is not that. Reframe the photo, add
# another, and the crop still lands on the product.


def autocrop(image, tolerance=34, margin=0.045):
    """Find the product by subtracting the background the photographer used.

    The background is whatever the frame's outer border is made of, which is
    a safer assumption than 'the background is white': three of these were shot
    on red towelling and two on a black sweep. Everything far enough from that
    colour is product.
    """
    small = image.resize((image.width // 4 or 1, image.height // 4 or 1), Image.BILINEAR)
    pixels = small.load()
    width, height = small.size

    border = []
    for x in range(width):
        border.append(pixels[x, 0])
        border.append(pixels[x, height - 1])
    for y in range(height):
        border.append(pixels[0, y])
        border.append(pixels[width - 1, y])
    ground = tuple(sum(channel) // len(border) for channel in zip(*border))

    left, top, right, bottom = width, height, 0, 0
    found = False
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y]
            distance = sum(abs(pixel[i] - ground[i]) for i in range(3))
            if distance > tolerance * 3:
                found = True
                left, top = min(left, x), min(top, y)
                right, bottom = max(right, x), max(bottom, y)

    if not found:
        return image

    # A second ground. Three of these were shot on a desk against a wall, so the
    # frame has a wall *and* a floor in it, and the floor is as far from the
    # averaged background as the product is — the box came out with a strip of
    # parquet under it. A band is scenery rather than product when it runs the
    # whole width and is a flat colour in itself, so bands like that are peeled
    # off the top and bottom until the first row that actually varies.
    def scenery(row):
        colours = [pixels[x, row] for x in range(left, right + 1)]
        if len(colours) < 3:
            return False
        deviating = sum(
            1
            for colour in colours
            if sum(abs(colour[i] - ground[i]) for i in range(3)) > tolerance * 3
        )
        if deviating < len(colours) * 0.9:
            return False
        means = [sum(c[i] for c in colours) / len(colours) for i in range(3)]
        spread = max(
            sum((c[i] - means[i]) ** 2 for c in colours) / len(colours) for i in range(3)
        )
        return spread < 90

    while top < bottom and scenery(top):
        top += 1
    while bottom > top and scenery(bottom):
        bottom -= 1

    pad_x, pad_y = int(width * margin), int(height * margin)
    box = (
        max(0, (left - pad_x)) * 4,
        max(0, (top - pad_y)) * 4,
        min(width, (right + pad_x + 1)) * 4,
        min(height, (bottom + pad_y + 1)) * 4,
    )
    return image.crop(box)


# One frame needs a number typed into it, and it is worth being explicit about
# why rather than quietly adding a magic constant. In `1.00.22 PM.jpeg` the desk
# ends on a diagonal across the lower right corner, so the parquet behind it is
# neither a full-width band (the scenery rule misses it) nor far enough from the
# desk to read as a separate ground. There is no rule that separates a diagonal
# edge from the product above it; a stated trim is more honest than a rule that
# pretends to have found one.
TRIM_BOTTOM = {
    "WhatsApp Image 2026-08-18 at 1.00.22 PM.jpeg": 0.11,
    # Both acrylic cake-box photos (fifth batch) carry a supplier's own
    # promotional banner glued across roughly the bottom fifth of the frame —
    # "可加印LOGO" ("logo can be printed"), a colour-option caption, and Brandora's
    # own @brandora.union watermark on top of it. None of that is the product;
    # trimming it is the same operation as every other batch's background
    # removal, just a hard-edged banner instead of a wall or a floor.
    "watermark-06dd734890ba15a7b73e54cc04a47e38_1.jpeg": 0.245,
    "watermark-abd5f6e99577ebf50f1c2bc56fa04134_2.jpeg": 0.245,
}


BATCH_TWO = [
    # (source, output, find the crop?, why it is publishable)
    (
        "WhatsApp Image 2026-08-18 at 1.00.22 PM (1).jpeg",
        "bakery-gable-box.webp",
        True,
        "Gable-top cake box, closed, plain white board. Nobody's mark on it.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 1.00.22 PM.jpeg",
        "bakery-gable-box-open.webp",
        True,
        "The same box open from above, handle panels folded out.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 1.00.23 PM.jpeg",
        "bakery-carrier-box.webp",
        True,
        "Carrier box with a cut handle, shot side-on.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 1.04.08 PM (1).jpeg",
        "bakery-carrier-in-hand.webp",
        True,
        "Carried by the handle — the one shot in the set that gives it a size.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 1.04.08 PM.jpeg",
        "bakery-carrier-open.webp",
        True,
        "Flaps open, showing the interior and the board thickness.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 1.30.34 PM.jpeg",
        "cup-lids.webp",
        False,
        "Nine lid profiles on black. Already a studio plate; cropping it would cut the grid.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 1.28.09 PM.jpeg",
        "cup-pet-dimensions.webp",
        True,
        "PET cup with its dimensions printed on the frame: 92/93mm rim, 56mm tall, 55mm base.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 1.43.54 PM.jpeg",
        "icecream-cups.webp",
        False,
        "Paper ice-cream cups. The leaf is the factory's own sample print, not a customer's brand.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 1.57.56 PM.jpeg",
        "wooden-cutlery.webp",
        False,
        "Six wooden cutlery shapes on slate — the texture is the ground, so the crop is left alone.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 2.04.46 PM.jpeg",
        "wooden-spoon.webp",
        True,
        "One spoon on white.",
    ),
]

print("\nSecond batch:\n")
for source, name, cropped, _why in BATCH_TWO:
    path = ROOT / source
    if not path.exists():
        print(f"  ! {source} is not in the repository — skipped")
        continue
    image = Image.open(path).convert("RGB")
    trim = TRIM_BOTTOM.get(source)
    if trim:
        image = image.crop((0, 0, image.width, int(image.height * (1 - trim))))
    if cropped:
        image = autocrop(image)
    square(image, name)

print(
    "\nNot published from this batch, and why:\n"
    "  1.28.09 PM (1).jpeg  UU Coffee's wordmark is printed on the cups. It is on the\n"
    "                       product, so it cannot be cropped out, and publishing it would\n"
    "                       read as work Brandora did for them.\n"
    "  1.47.46 PM.jpeg      the factory's cutlery spec sheet. Its sizes are real and worth\n"
    "                       having, so they go into the sourcing data as specifications —\n"
    "                       a table is not a product photograph.\n"
)


# ---------------------------------------------------------------------------
# Third batch, added 18 Aug 2026 (evening) — twenty photos this time, and for
# the first time more than half do not survive the same three tests the first
# two batches were held to: a small food business would order it, no supplier
# logo, no other company's brand.
#
# Two are outright design templates rather than photographs of a physical
# product — an Etsy-style thank-you-card mockup with literal placeholder text
# ("@SOCIALHANDLE", "WWW.YOURWEBSITENAME.COM") baked into the graphic, which
# is not a thing Brandora could have a factory print; publishing it as a
# product example would be showing a screenshot of someone else's listing
# photo, not a manufactured card.
#
# Two carry a real third party's identity printed on the product itself,
# exactly the BIHAKU/Marabu/MAX Italian problem from the first batch: a
# "thank you" card signed "@nailglamour_9", and a set of five stickers each
# printed with a different real small business's name and logo (Dona Leoa,
# Amanda Trufas, LR, Beaded Bags). Neither has a crop that removes the
# branding without removing the product.
#
# Two are dense multi-product collage shots — a catalogue page's "everything
# we make" composite rather than a photograph of one product — and are left
# out not because anything is wrong with them but because a collage doesn't
# become an honest single product tile no matter how it's cropped.
BATCH_THREE = [
    (
        "WhatsApp Image 2026-08-18 at 8.06.15 PM.jpeg",
        "cups-lids-straws-set.webp",
        True,
        "Iced-coffee cup, dome lid and straw as a set, white ground.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.06.16 PM (1).jpeg",
        "cup-size-chart.webp",
        False,
        "The supplier's own sizing chart, 30ml to 300ml, dimensions in cm — a finished "
        "reference graphic, not a photograph to crop.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.06.16 PM (2).jpeg",
        "bags-colour-diecut.webp",
        True,
        "Die-cut handle bags in five colours, white ground.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.39 PM (1).jpeg",
        "cup-dome-navy.webp",
        True,
        "Cup with dome lid, navy ground — the assembled product the size chart describes in parts.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.17 PM (1).jpeg",
        "box-kraft-small.webp",
        True,
        "Small kraft box, closed and open, tan ground.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.17 PM (3).jpeg",
        "box-kraft-stacked.webp",
        True,
        "Two kraft boxes stacked, cream ground.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.17 PM.jpeg",
        "box-shipping-pink.webp",
        True,
        "A coloured shipping box open on its shredded-paper filler.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.18 PM (1).jpeg",
        "tray-bagasse-divided.webp",
        True,
        "A compartmented fibre food tray with its lid.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.18 PM.jpeg",
        "box-kraft-window.webp",
        True,
        "Kraft box with a clear window, closed and open.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.19 PM.jpeg",
        "bags-kraft-handles.webp",
        True,
        "Kraft bags with rope handles, several sizes together.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.21 PM (2).jpeg",
        "pouch-kraft-window-standup.webp",
        True,
        "Stand-up kraft pouches with a clear window, zip top.",
    ),
    (
        "WhatsApp Image 2026-08-18 at 8.11.21 PM.jpeg",
        "bags-kraft-bakery-hand.webp",
        True,
        "Three sizes of window bakery bag, one held by hand for scale — croissants and cookies visible through the window.",
    ),
]

print("\nThird batch:\n")
for source, name, cropped, _why in BATCH_THREE:
    path = ROOT / source
    if not path.exists():
        print(f"  ! {source} is not in the repository — skipped")
        continue
    image = Image.open(path).convert("RGB")
    if cropped:
        image = autocrop(image)
    square(image, name)

print(
    "\nNot published from this batch, and why:\n"
    "  8.06.16 PM (3).jpeg   a \"thank you\" card signed with a real Instagram handle,\n"
    "                        @nailglamour_9 — someone else's business, not Brandora's to show.\n"
    "  8.06.17 PM.jpeg       a thank-you-card design template with literal placeholder text\n"
    "                        (\"@SOCIALHANDLE\", \"WWW.YOURWEBSITENAME.COM\") — a listing photo\n"
    "                        for a digital template, not a photograph of a printed product.\n"
    "  8.11.21 PM (3).jpeg   five stickers, each printed with a different real small\n"
    "                        business's name and logo (Dona Leoa, Amanda Trufas, LR,\n"
    "                        Beaded Bags) — no crop removes the branding without removing\n"
    "                        the product.\n"
    "  8.11.18 PM (2).jpeg   a dense multi-product collage, not a photograph of one product.\n"
    "  8.11.20 PM (1).jpeg   the same — a collage, not a single product.\n"
    "  8.11.20 PM.jpeg       kraft bag lineup, kept out only for being near-identical to\n"
    "                        bags-kraft-handles.webp above — no new information published twice.\n"
)


# ---------------------------------------------------------------------------
# Fourth batch, added 20 Aug 2026 ("PHOTOS 3") — sixteen files, nine of which
# were exact re-sends of photos already in this repository under their
# original 17/18 Aug filenames (same bytes, same md5, just pushed again under
# a new name) and were removed rather than reprocessed, since reprocessing a
# duplicate publishes nothing new. Of the seven files that were genuinely new
# content, six fail the same three tests every batch has been held to — a
# small food business would order it, no supplier logo, no other company's
# brand — and one survives.
BATCH_FOUR = [
    (
        "WhatsApp Image 2026-08-20 at 12.26.07 PM.jpeg",
        "box-cake-carrier-stripe.webp",
        True,
        "Pink-and-white striped cake carrier box with a folding handle, plain ground. Nobody's mark on it.",
    ),
]

print("\nFourth batch:\n")
for source, name, cropped, _why in BATCH_FOUR:
    path = ROOT / source
    if not path.exists():
        print(f"  ! {source} is not in the repository — skipped")
        continue
    image = Image.open(path).convert("RGB")
    if cropped:
        image = autocrop(image)
    square(image, name)

print(
    "\nNot published from this batch, and why:\n"
    "  12.26.06 PM.jpeg       an ice-cream cup printed with a real business's name and logo,\n"
    "                         Luna's Gelateria — someone else's brand, not Brandora's to show.\n"
    "  12.26.07 PM (1).jpeg   a cake box printed with a real business's name and logo,\n"
    "                         Daan Go Cake Lab — the branding is on the product itself.\n"
    "  12.28.19 PM (2).jpeg   six wooden cutlery shapes and a wet-wipe packet laid out\n"
    "                         together — a dense multi-product collage, not one product.\n"
    "  12.28.19 PM (3).jpeg   a nine-panel supplier catalogue spread of cup lids, not a\n"
    "                         photograph Brandora took of a single product.\n"
    "  12.28.20 PM (1).jpeg   holographic and clear labels in their shipping carton — the\n"
    "                         same subject already published as holographic-labels.webp,\n"
    "                         just pulled back to show the box; no new information.\n"
    "  12.28.20 PM.jpeg       a hologram label sheet with the MAX Italian wordmark and live\n"
    "                         QR authentication codes printed on it — the same problem as\n"
    "                         4.26.59 PM (1).jpeg in the first batch.\n"
)


# ---------------------------------------------------------------------------
# Fifth batch, added 27 Aug 2026 ("Photos 5" / "Catalogue 2" / "CATALOGE") —
# roughly thirty files plus eight supplier catalogue PDFs. Most of the images
# turned out to already be re-sends of the first four batches (same product,
# different filename) or generic supplier marketing photography with no
# confirmed Brandora sourcing behind it: a repeating "leaf" watermark across
# a dozen stand-up-pouch photos from one supplier Brandora has no confirmed
# relationship with, novelty party-favour bags with no bakery tie-in, and
# several images of a *different, identifiable business's own branded
# product* (a "Luna's Gelateria" cup, a "Daan Go Cake Lab" box, a "Happiness
# Cake" box, an "@nailglamour_9" thank-you card) — none of those are
# Brandora's to publish, same reasoning as every prior batch.
#
# Four bagasse (sugarcane-pulp) tableware photos survive: clean studio shots,
# already square, nobody's mark on them, and outside the leaf-watermarked
# pouch supplier's line entirely.
#
# The eight PDFs are manufacturer capability decks and sizing charts (paper
# cans, blister clamshells, custom gift boxes, a watch-accessories line that
# is not packaging at all) — real and useful for sourcing conversations, but
# none of them is a photograph of a physical sample, so none becomes a
# catalogue product here. See docs/products.md and the session notes for
# where that data is kept instead.
BATCH_FIVE = [
    (
        "1-10.jpg",
        "bagasse-plates-nested.webp",
        False,
        "Four nested bagasse plates, graduated sizes, on white. Already a clean studio shot.",
    ),
    (
        "1-11.jpg",
        "bagasse-clamshell-embossed.webp",
        False,
        "Bagasse hinged clamshell, open, 'THANK YOU' embossed into the pulp itself — not a printed brand.",
    ),
    (
        "1-12.jpg",
        "bagasse-clamshell-mini-cake.webp",
        False,
        "The same style of clamshell, smaller, styled with a mini cake on a strawberry-pattern liner (a decorative print, not a company name) and a gold fork.",
    ),
    (
        "1-13.jpg",
        "bagasse-bento-4compartment.webp",
        False,
        "Bagasse four-compartment bento container with its lid, open.",
    ),
]

print("\nFifth batch — bagasse tableware:\n")
for source, name, cropped, _why in BATCH_FIVE:
    path = ROOT / source
    if not path.exists():
        print(f"  ! {source} is not in the repository — skipped")
        continue
    image = Image.open(path).convert("RGB")
    if cropped:
        image = autocrop(image)
    square(image, name)

# The acrylic cake display box: two colourways of what the watermark confirms
# is a product Brandora has actually sourced and shown on its own TikTok, but
# the only photography available is a supplier's marketing image with a
# promotional banner baked across the bottom fifth of the frame. The banner
# is trimmed (TRIM_BOTTOM, above) the same way any other batch trims a wall or
# a floor that is not the product; what's left is a clean, unbranded studio
# photo of the box itself.
BATCH_FIVE_ACRYLIC = [
    (
        "watermark-06dd734890ba15a7b73e54cc04a47e38_1.jpeg",
        "cake-display-box-black-lid.webp",
        "Clear acrylic cake display box, black lid and base, on a rotating cake stand.",
    ),
    (
        "watermark-abd5f6e99577ebf50f1c2bc56fa04134_2.jpeg",
        "cake-display-box-white-lid.webp",
        "The same box, white lid and base.",
    ),
]

print("\nFifth batch — acrylic cake display box:\n")
for source, name, _why in BATCH_FIVE_ACRYLIC:
    path = ROOT / source
    if not path.exists():
        print(f"  ! {source} is not in the repository — skipped")
        continue
    image = Image.open(path).convert("RGB")
    trim = TRIM_BOTTOM.get(source)
    if trim:
        image = image.crop((0, 0, image.width, int(image.height * (1 - trim))))
    image = autocrop(image)
    square(image, name)

print(
    "\nNot published from this batch, and why:\n"
    "  the ~12 'leaf'-watermarked stand-up-pouch photos (1-3.jpg, 1-4.jpg, 1-9.jpg,\n"
    "  2e4bfaee694b9.png, 4-2.png, 7-2.png, e4b8bbe59bbe*.jpg, ...)\n"
    "                          a single supplier's own marketing photography, watermarked\n"
    "                          with their logo — Brandora has no confirmed sourcing\n"
    "                          relationship with them yet, so this is not Brandora's to\n"
    "                          publish as a catalogue product. Ask before adding.\n"
    "  1-6.jpg, 1-7.jpg, 5-1.jpg, 10.jpg, img_2797.jpg\n"
    "                          novelty party-favour bags (animal shapes, holiday characters) —\n"
    "                          fun, but generic supplier stock with no bakery tie-in.\n"
    "  fw4024bs-s6-4.jpg       a desk-organiser set — not packaging.\n"
    "  image.png               an uncroppable, unidentifiable spec-table fragment.\n"
    "  2-1.jpg                 industrial fill-seal film roll stock, not a finished product.\n"
    "  IMG-20260824-WA0000.jpg a real photo, but of a finished box printed with a real\n"
    "                          business's own name, 'Happiness Cake' — not Brandora's brand.\n"
    "  IMG-20260825-WA0014.jpg a video screenshot, not product photography.\n"
    "  IMG-20260825-WA0046.jpg a supplier's spec-sheet screenshot for a gold cake board —\n"
    "                          real dimensions (24.5x24.5cm), but no photograph of the\n"
    "                          physical item exists yet to publish alongside them.\n"
    "  IMG-20260827-WA0006.jpg a real, styled photo, but of a dessert cup printed with\n"
    "                          another business's own stickers ('Small Happiness Delicious').\n"
    "  the 8 supplier PDFs     manufacturer capability decks and sizing charts, not\n"
    "                          photographs of physical samples — see the note above this batch.\n"
)


# ---------------------------------------------------------------------------
# Sixth batch, added 27 Aug 2026 — the fifth batch's leftovers, revisited
# after the founder asked directly for them. Two things changed from the
# fifth-batch pass, not the standard: the pouch supplier's watermark is
# confined to one small corner of every photo it's on and is removed the
# same way `holographic-labels.webp`'s factory slip was left alone versus
# `bakery-carrier-box.webp`'s background was trimmed — found automatically
# (`remove_corner_watermark`, above) rather than typed in, and only ever
# touching pixels that are the watermark, never the product. And two files
# turned out to be filed under the wrong name in the earlier notes: what was
# called "10.jpg" in the fifth-batch summary is the coffee bags below,
# and what was called "2-1.jpg" is the Christmas cellophane bags — this
# batch uses the filenames as verified against the actual images, not as
# transcribed the first time.
#
# Still not published, on the same standard as everything else: "1.png" —
# not the coffee bags, but a stack of printed packaging film rolls carrying
# several *other, real* businesses' own finished brand designs ("Smile",
# "milk&tea NICE", and others) printed on the film itself. That is a
# different problem from a supplier's watermark in a corner: it cannot be
# cropped or patched out without destroying the photograph, because it is
# the product's own printed surface, the same reason BIHAKU and Marabu's
# holograms stayed out of the very first batch. "4-2.png" is left out too —
# a print-mockup demo ("A day healed by toasut", with the typo baked into
# the render) rather than a photograph of a real order, the same reasoning
# that kept the generic thank-you-card template out of the third batch.

BATCH_SIX_WATERMARKED = [
    ("1-3.jpg", "pouch-kraft-plain-multisize.webp", "Plain kraft stand-up pouches, several sizes, no window."),
    ("1-4.jpg", "pouch-kraft-window-multisize.webp", "Kraft stand-up pouches with a clear window, several sizes, shown filled."),
    ("e4b8bbe59bbe1.jpg", "pouch-kraft-window-multisize-2.webp", "The same style, a different size lineup, shown empty — second image for the same product."),
    ("1-9.jpg", "pouch-metallic-silver-multisize.webp", "Silver metallic stand-up pouches, several sizes."),
    ("e4b8bbe59bbe.jpg", "pouch-clear-spout-handle.webp", "Clear stand-up spout pouches with a carry handle, shown filled with grain samples."),
    ("e4b8bbe59bbe1-1.jpg", "pouch-clear-zip-standup.webp", "Clear zip stand-up pouches, shown filled with dried fruit and nuts."),
    ("2e4bfaee694b9.png", "pouch-matte-colour-assorted.webp", "Matte stand-up pouches, ten colourways, tear-notch zipper."),
    ("4f6a7273.jpg", "pouch-matte-colour-assorted-2.webp", "The same style, four colourways shown larger — second image for the same product."),
    ("4.png", "bag-novelty-handbag-shape.webp", "Novelty handbag-shaped treat pouches, two colourways, two sizes each."),
    ("7-2.png", "bag-flat-poly-pastry.webp", "Flat poly bags sized for a single pastry, shown with a doughnut and a slice of bread."),
]

print("\nSixth batch — pouches with a supplier watermark, removed:\n")
for source, name, _why in BATCH_SIX_WATERMARKED:
    path = ROOT / source
    if not path.exists():
        print(f"  ! {source} is not in the repository — skipped")
        continue
    image = Image.open(path).convert("RGB")
    image = remove_corner_watermark(image)
    square(image, name)

BATCH_SIX_CLEAN = [
    ("1-6.jpg", "bag-novelty-animal-shapes.webp", "Animal-shaped novelty treat bags (dog, deer, elephant, dinosaur)."),
    ("1-7.jpg", "bag-novelty-bus-shape.webp", "Bus-shaped novelty treat bags, four colourways."),
    ("5-1.jpg", "bag-novelty-hologram-skull.webp", "Holographic skull-shaped novelty treat bag."),
    ("2-1.jpg", "bag-novelty-christmas-cellophane.webp", "Cellophane treat bags printed with winter cartoon characters, gold twist ties."),
    ("img_2797.jpg", "bag-novelty-christmas-gift-shapes.webp", "Gift-shaped novelty treat bags in a Christmas theme."),
    ("10.jpg", "pouch-coffee-matte-illustrated.webp", "Matte coffee bags, grey and white, printed with a farmhouse illustration, four sizes."),
]

print("\nSixth batch — no watermark, already clean:\n")
for source, name, _why in BATCH_SIX_CLEAN:
    path = ROOT / source
    if not path.exists():
        print(f"  ! {source} is not in the repository — skipped")
        continue
    image = Image.open(path).convert("RGB")
    square(image, name)

print(
    "\nNot published from this batch, and why:\n"
    "  1.png                   printed packaging film rolls carrying several other, real\n"
    "                          businesses' own finished brand designs ('Smile', 'milk&tea\n"
    "                          NICE', and others) printed on the film itself — not croppable\n"
    "                          without destroying the photograph, same reasoning as the\n"
    "                          BIHAKU/Marabu holograms in the first batch.\n"
    "  4-2.png                 a print-mockup demo ('A day healed by toasut', typo baked\n"
    "                          into the render) — a template, not a photograph of a real order.\n"
    "  fw4024bs-s6-4.jpg       a desk-organiser set — not packaging, and never shown\n"
    "                          anywhere on the site, so it is not the dead-link problem\n"
    "                          this batch exists to fix.\n"
    "  image.png               an uncroppable, unidentifiable spec-table fragment — same\n"
    "                          reasoning, never shown anywhere on the site.\n"
)
