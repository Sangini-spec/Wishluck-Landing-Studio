// Deterministic interpretation of a DesignContent.visualPlan into rendering tokens.
// Shared by the HTML preview (render-html.ts) and the native Liquid compiler (compiler.ts)
// so both outputs use the exact same class vocabulary and colour values.
import type { Brand, DesignContent, Product } from "./domain";
import type { VisualPlan } from "./design-plan";

export type SectionKey = "hero"|"story"|"benefits"|"specs"|"faq"|"reviews"|"gallery"|"purchase";
const KEYS: SectionKey[] = ["hero","story","benefits","specs","faq","reviews","gallery","purchase"];

const LEGACY: Record<string, VisualPlan["family"]> = {
  split:"atelier", editorial:"journal", grid:"mosaic", purchase:"catalogue", reversed:"atelier", framed:"gallery",
  compact:"catalogue", panorama:"panorama", inset:"atelier", catalogue:"catalogue", feature:"gallery", asymmetric:"kinetic",
};

/** Plan from saved content; legacy designs (no visualPlan) map deterministically from composition/colorUse. */
export function resolvePlan(c: DesignContent): VisualPlan {
  if (c.visualPlan) return c.visualPlan;
  const family = LEGACY[c.composition] ?? "atelier";
  const comp = c.composition || "";
  return {
    family, name:"Legacy layout", rationale:"", heroScale:"balanced",
    imageTreatment: family === "gallery" ? "framed" : "cutout",
    colorStrategy: c.colorUse === "brand-hero" ? "brand" : "light",
    contentRhythm: "spacious",
    typography: family === "journal" ? "editorial" : "display",
    detailLayout: comp.includes("grid") ? "tiles" : comp.includes("editorial") ? "columns" : "split",
    alignment: "start",
    accentPlacement: c.colorUse === "brand-details" ? "panel" : "rule",
    sections: (c.sections.filter(s => (KEYS as string[]).includes(s)) as SectionKey[]),
  };
}

/** Ordered, de-duplicated sections. Hero is always first (it holds the real cart form). */
export function planSections(plan: VisualPlan, c: DesignContent): SectionKey[] {
  const seen = new Set<SectionKey>();
  const out: SectionKey[] = ["hero"]; seen.add("hero");
  for (const k of plan.sections as SectionKey[]) {
    if (seen.has(k) || !KEYS.includes(k)) continue;
    seen.add(k);
    if (k === "story" && !c.story?.trim()) continue;
    if (k === "benefits" && !c.benefits?.length) continue;
    if (k === "specs" && !Object.keys(c.specs ?? {}).length) continue;
    if (k === "faq" && !c.faqs?.length) continue;
    out.push(k);
  }
  return out;
}

export const planClasses = (p: VisualPlan, flip = false) =>
  `wl-f-${p.family} wl-img-${p.imageTreatment} wl-scale-${p.heroScale} wl-cs-${p.colorStrategy} wl-rh-${p.contentRhythm} wl-ty-${p.typography} wl-dl-${p.detailLayout} wl-al-${p.alignment} wl-ac-${p.accentPlacement}${flip ? " wl-flip" : ""}`;

export const heroImageWant = (p: VisualPlan) =>
  p.family === "catalogue" ? 4 : p.imageTreatment === "collage" || p.family === "mosaic" || p.family === "panorama" ? 3 : 1;

export const spacingFor = (p: VisualPlan) => ({ spacious: 96, dense: 40, alternating: 72 })[p.contentRhythm];
export const headingSizeFor = (p: VisualPlan) => ({ monumental: 80, balanced: 64, compact: 48 })[p.heroScale];
export const pad2 = (n: number) => (n < 10 ? "0" : "") + n;

const HEADS: Record<VisualPlan["family"], Record<Exclude<SectionKey,"hero">, string>> = {
  atelier:{story:"How it came together",benefits:"Considered details",specs:"Specification",faq:"Before you choose",reviews:"In their words",gallery:"Every angle",purchase:"Ready when you are"},
  kinetic:{story:"The short version",benefits:"Why it moves",specs:"The numbers",faq:"Quick answers",reviews:"Customer words",gallery:"Turn it around",purchase:"Make it yours"},
  gallery:{story:"About the piece",benefits:"Notes on the object",specs:"Particulars",faq:"Visitor questions",reviews:"Responses",gallery:"Plates",purchase:"Acquire"},
  dossier:{story:"Brief",benefits:"Findings",specs:"Technical record",faq:"Queries",reviews:"Field reports",gallery:"Figures",purchase:"Order"},
  panorama:{story:"The wide view",benefits:"What stands out",specs:"At a glance",faq:"Common questions",reviews:"What people said",gallery:"From every side",purchase:"Bring it home"},
  mosaic:{story:"The idea",benefits:"Pieces of the whole",specs:"Fine print",faq:"Asked often",reviews:"Customer notes",gallery:"Views",purchase:"Pick yours"},
  catalogue:{story:"Description",benefits:"Features",specs:"Specifications",faq:"FAQ",reviews:"Reviews",gallery:"Images",purchase:"Add to order"},
  journal:{story:"Field notes",benefits:"What we noticed",specs:"The particulars",faq:"Letters and answers",reviews:"Readers write",gallery:"Contact sheet",purchase:"Where to get it"},
};
export const headingFor = (p: VisualPlan, k: Exclude<SectionKey,"hero">) => HEADS[p.family][k];
export const ctaFor = (p: VisualPlan) => ({ atelier:"Choose your size", kinetic:"Go to cart", gallery:"Select a variant", dossier:"Open order form", panorama:"Choose yours", mosaic:"Pick a variant", catalogue:"Choose options", journal:"Choose your variant" })[p.family];

