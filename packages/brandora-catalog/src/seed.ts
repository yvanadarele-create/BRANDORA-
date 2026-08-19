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

/**
 * The catalogue Brandora actually serves.
 *
 * No longer empty, but still never *invented*: every product below traces to
 * a named, real supplier (`supplierReference`), and none carries a price
 * nobody quoted (`quoteOnRequest` where a landed price is not yet computed).
 * `scripts/check-catalog.mjs` fails the build if either guarantee breaks.
 */
export const CATALOG: readonly BrandoraProduct[] = REAL_SEED.map(toProduct);
