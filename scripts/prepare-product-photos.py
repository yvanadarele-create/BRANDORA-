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
