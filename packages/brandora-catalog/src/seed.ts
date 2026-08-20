/**
 * Example products — fixtures, not merchandise.
 *
 * ## What these are, and why the shipped catalogue is empty
 *
 * Every product below was written by hand. The names, the descriptions, the
 * materials and — the part that matters — the *prices* are invented. No
 * supplier quoted 165 FCFA for a kraft cup; that number was typed into this
 * file. Several carried `verified` customization, which the interface renders
 * as "Confirmed: carries your logo", a sentence that claims a real supplier
 * confirmed a real capability. None had.
 *
 * A plausible price on a real-looking shelf is not a placeholder. It is the
 * number a founder repeats to a customer, and the number a quote is built from.
 * Brandora exists to connect people to manufacturers Brandora has actually
 * verified, and shipping invented ones is the precise opposite of that.
 *
 * So `CATALOG` — what the application serves — is empty, and stays empty until
 * real products from real, confirmed manufacturers are entered. The catalogue
 * page has a state for that and says so plainly.
 *
 * These fixtures remain because the filtering, pricing, ranking and package
 * logic all need products to be tested against, and a test fixture is honest
 * about being one. They are exported under a name nobody can mistake, and the
 * check in `scripts/check-catalog.mjs` fails the build if they ever reach the
 * shipped catalogue again.
 *
 * Minimum quantities are low on purpose. §64 makes small quantities a core
 * advantage: a founder testing an idea with thirty cups is the customer this
 * catalogue is for, and that stays true of the real one.
 */

import {
  type BrandoraProduct,
  type Customization,
  type ProductCategory,
  DEFAULT_CURRENCY,
  fromMajor,
  money,
  zero,
} from "@brandora/shared";

const NOW = "2026-01-01T00:00:00.000Z";

interface SeedInput {
  id: string;
  name: string;
  /** See `BrandoraProduct.nameFr`. */
  nameFr?: string;
  category: ProductCategory;
  subcategory: string;
  description: string;
  /** See `BrandoraProduct.descriptionFr`. */
  descriptionFr?: string;
  material?: string;
  /** See `BrandoraProduct.shape`. */
  shape?: string;
  colors: string[];
  minimumQuantity: number;
  availableQuantity: number;
  /**
   * Major units, XOF. Omit together with `quoteOnRequest: true` when no
   * landed price has been computed yet — never a guess dressed as a number.
   */
  unitPrice?: number;
  /** See `BrandoraProduct.quoteOnRequest`. */
  quoteOnRequest?: boolean;
  /** See `BrandoraProduct.supplierReference`. Required for anything real. */
  supplierReference?: { supplierId: string; name: string; platform?: string };
  /** See `BrandoraProduct.sourcingInProgress`. */
  sourcingInProgress?: boolean;
  customization: Customization;
  featured?: boolean;
  volumeMl?: number;
  weightG?: number;
  lengthMm?: number;
  widthMm?: number;
  /** Overrides the default `/assets/img/catalog/<id>.webp` guess. */
  images?: string[];
}

const verified = (methods: Customization["methods"], unitPrice: number, minimumUnits: number, notes: string): Customization => ({
  confidence: "verified",
  methods,
  unitCost: fromMajor(unitPrice),
  setupCost: money(0),
  minimumUnits,
  notes,
});

const unknown = (methods: Customization["methods"], notes: string): Customization => ({
  confidence: "unknown",
  methods,
  notes,
});

