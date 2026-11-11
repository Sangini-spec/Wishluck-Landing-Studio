import assert from "node:assert/strict";
import { load } from "cheerio";
import { compile, rootDir, STYLESHEETS } from "../compiler";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fingerprint, similarity } from "../fingerprints";
import { planClasses, planSections, resolvePlan, flipFor, palette, toneFor, brightness } from "../render-plan";
import { axes, brand, design, type Fixture } from "./fixtures";

interface Setting {
  id?: string; type: string; options?: { value: string }[]; min?: number; max?: number; step?: number; default?: unknown;
}
function validateValues(settings: Record<string, unknown>, definitions: Setting[]) {
  const byId = new Map(definitions.filter(s => s.id).map(s => [s.id, s]));
  assert.equal(byId.size, definitions.filter(s => s.id).length, "Duplicate schema setting IDs");
  for (const [id, value] of Object.entries(settings)) {
    const definition = byId.get(id);
    assert.ok(definition, `Unknown setting ${id}`);
    if (definition.options) assert.ok(definition.options.some(o => o.value === value), `${id}: unsupported option ${value}`);
    if (definition.type === "range") {
      assert.equal(typeof value, "number", id);
      const n = Number(value);
      assert.ok(n >= definition.min! && n <= definition.max!, `${id}: out of range`);
      assert.ok(Math.abs((n - definition.min!) / definition.step! - Math.round((n - definition.min!) / definition.step!)) < 1e-6, `${id}: invalid step`);
    }
    if (definition.type === "checkbox") assert.equal(typeof value, "boolean", id);
    if (definition.type === "color") assert.match(String(value), /^#[a-f0-9]{6}$/i, id);
  }
}
export function checkContracts(fixture: Fixture, preview: string, native: string) {
  const { c, p } = fixture;
  // Empty compile-time images must NOT erase gallery blocks or bind external URLs.
  const files = compile(design, c, { ...p, images: [] }, brand);
  const template = JSON.parse(Object.entries(files).find(([name]) => name.startsWith("templates/"))![1]);
  const schemas = new Map<string, { settings: Setting[]; blocks?: { type: string; settings: Setting[] }[] }>();
  for (const [name, source] of Object.entries(files).filter(([name]) => name.endsWith(".liquid"))) {
    assert.doesNotMatch(source, /WL_(?:CSS|JS|SCHEMA|RATING)/);
    const schema = JSON.parse(source.match(/{% schema %}([\s\S]*?){% endschema %}/)![1]!);
    schemas.set(path.basename(name, ".liquid"), schema);
    for (const definition of schema.settings as Setting[]) {
      if (definition.id && definition.default !== undefined) validateValues({ [definition.id]: definition.default }, schema.settings);
    }
    const refs = [...source.matchAll(/\bs\.([a-z_]+)/g)].map(m => m[1]!);
    refs.forEach(id => assert.ok(schema.settings.some((s: Setting) => s.id === id), `Liquid references missing schema setting ${id}`));
  }
  assert.deepEqual(template.order, planSections(resolvePlan(c), c));
  for (const section of Object.values(template.sections) as { type: string; settings: Record<string, unknown>; blocks?: Record<string, { type: string; settings: Record<string, unknown> }>; block_order?: string[] }[]) {
    const schema = schemas.get(section.type)!;
    assert.ok(schema);
    validateValues(section.settings, schema.settings);
    assert.ok(!("image" in section.settings), "No compile-time image_picker bindings");
    if (section.blocks) {
      assert.deepEqual(section.block_order, Object.keys(section.blocks));
      for (const block of Object.values(section.blocks)) {
        const definition = schema.blocks?.find(b => b.type === block.type);
        assert.ok(definition, `Unknown block type ${block.type}`);
        validateValues(block.settings, definition.settings);
        assert.ok(!("image" in block.settings));
      }
    }
  }
  const nativeAxes = { heroScale: "hero_scale", imageTreatment: "image_treatment", colorStrategy: "color_strategy",
    contentRhythm: "rhythm", typography: "typography", detailLayout: "detail_layout", alignment: "alignment", accentPlacement: "accent_placement" };
  for (const schema of schemas.values()) {
    for (const [axis, setting] of Object.entries(nativeAxes)) {
      assert.deepEqual(schema.settings.find(s => s.id === setting)?.options?.map(o => o.value),
        [...axes[axis as keyof typeof axes]], `Native schema axis drift: ${axis}`);
    }
  }
  const bundledCss = Object.entries(files).find(([name]) => name.endsWith(".css"))![1];
  assert.equal(bundledCss, STYLESHEETS.map(name => readFileSync(path.join(rootDir, "shopify/assets", name), "utf8")).join("\n"));
  const a = load(preview), b = load(native);
  assert.deepEqual(a("section.wl").map((_, el) => a(el).attr("class")!.split(/\s+/).sort().join(" ")).get(),
    b("section.wl").map((_, el) => b(el).attr("class")!.split(/\s+/).sort().join(" ")).get(), "Preview/native section class/order drift");
  const plan = resolvePlan(c), pal = palette(plan, brand);
  a("section.wl").each((_, el) => {
    const key = a(el).hasClass("wl-hero") ? "hero" : a(el).attr("class")!.match(/wl-sec-(\w+)/)![1]!;
    const sectionKey = key === "cards" ? "benefits" : key;
    const index = template.order.indexOf(sectionKey);
    const tone = toneFor(plan, pal, sectionKey as Parameters<typeof toneFor>[2], index);
    const expected = planClasses(plan, flipFor(plan, index)).split(" ").filter(x => sectionKey !== "hero" || x !== "wl-flip");
    expected.forEach(cls => assert.ok(a(el).hasClass(cls), cls));
    assert.equal(a(el).hasClass("wl-dark"), brightness(tone.background) < 110);
    const previewVars = a(el).attr("style")!;
    assert.ok(previewVars.includes(`--wl-bg:${tone.background}`));
  });
  // Per-element class multiset catches child markup drift without pinning whitespace/IDs.
  const classes = ($: ReturnType<typeof load>) => $("body [class]").map((_, el) => $(el).attr("class")!.split(/\s+/).sort().join(" ")).get().sort();
  assert.deepEqual(classes(a), classes(b), "Preview/native child class drift");
  for (const $ of [a, b]) {
    const json = $('script[type="application/ld+json"]').map((_, el) => JSON.parse($(el).text())).get();
    const pd = json.find(x => x["@type"] === "Product");
    assert.equal(pd.name, p.title); assert.equal(pd.offers.price, p.price); assert.equal(pd.offers.priceCurrency, p.currency);
    assert.equal(pd.offers.availability, `https://schema.org/${p.variants.some(v => v.available) ? "InStock" : "OutOfStock"}`);
    assert.equal(json.find(x => x["@type"] === "FAQPage").mainEntity.length, c.faqs.length);
    assert.equal($(".wl-media img").length, Math.min(p.images.length, Number(template.sections.hero.settings.image_count)));
    assert.deepEqual($(".wl-media img").map((_, el) => $(el).attr("src")).get(), p.images.slice(0, Number(template.sections.hero.settings.image_count)));
    assert.equal($(".wl-form").length, 1);
    assert.equal($(".wl-form select option").length, p.variants.length);
  }
  assert.equal(similarity(fingerprint(c, brand), fingerprint(c, brand)), 1);
}