/** Caption derived only from the real file name of a real image; never invents a view. Mirrors Liquid logic. */
const VIEWS: [string,string][] = [["_LEFT","Left"],["_RIGHT","Right"],["_FRONT","Front"],["_BACK","Back"],["_TOP","Top"],["_BOTTOM","Bottom"],["_SIDE","Side"]];
export function viewCaption(url: string, i: number) {
  const name = (url.split("?")[0]!.split("/").pop() || "").toUpperCase();
  const view = VIEWS.find(([k]) => name.includes(k))?.[1] ?? "View";
  return `Fig. ${pad2(i)} · ${view}`;
}

// ---------- colour ----------
const hex = (v: string | undefined, f: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : f);
const rgb = (h: string) => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16)) as [number,number,number];
const toHex = (r: number[]) => "#" + r.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2,"0")).join("");
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v,i) => v + (y[i]! - v) * t)); };
const lum = (h: string) => { const c = rgb(h).map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }); return .2126*c[0]! + .7152*c[1]! + .0722*c[2]!; };
export const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
const chroma = (h: string) => { const r = rgb(h); return (Math.max(...r) - Math.min(...r)) / 255; };
/** Same formula as Liquid `color_brightness`. */
export const brightness = (h: string) => { const [r,g,b] = rgb(h); return (r*299 + g*587 + b*114) / 1000; };
const best = (cands: string[], bg: string, min = 4.5) => cands.find(c => ratio(c, bg) >= min) ?? [...cands].sort((a,b) => ratio(b,bg) - ratio(a,bg))[0]!;

export interface Tone { background: string; text_color: string; primary: string; secondary: string; on_primary: string; button_color: string; button_text: string; stage: string }
export interface Palette { a: Tone; b: Tone; x: Tone }

export function palette(plan: VisualPlan, br: Brand): Palette {
  const bg0 = hex(br.background, "#f4f1ea"), tx0 = hex(br.text, "#1c1c1a"), pr = hex(br.primary, tx0), se = hex(br.secondary, bg0), bt = hex(br.button, tx0);
  const sorted = [pr, se, bt, bg0, tx0].sort((a,b) => lum(a) - lum(b));
  let ink = sorted[0]!; if (lum(ink) > .06) ink = mix(ink, "#000000", .7); if (lum(ink) < .004) ink = mix(ink, bg0, .07);
  let paper = lum(bg0) > .45 ? bg0 : sorted[4]!; if (paper === "#ffffff") paper = mix(paper, se === "#ffffff" ? tx0 : se, se === "#ffffff" ? .03 : .45);
  const lightest = sorted[4]!;
  const chromatic = [pr, se, bt].filter(c => chroma(c) > .22).sort((a,b) => chroma(b) - chroma(a))[0];
  const make = (bg: string, surface: string, accentPref: string, stage: string): Tone => {
    const dark = lum(bg) < .2;
    const text = best([dark ? paper : tx0, dark ? lightest : ink, dark ? "#f6f3ec" : "#161615"], bg);
    // Detail tiles reuse this text colour on the secondary surface. A light
    // tint of a saturated brand background can otherwise make white copy unreadable.
    let readableSurface = surface;
    for (let n = 1; ratio(text, readableSurface) < 4.5 && n <= 10; n++) readableSurface = mix(surface, bg, n / 10);
    const accent = ratio(accentPref, bg) >= 3 ? accentPref : (dark ? paper : ink);
    const button = chromatic && ratio(chromatic, bg) >= 3 ? chromatic : dark ? paper : (ratio(bt, bg) >= 3 ? bt : ink);
    return { background: bg, text_color: text, primary: accent, secondary: readableSurface, on_primary: best([paper, ink, "#f6f3ec", "#161615"], accent),
      button_color: button, button_text: best([paper, ink, "#f6f3ec", "#161615"], button), stage };
  };
  const lightSurface = lightest !== paper && ratio(lightest, paper) < 1.6 ? lightest : mix(paper, ink, .06);
  const light = make(paper, lightSurface, chromatic ?? bt, lightSurface);
  const lightAlt = make(lightSurface, paper, chromatic ?? bt, paper);
  const inkT = make(ink, mix(ink, paper, .1), chromatic ?? paper, paper);
  const inkAlt = make(mix(ink, paper, .07), ink, chromatic ?? paper, mix(paper, ink, .04));
  const brandBg = chromatic ?? mix(paper, ink, .13);
  const brandT = make(brandBg, mix(brandBg, paper, .4), lum(brandBg) < .2 ? paper : ink, mix(brandBg, paper, .55));
  switch (plan.colorStrategy) {
    case "ink": return { a: inkT, b: inkAlt, x: light };
    case "brand": return { a: brandT, b: light, x: inkT };
    case "contrast": return { a: inkT, b: light, x: inkT };
    default: return { a: light, b: lightAlt, x: inkT };
  }
}

/** Tone for a given section position (index among content sections, 1-based). */
export function toneFor(plan: VisualPlan, pal: Palette, key: SectionKey, i: number): Tone {
  if (key === "hero") return pal.a;
  if (key === "purchase") return pal.x;
  const alternate = plan.contentRhythm === "alternating" || plan.colorStrategy === "contrast";
  if (plan.colorStrategy === "contrast") return i % 2 === 1 ? pal.b : pal.a;
  return alternate && i % 2 === 0 ? pal.b : alternate ? pal.a : (plan.colorStrategy === "brand" ? pal.b : pal.a);
}
export const flipFor = (plan: VisualPlan, i: number) => plan.contentRhythm === "alternating" && i % 2 === 0;
export const storyImageIndex = (p: Product) => (p.images.length >= 2 ? 2 : p.images.length ? 1 : 0);