const SEED: SeedInput[] = [
  /* --- Packaging -------------------------------------------------------- */
  {
    id: "prd_cup_kraft_250",
    name: "Kraft paper cup, 250ml",
    category: "packaging",
    subcategory: "cups",
    description:
      "Single-wall kraft cup for hot drinks. Takes a one-colour logo cleanly and stacks tightly, which keeps shipping cheap.",
    material: "Kraft paper, PE lined",
    colors: ["kraft", "white"],
    minimumQuantity: 25,
    availableQuantity: 40_000,
    unitPrice: 165,
    volumeMl: 250,
    weightG: 9,
    customization: verified(["logo-print"], 45, 25, "One or two colours. Full colour needs 100 units."),
    featured: true,
  },
  {
    id: "prd_cup_matte_black_350",
    name: "Premium matte cup, 350ml",
    category: "packaging",
    subcategory: "cups",
    description:
      "Double-wall matte cup. Holds heat without a sleeve and photographs well — the reason premium cafés choose it.",
    material: "Double-wall paper, matte finish",
    colors: ["black", "white", "sand"],
    minimumQuantity: 30,
    availableQuantity: 12_000,
    unitPrice: 310,
    volumeMl: 350,
    weightG: 14,
    customization: verified(["logo-print"], 70, 30, "Metallic foil available from 200 units."),
    featured: true,
  },
  {
    id: "prd_bottle_glass_500",
    name: "Glass bottle, 500ml",
    category: "packaging",
    subcategory: "bottles",
    description: "Clear glass with a screw cap. For juice, oil, sauces and cold drinks.",
    material: "Glass",
    colors: ["clear", "amber"],
    minimumQuantity: 24,
    availableQuantity: 6_000,
    unitPrice: 620,
    volumeMl: 500,
    weightG: 310,
    customization: verified(["sticker", "engraving"], 90, 24, "Labels are cheaper below 200 units; engraving above."),
  },
  {
    id: "prd_box_mailer_small",
    name: "Kraft mailer box, small",
    category: "packaging",
    subcategory: "boxes",
    description: "Self-locking mailer, no tape needed. Ships flat, folds in seconds.",
    material: "Corrugated kraft",
    colors: ["kraft", "white", "black"],
    minimumQuantity: 20,
    availableQuantity: 15_000,
    unitPrice: 390,
    weightG: 60,
    customization: verified(["logo-print", "sticker"], 85, 20, "One-colour print outside; inside print from 250."),
    featured: true,
  },
  {
    id: "prd_bag_paper_handle",
    name: "Paper bag with rope handle",
    category: "packaging",
    subcategory: "bags",
    description: "Twisted rope handle, reinforced base. The bag customers keep and reuse.",
    material: "Kraft paper, 150gsm",
    colors: ["kraft", "white", "black"],
    minimumQuantity: 20,
    availableQuantity: 22_000,
    unitPrice: 340,
    weightG: 45,
    customization: verified(["logo-print"], 75, 20, "Both sides printable at the same price."),
  },
  {
    id: "prd_pouch_standing",
    name: "Stand-up pouch with zip",
    category: "packaging",
    subcategory: "pouches",
    description: "Resealable, food-safe, stands on a shelf. For spices, granola, coffee and dried goods.",
    material: "Multilayer foil",
    colors: ["matte black", "kraft", "white"],
    minimumQuantity: 50,
    availableQuantity: 9_000,
    unitPrice: 280,
    weightG: 12,
    customization: verified(["sticker", "logo-print"], 60, 50, "Below 300 units a printed label beats printing the pouch."),
  },
  {
    id: "prd_container_deli_500",
    name: "Deli container with lid, 500ml",
    category: "packaging",
    subcategory: "containers",
    description: "Leak-resistant, microwave-safe, stackable. The workhorse of a takeaway kitchen.",
    material: "PP",
    colors: ["clear", "black"],
    minimumQuantity: 50,
    availableQuantity: 30_000,
    unitPrice: 145,
    volumeMl: 500,
    weightG: 22,
    customization: unknown(["sticker"], "Lid printing not yet confirmed with a supplier — labels are the safe route."),
  },

  /* --- Brand materials -------------------------------------------------- */
  {
    id: "prd_sticker_circle_50",
    name: "Circular stickers, 50mm",
    category: "brand-materials",
    subcategory: "stickers",
    description:
      "The cheapest way to put your brand on something. Seals a bag, closes a box, turns plain packaging into yours.",
    material: "Vinyl, matte",
    colors: ["full colour"],
    minimumQuantity: 50,
    availableQuantity: 100_000,
    unitPrice: 55,
    weightG: 1,
    customization: verified(["sticker"], 0, 50, "Full colour included in the price."),
    featured: true,
  },
  {
    id: "prd_label_roll",
    name: "Product labels on a roll",
    category: "brand-materials",
    subcategory: "labels",
    description: "Waterproof labels sized to your container. Survives a fridge and a wet hand.",
    material: "Synthetic paper",
    colors: ["full colour", "clear"],
    minimumQuantity: 100,
    availableQuantity: 50_000,
    unitPrice: 42,
    weightG: 1,
    customization: verified(["sticker"], 0, 100, "Die-cut to your shape from 250 units."),
  },
  {
    id: "prd_card_business_350",
    name: "Business cards, 350gsm",
    category: "brand-materials",
    subcategory: "business-cards",
    description: "Thick uncoated stock that feels like a decision rather than a printout.",
    material: "350gsm uncoated",
    colors: ["full colour"],
    minimumQuantity: 100,
    availableQuantity: 80_000,
    unitPrice: 48,
    weightG: 1,
    customization: verified(["logo-print"], 0, 100, "Spot foil and embossing available from 500."),
  },
  {
    id: "prd_card_thankyou",
    name: "Thank-you cards",
    category: "brand-materials",
    subcategory: "thank-you-cards",
    description: "A small card in the box. The cheapest repeat-purchase tool there is.",
    material: "300gsm matte",
    colors: ["full colour"],
    minimumQuantity: 50,
    availableQuantity: 40_000,
    unitPrice: 65,
    weightG: 3,
    customization: verified(["logo-print"], 0, 50, "Handwriting space on the reverse by default."),
    featured: true,
  },
  {
    id: "prd_flyer_a5",
    name: "A5 flyers",
    category: "brand-materials",
    subcategory: "flyers",
    description: "For markets, deliveries and anywhere a person will take something from your hand.",
    material: "170gsm gloss",
    colors: ["full colour"],
    minimumQuantity: 100,
    availableQuantity: 60_000,
    unitPrice: 58,
    weightG: 5,
    customization: verified(["logo-print"], 0, 100, "Double-sided at no extra cost."),
  },
  {
    id: "prd_menu_a4",
    name: "Laminated A4 menu",
    category: "brand-materials",
    subcategory: "menus",
    description: "Wipe-clean menu for a counter or a table.",
    material: "Laminated 250gsm",
    colors: ["full colour"],
    minimumQuantity: 10,
    availableQuantity: 5_000,
    unitPrice: 850,
    weightG: 20,
    customization: verified(["logo-print"], 0, 10, "Reprints are cheap — change prices without panic."),
  },

  /* --- Tableware --------------------------------------------------------- */
  {
    id: "prd_plate_stoneware",
    name: "Stoneware plate, 26cm",
    category: "tableware",
    subcategory: "plates",
    description: "Matte glaze, chip-resistant rim. For a restaurant that wants its plates recognised.",
    material: "Stoneware",
    colors: ["black", "sand", "white"],
    minimumQuantity: 12,
    availableQuantity: 3_000,
    unitPrice: 2_400,
    weightG: 620,
    customization: unknown(["engraving", "sublimation"], "Under-glaze branding needs a factory sample first."),
  },
  {
    id: "prd_bowl_stoneware",
    name: "Stoneware bowl, 15cm",
    category: "tableware",
    subcategory: "bowls",
    description: "Deep bowl for rice, salads and sauces. Matches the 26cm plate.",
    material: "Stoneware",
    colors: ["black", "sand", "white"],
    minimumQuantity: 12,
    availableQuantity: 3_000,
    unitPrice: 1_950,
    weightG: 480,
    customization: unknown(["engraving"], "Not yet confirmed."),
  },
  {
    id: "prd_cutlery_set",
    name: "Stainless cutlery set, 4 piece",
    category: "tableware",
    subcategory: "cutlery",
    description: "Brushed stainless. Laser engraving on the handle is possible and permanent.",
    material: "Stainless steel 304",
    colors: ["silver", "matte black", "gold"],
    minimumQuantity: 12,
    availableQuantity: 4_000,
    unitPrice: 3_200,
    weightG: 220,
    customization: verified(["engraving"], 350, 12, "Engraving is per piece, not per set."),
  },

  /* --- Merchandise ------------------------------------------------------- */
  {
    id: "prd_tshirt_cotton",
    name: "Cotton T-shirt, 180gsm",
    category: "merchandise",
    subcategory: "t-shirts",
    description: "Combed cotton, holds its shape after washing. For staff and for selling.",
    material: "100% combed cotton",
    colors: ["black", "white", "sand", "navy"],
    minimumQuantity: 10,
    availableQuantity: 20_000,
    unitPrice: 3_900,
    weightG: 180,
    customization: verified(["logo-print", "embroidery"], 700, 10, "Print for large artwork, embroidery for a small chest logo."),
    featured: true,
  },
  {
    id: "prd_tote_canvas",
    name: "Canvas tote bag",
    category: "merchandise",
    subcategory: "tote-bags",
    description: "Heavy canvas with long handles. Walks around town carrying your logo for years.",
    material: "280gsm canvas",
    colors: ["natural", "black"],
    minimumQuantity: 20,
    availableQuantity: 12_000,
    unitPrice: 2_150,
    weightG: 160,
    customization: verified(["logo-print", "embroidery"], 550, 20, "One-colour print is the best value at small volumes."),
  },
  {
    id: "prd_apron_canvas",
    name: "Canvas apron with pocket",
    category: "merchandise",
    subcategory: "aprons",
    description: "Adjustable neck strap, front pocket. Makes a home kitchen look like a business.",
    material: "Cotton canvas",
    colors: ["black", "khaki", "natural"],
    minimumQuantity: 10,
    availableQuantity: 6_000,
    unitPrice: 4_300,
    weightG: 320,
    customization: verified(["embroidery", "logo-print"], 900, 10, "Embroidery survives commercial washing; print does not."),
  },
  {
    id: "prd_mug_ceramic",
    name: "Ceramic mug, 330ml",
    category: "merchandise",
    subcategory: "mugs",
    description: "Standard mug body, dishwasher-safe print. The gift that stays on a desk.",
    material: "Ceramic",
    colors: ["white", "black", "matte black"],
    minimumQuantity: 12,
    availableQuantity: 15_000,
    unitPrice: 1_850,
    weightG: 340,
    customization: verified(["sublimation"], 400, 12, "Full colour wrap. Matte black takes laser engraving instead."),
  },
];

