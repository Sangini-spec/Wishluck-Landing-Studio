import type { Brand, Design, DesignContent, Product } from "../domain";
import { designFamilies, type VisualPlan } from "../design-plan";

// Synthetic source facts, never fetched from a store. SVGs touch all four edges
// so the browser checks cannot conceal cropping behind transparent product margins.
export const imageShapes = [[960, 480], [480, 960], [800, 800], [1200, 400]] as const;
export const product: Product = {
  title: "Everyday Field Bag", handle: "regression-field-bag", brand: "Fieldwork",
  category: "Bags", description: "A woven everyday bag with adjustable straps.",
  price: 79, compareAtPrice: 99, currency: "USD",
  images: imageShapes.map((_, i) => `https://fixtures.invalid/bag_${["FRONT", "BACK", "SIDE", "TOP"][i]}.svg`),
  variants: [
    { id: "1001", title: "Natural / Standard", price: 79, compareAtPrice: 99, available: true },
    { id: "1002", title: "Black / Extended adjustable shoulder strap", price: 89, available: true },
    { id: "1003", title: "Clay / Standard", price: 79, available: false },
  ],
  specs: { Materials: "Woven cotton canvas", Dimensions: "32 × 28 × 12 cm", "Return policy": "Returns within 30 days" },
  reviews: [{ author: "Fixture reviewer", rating: 4, text: "The adjustable straps are useful for everyday carrying.", sourceUrl: "https://fixtures.invalid/reviews/1" }],
  sourceUrl: "https://fixtures.invalid/products/field-bag", missingFacts: [],
};
export const brand: Brand = {
  primary: "#ad3628", secondary: "#ded6c5", background: "#f4f1ea", text: "#202521", button: "#202521",
  headingFont: "Georgia, serif", bodyFont: "Arial, sans-serif",
  shopifyHeadingFont: "assistant_n4", shopifyBodyFont: "assistant_n4",
  headingSize: "64", bodySize: "16", headingWeight: "400", bodyWeight: "400",
  tone: "Plain", radius: "8", spacing: "72", imageStyle: "product", buttonStyle: "solid",
};
export const design = { id: "regress1-local", name: "Rendering fixture" } as Design;
export const sections: VisualPlan["sections"] = ["hero", "story", "benefits", "specs", "faq", "reviews", "gallery", "purchase"];
export const axes = {
  heroScale: ["monumental", "balanced", "compact"],
  imageTreatment: ["cutout", "framed", "fullbleed", "collage"],
  colorStrategy: ["light", "ink", "brand", "contrast"],
  contentRhythm: ["spacious", "dense", "alternating"],
  typography: ["display", "editorial", "technical"],
  detailLayout: ["tiles", "timeline", "bento", "split", "columns"],
  alignment: ["start", "center"],
  accentPlacement: ["edge", "panel", "rule"],
} as const;
export function content(plan?: VisualPlan): DesignContent {
  return {
    headline: "Made for the everyday", subheading: "Woven cotton canvas. Adjustable straps. Room for your daily essentials.",
    story: "A woven everyday bag with adjustable straps and a simple shape.\nThe cotton canvas body measures 32 × 28 × 12 cm.",
    benefits: [
      { title: "Woven canvas", text: "A cotton canvas body for everyday use." },
      { title: "Adjustable straps", text: "Adjust the shoulder straps to fit." },
      { title: "Everyday space", text: "The body measures 32 × 28 × 12 cm." },
      { title: "Simple construction", text: "A woven body with shoulder straps." },
      { title: "Cotton material", text: "Made from woven cotton canvas." },
    ],
    faqs: [{ question: "What is the bag made from?", answer: "Woven cotton canvas." }, { question: "What are the dimensions?", answer: "32 × 28 × 12 cm." }],
    specs: product.specs, sections: [...sections], composition: "split", imagePosition: "left",
    colorUse: "neutral", ctaPlacement: "hero-and-sticky", learningIds: [], generationMode: "source-only",
    ...(plan ? { visualPlan: plan } : {}),
  };
}
export interface Fixture { id: string; c: DesignContent; p: Product }
// Five rows per family exercise EVERY value of EVERY axis in that family.
// This is bounded combinatorial coverage, not a claim of exhaustive combinations.
export const fixtures: Fixture[] = designFamilies.flatMap((family, familyIndex) =>
  Array.from({ length: 5 }, (_, row) => {
    const values = Object.fromEntries(Object.entries(axes).map(([key, options], axis) =>
      [key, options[(row + familyIndex + axis) % options.length]]));
    const plan = { ...values, family, name: `${family} fixture ${row}`, rationale: "Deterministic regression fixture",
      sections: row % 2 ? ["hero", "specs", "gallery", "benefits", "story", "reviews", "faq", "purchase"] : sections } as VisualPlan;
    return { id: `${family}-${row}`, c: content(plan), p: product };
  }));
export const legacyFamilies = {
  split: "atelier", editorial: "journal", grid: "mosaic", purchase: "catalogue", reversed: "atelier",
  framed: "gallery", compact: "catalogue", panorama: "panorama", inset: "atelier",
  catalogue: "catalogue", feature: "gallery", asymmetric: "kinetic",
} as const;
for (const [composition] of Object.entries(legacyFamilies)) {
  fixtures.push({ id: `legacy-${composition}`, c: { ...content(), composition,
    colorUse: composition === "reversed" ? "brand-details" : composition === "feature" ? "brand-hero" : "neutral" }, p: product });
}
const base = fixtures[0]!;
fixtures.push(
  { id: "one-image", c: base.c, p: { ...product, images: product.images.slice(0, 1) } },
  { id: "no-images", c: base.c, p: { ...product, images: [] } },
  { id: "sold-out", c: base.c, p: { ...product, variants: product.variants.map(v => ({ ...v, available: false })) } },
  { id: "long-copy", c: { ...base.c, headline: "A woven cotton canvas shoulder bag for all your everyday essentials",
    subheading: `${base.c.subheading} `.repeat(4) }, p: product },
);