function toProduct(seed: SeedInput): BrandoraProduct {
  return {
    id: seed.id,
    name: seed.name,
    ...(seed.nameFr ? { nameFr: seed.nameFr } : {}),
    category: seed.category,
    subcategory: seed.subcategory,
    description: seed.description,
    ...(seed.descriptionFr ? { descriptionFr: seed.descriptionFr } : {}),
    images: seed.images ?? [`/assets/img/catalog/${seed.id.replace("prd_", "")}.webp`],
    material: seed.material,
    ...(seed.shape ? { shape: seed.shape } : {}),
    dimensions: {
      volumeMl: seed.volumeMl,
      weightG: seed.weightG,
      lengthMm: seed.lengthMm,
      widthMm: seed.widthMm,
    },
    colors: seed.colors,
    minimumQuantity: seed.minimumQuantity,
    availableQuantity: seed.availableQuantity,
    indicativeUnitPrice: seed.quoteOnRequest ? zero(DEFAULT_CURRENCY) : fromMajor(seed.unitPrice ?? 0),
    ...(seed.quoteOnRequest ? { quoteOnRequest: true as const } : {}),
    ...(seed.supplierReference ? { supplierReference: seed.supplierReference } : {}),
    ...(seed.sourcingInProgress ? { sourcingInProgress: true as const } : {}),
    customization: seed.customization,
    variants: [],
    status: "active",
    featured: seed.featured ?? false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/**
 * Fixtures. Never served to anyone.
 *
 * Imported by tests, and by nothing that runs in production.
 */
export const EXAMPLE_CATALOG: readonly BrandoraProduct[] = SEED.map(toProduct);

/* --- Real products ---------------------------------------------------------
 *
 * Unlike SEED above, every field here traces to something a real supplier
 * said, photographed, or wrote in a spec sheet — see sourcing/README.md for
 * where that evidence lives (git-ignored; it carries a supplier's contact
 * details, and this repository is public).
 *
 * None of these three carry a price. Shenzhen Zhengbiao quoted a per-lot cost
 * in USD to their factory gate; turning that into a customer price in XOF
 * needs international freight, customs and local delivery, none of which is
 * quoted yet, and Brandora's own quote engine (quote-pricing.ts) refuses to
 * silently treat a missing cost as zero. So `quoteOnRequest: true` and no
 * `unitPrice` — a visitor can see the product and its real MOQ, and asks for
 * a quote rather than reading an invented number.
 */
const REAL_SEED: SeedInput[] = [
  {
    id: "prd_label_holo_round_20",
    name: "Round holographic security label, 20×20mm",
    nameFr: "Étiquette de sécurité holographique ronde, 20×20mm",
    category: "brand-materials",
    subcategory: "labels",
    description:
      "Tamper-evident holographic film, round, 20mm. Quoted by the manufacturer per production lot, from 10,000 pieces — well above a single small order, which is why Brandora is asking them about smaller pilot quantities before listing a price.",
    descriptionFr:
      "Film holographique inviolable, rond, 20mm. Prix communiqué par le fabricant par lot de production, à partir de 10 000 pièces — bien au-delà d'une petite commande, ce qui explique pourquoi Brandora leur demande des quantités pilotes plus faibles avant d'afficher un prix.",
    material: "Holographic film",
    shape: "round",
    lengthMm: 20,
    widthMm: 20,
    colors: ["gold / rainbow"],
    minimumQuantity: 10_000,
    availableQuantity: 100_000,
    quoteOnRequest: true,
    supplierReference: {
      supplierId: "SUP-0003",
      name: "Shenzhen Zhengbiao Anti-Counterfeit Technology Co., Ltd",
      platform: "made-in-china",
    },
    customization: unknown([], "Whether Brandora's own artwork or a serial sequence can be added to this label has not been confirmed with the manufacturer."),
    images: ["/assets/img/sourcing/holographic-labels.webp"],
  },
  {
    id: "prd_label_holo_rect_1625",
    name: "Rectangular holographic security label, 16×25mm",
    nameFr: "Étiquette de sécurité holographique rectangulaire, 16×25mm",
    category: "brand-materials",
    subcategory: "labels",
    description:
      "Tamper-evident holographic film, rectangular, 16×25mm. Same manufacturer and minimum order as the round label.",
    descriptionFr:
      "Film holographique inviolable, rectangulaire, 16×25mm. Même fabricant et même quantité minimale que l'étiquette ronde.",
    material: "Holographic film",
    shape: "rectangular",
    lengthMm: 25,
    widthMm: 16,
    colors: ["gold / rainbow"],
    minimumQuantity: 10_000,
    availableQuantity: 100_000,
    quoteOnRequest: true,
    supplierReference: {
      supplierId: "SUP-0003",
      name: "Shenzhen Zhengbiao Anti-Counterfeit Technology Co., Ltd",
      platform: "made-in-china",
    },
    customization: unknown([], "Whether Brandora's own artwork or a serial sequence can be added to this label has not been confirmed with the manufacturer."),
    images: ["/assets/img/sourcing/holographic-labels.webp"],
  },
  {
    id: "prd_label_holo_rect_1625_qr",
    name: "Rectangular holographic label with QR code and serial, 16×25mm",
    nameFr: "Étiquette holographique rectangulaire avec code QR et numéro de série, 16×25mm",
    category: "brand-materials",
    subcategory: "labels",
    description:
      "The same holographic film with a printed QR code and a unique serial number per label, for scan-to-verify authentication. Longer production time than the plain labels (9–10 days against 7–9) because each one is individually numbered.",
    descriptionFr:
      "Le même film holographique, avec un code QR imprimé et un numéro de série unique par étiquette, pour une authentification par scan. Délai de production plus long que les étiquettes simples (9 à 10 jours contre 7 à 9), car chaque étiquette est numérotée individuellement.",
    material: "Holographic film",
    shape: "rectangular",
    lengthMm: 25,
    widthMm: 16,
    colors: ["gold / rainbow"],
    minimumQuantity: 10_000,
    availableQuantity: 100_000,
    quoteOnRequest: true,
    supplierReference: {
      supplierId: "SUP-0003",
      name: "Shenzhen Zhengbiao Anti-Counterfeit Technology Co., Ltd",
      platform: "made-in-china",
    },
    customization: unknown([], "Whether Brandora's own artwork can be combined with the QR/serial system has not been confirmed with the manufacturer."),
    images: ["/assets/img/sourcing/holographic-labels.webp"],
  },
];

/* --- Products Brandora is sourcing, not yet placed with a manufacturer ----
 *
 * Every photo below is real — the same ones on the homepage's "what we can
 * have made" gallery, traced in `scripts/prepare-product-photos.py` and, for
 * a few, in `sourcing/extracted-2026-08-18.json`. What none of them has is a
 * `supplierReference`: the photographs do not name the factory that made
 * them, so no manufacturer is attached rather than one being guessed (see
 * that file's own note on why Shanghai Forests Packaging Group — a real
 * lead — is not linked to these specific photos).
 *
 * Without a supplier there is no confirmed minimum order and no confirmed
 * stock either, so `minimumQuantity` and `availableQuantity` are both `0` —
 * never a plausible-looking number nobody said — and `sourcingInProgress`
 * marks that explicitly so the interface shows "sourcing in progress"
 * instead of silently rendering "Minimum 0". `quoteOnRequest` is always true
 * alongside it, because there is no price either. A visitor can still see
 * the product, ask for it at any quantity, and Brandora goes and confirms a
 * real manufacturer before any number is quoted.
 */
const SOURCING_SEED: SeedInput[] = [
  {
    id: "prd_box_bakery_gable",
    name: "Gable-top bakery box with handle",
    nameFr: "Boîte gâteau gable-top avec poignée",
    category: "packaging",
    subcategory: "boxes",
    description:
      "White board cake box that folds flat and carries by handle panels cut into the sides. Photographed closed and open.",
    descriptionFr:
      "Boîte à gâteau en carton blanc, pliable à plat, avec des panneaux-poignées découpés sur les côtés. Photographiée fermée et ouverte.",
    material: "White corrugated board",
    colors: ["white"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print"], "No manufacturer confirmed yet for this box — tell us your size and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/bakery-gable-box.webp", "/assets/img/sourcing/bakery-gable-box-open.webp"],
  },
  {
    id: "prd_box_bakery_carrier",
    name: "Carrier box with cut-out handle",
    nameFr: "Boîte porte-gâteau à poignée découpée",
    category: "packaging",
    subcategory: "boxes",
    description:
      "Shallower cake carrier box, wider handle, shown side-on, carried, and open. The pink-striped version is the same style in a printed finish.",
    descriptionFr:
      "Boîte porte-gâteau plus basse, poignée plus large, montrée de côté, portée, puis ouverte. La version à rayures roses est le même modèle en version imprimée.",
    material: "White corrugated board",
    colors: ["white", "pink stripe"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print"], "No manufacturer confirmed yet for this box — tell us your size and quantity and Brandora will source it."),
    images: [
      "/assets/img/sourcing/bakery-carrier-box.webp",
      "/assets/img/sourcing/bakery-carrier-in-hand.webp",
      "/assets/img/sourcing/bakery-carrier-open.webp",
      "/assets/img/sourcing/box-cake-carrier-stripe.webp",
    ],
  },
  {
    id: "prd_box_kraft_small",
    name: "Small kraft box",
    nameFr: "Petite boîte kraft",
    category: "packaging",
    subcategory: "boxes",
    description: "Small kraft box shown closed, open, and stacked two-high.",
    descriptionFr: "Petite boîte kraft montrée fermée, ouverte, puis empilée par deux.",
    material: "Kraft board",
    colors: ["kraft"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print", "sticker"], "No manufacturer confirmed yet for this box — tell us your size and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/box-kraft-small.webp", "/assets/img/sourcing/box-kraft-stacked.webp"],
  },
  {
    id: "prd_box_kraft_window",
    name: "Kraft box with clear window",
    nameFr: "Boîte kraft avec fenêtre transparente",
    category: "packaging",
    subcategory: "boxes",
    description: "Kraft box with a clear window in the lid, shown closed and open.",
    descriptionFr: "Boîte kraft avec une fenêtre transparente sur le couvercle, montrée fermée et ouverte.",
    material: "Kraft board, clear window",
    colors: ["kraft"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print", "sticker"], "No manufacturer confirmed yet for this box — tell us your size and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/box-kraft-window.webp"],
  },
  {
    id: "prd_box_shipping_mailer",
    name: "Coloured shipping box",
    nameFr: "Boîte d'expédition colorée",
    category: "packaging",
    subcategory: "boxes",
    description: "A coloured mailer-style shipping box, open on its shredded-paper filler.",
    descriptionFr: "Boîte d'expédition colorée de type mailer, ouverte sur son calage en papier déchiqueté.",
    material: "Corrugated board",
    colors: ["pink"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print"], "No manufacturer confirmed yet for this box — tell us your size and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/box-shipping-pink.webp"],
  },
  {
    id: "prd_bag_kraft_rope_handle",
    name: "Kraft bags with rope handles",
    nameFr: "Sacs kraft à poignées cordées",
    category: "packaging",
    subcategory: "bags",
    description: "Kraft paper bags with twisted rope handles, several sizes shown together.",
    descriptionFr: "Sacs en papier kraft à poignées en corde torsadée, plusieurs tailles présentées ensemble.",
    material: "Kraft paper",
    colors: ["kraft"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print"], "No manufacturer confirmed yet for these bags — tell us your size and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/bags-kraft-handles.webp"],
  },
  {
    id: "prd_bag_bakery_window",
    name: "Bakery window bag",
    nameFr: "Sac boulangerie à fenêtre",
    category: "packaging",
    subcategory: "bags",
    description: "Kraft window bag for croissants and cookies, three sizes, one shown held by hand for scale.",
    descriptionFr: "Sac kraft à fenêtre pour croissants et cookies, trois tailles, l'une tenue à la main pour l'échelle.",
    material: "Kraft paper, clear window",
    colors: ["kraft"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print"], "No manufacturer confirmed yet for this bag — tell us your size and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/bags-kraft-bakery-hand.webp"],
  },
  {
    id: "prd_bag_diecut_colour",
    name: "Die-cut handle bags, several colours",
    nameFr: "Sacs à poignées découpées, plusieurs coloris",
    category: "packaging",
    subcategory: "bags",
    description: "Die-cut handle bags shown in five colours side by side.",
    descriptionFr: "Sacs à poignées découpées présentés en cinq coloris côte à côte.",
    material: "Coated paper",
    colors: ["assorted"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print"], "No manufacturer confirmed yet for this bag — tell us your size, colour and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/bags-colour-diecut.webp"],
  },
  {
    id: "prd_pouch_kraft_standup",
    name: "Stand-up kraft pouch with window",
    nameFr: "Pochette kraft autoportante à fenêtre",
    category: "packaging",
    subcategory: "pouches",
    description: "Stand-up kraft pouch with a clear window and a zip top, for coffee, spices or dried goods.",
    descriptionFr: "Pochette kraft autoportante avec fenêtre transparente et fermeture zip, pour café, épices ou produits secs.",
    material: "Kraft paper, clear window",
    colors: ["kraft"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print"], "No manufacturer confirmed yet for this pouch — tell us your size and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/pouch-kraft-window-standup.webp"],
  },
  {
    id: "prd_tray_bagasse_divided",
    name: "Compartmented fibre food tray",
    nameFr: "Barquette compartimentée en fibre",
    category: "packaging",
    subcategory: "trays",
    description: "Compartmented bagasse fibre tray with its own lid, for takeaway meals.",
    descriptionFr: "Barquette compartimentée en fibre de bagasse avec son couvercle, pour repas à emporter.",
    material: "Bagasse fibre",
    colors: ["natural"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown([], "No manufacturer confirmed yet for this tray — tell us your quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/tray-bagasse-divided.webp"],
  },
  {
    id: "prd_cup_icecream_paper",
    name: "Paper ice-cream cup",
    nameFr: "Gobelet à glace en papier",
    category: "packaging",
    subcategory: "cups",
    description: "Paper ice-cream cup — the leaf print shown is the factory's own sample design, not a customer's brand.",
    descriptionFr: "Gobelet à glace en papier — le motif feuille visible est le design d'échantillon du fabricant, pas la marque d'un client.",
    material: "Paper, PE lined",
    colors: ["white"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["logo-print"], "No manufacturer confirmed yet for this cup — tell us your size and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/icecream-cups.webp"],
  },
  {
    id: "prd_cup_pet_clear",
    name: "Clear PET dessert cup, 92/93mm rim",
    nameFr: "Gobelet PET transparent, bord 92/93mm",
    category: "packaging",
    subcategory: "cups",
    description:
      "Clear PET cup. Dimensions are read directly from the supplier's own dimensioned photograph — 92 to 93mm rim, 55mm base — not measured or estimated by Brandora.",
    descriptionFr:
      "Gobelet PET transparent. Les dimensions sont lues directement sur la photo cotée du fabricant — bord de 92 à 93mm, base de 55mm — non mesurées ni estimées par Brandora.",
    material: "PET, clear",
    colors: ["clear"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["sticker"], "No manufacturer confirmed yet for this cup — tell us your quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/cup-pet-dimensions.webp"],
  },
  {
    id: "prd_cup_dome_lid",
    name: "Cup with domed lid",
    nameFr: "Gobelet avec couvercle dôme",
    category: "packaging",
    subcategory: "cups",
    description: "Clear cup fitted with a domed lid, shown on a navy ground.",
    descriptionFr: "Gobelet transparent muni d'un couvercle dôme, présenté sur fond bleu marine.",
    material: "PET, clear",
    colors: ["clear"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["sticker"], "No manufacturer confirmed yet for this cup — tell us your quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/cup-dome-navy.webp"],
  },
  {
    id: "prd_cup_lids_assorted",
    name: "Assorted cup lids",
    nameFr: "Couvercles pour gobelets, plusieurs profils",
    category: "packaging",
    subcategory: "cups",
    description: "Nine lid profiles on one supplier studio sheet — flat sipper, dome, faceted dome and others. No single dimension stated.",
    descriptionFr: "Neuf profils de couvercles sur une même planche du fabricant — plat à bec, dôme, dôme facetté et autres. Aucune dimension unique n'est indiquée.",
    material: "PET, clear",
    colors: ["clear"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown([], "No manufacturer confirmed yet for these lids — tell us which profile and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/cup-lids.webp"],
  },
  {
    id: "prd_cup_lid_straw_set",
    name: "Cup, lid and straw set",
    nameFr: "Ensemble gobelet, couvercle et paille",
    category: "packaging",
    subcategory: "cups",
    description: "An iced-drink cup, its dome lid and a straw, shown together as they would be sold.",
    descriptionFr: "Un gobelet pour boisson glacée, son couvercle dôme et une paille, présentés ensemble tels qu'ils seraient vendus.",
    material: "PET, clear",
    colors: ["clear"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown(["sticker"], "No manufacturer confirmed yet for this set — tell us your quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/cups-lids-straws-set.webp"],
  },
  {
    id: "prd_cutlery_wood_kraft",
    name: "Wooden and kraft-paper cutlery, assorted shapes",
    nameFr: "Couverts en bois et papier kraft, formes variées",
    category: "tableware",
    subcategory: "cutlery",
    description:
      "Six ice-cream spoon and spatula shapes in birch wood and kraft paper, plus a single disposable spoon. A supplier spec sheet gives real dimensions for six of these — the smallest is 70×20×1.4mm, the largest 120×30×1.6mm — but no manufacturer is confirmed for them yet.",
    descriptionFr:
      "Six formes de cuillères et spatules à glace en bois de bouleau et papier kraft, plus une cuillère jetable seule. Une fiche technique du fabricant donne des dimensions réelles pour six d'entre elles — de 70×20×1,4mm à 120×30×1,6mm — mais aucun fabricant n'est encore confirmé pour ces pièces.",
    material: "Birch wood, kraft paper",
    colors: ["natural", "white"],
    minimumQuantity: 0,
    availableQuantity: 0,
    quoteOnRequest: true,
    sourcingInProgress: true,
    customization: unknown([], "No manufacturer confirmed yet for this cutlery — tell us which shape and quantity and Brandora will source it."),
    images: ["/assets/img/sourcing/wooden-cutlery.webp", "/assets/img/sourcing/wooden-spoon.webp"],
  },
];

/**
 * The catalogue Brandora actually serves.
 *
 * No longer just three products, but still never *invented*: every product
 * below is either a confirmed real supplier (`supplierReference`, from
 * `REAL_SEED`) or an explicitly-marked sourcing-in-progress product with no
 * price, no supplier and no invented quantity (`sourcingInProgress`, from
 * `SOURCING_SEED`) — never something in between that looks confirmed but
 * isn't. `scripts/check-catalog.mjs` fails the build if either guarantee
 * breaks.
 */
export const CATALOG: readonly BrandoraProduct[] = [...REAL_SEED, ...SOURCING_SEED].map(toProduct);
