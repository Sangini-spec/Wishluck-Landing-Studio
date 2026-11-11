import { Liquid } from "liquidjs";
import { load } from "cheerio";
import { compile } from "../compiler";
import { brightness } from "../render-plan";
import type { Brand, DesignContent, Product } from "../domain";
import { design } from "./fixtures";

// Execute the actual compiled Liquid. Only Shopify-specific filters/tags are
// emulated; loops, conditions, assigns, class strings and JSON-LD are not rewritten.
export async function nativeHtml(c: DesignContent, imported: Product, runtime: Product, b: Brand) {
  const files = compile(design, c, imported, b);
  const engine = new Liquid({ strictFilters: true });
  engine.registerFilter("color_brightness", brightness);
  engine.registerFilter("font_face", () => "");
  engine.registerFilter("asset_url", (name: string) => `/assets/${name}`);
  engine.registerFilter("stylesheet_tag", (url: string) => `<link rel="stylesheet" href="${url}">`);
  engine.registerFilter("money", (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: runtime.currency }).format(n / 100));
  // Retain intrinsic aspect ratios, as Shopify image_tag does.
  const images = runtime.images.map((src, i) => ({ src, width: [960, 480, 800, 1200][i], height: [480, 960, 800, 400][i] }));
  engine.registerFilter("image_url", (image: { src: string } | undefined) => image?.src ?? "");
  engine.registerFilter("image_tag", (src: string, ...args: unknown[]) => {
    const attrs = Object.fromEntries(args.filter((x): x is [string, unknown] => Array.isArray(x) && x.length === 2));
    const img = images.find(i => i.src === src);
    const $ = load("<img>");
    $("img").attr({ src, width: String(img?.width ?? 800), height: String(img?.height ?? 800),
      alt: String(attrs.alt ?? ""), loading: String(attrs.loading ?? "eager") });
    return $("body").html();
  });
  const template = JSON.parse(Object.entries(files).find(([name]) => name.startsWith("templates/"))![1]);
  const variants = runtime.variants.map(v => ({ ...v, price: v.price * 100, compare_at_price: (v.compareAtPrice ?? 0) * 100 }));
  const nativeProduct = { title: runtime.title, vendor: runtime.brand, type: runtime.category, description: runtime.description,
    images, featured_image: images[0], variants, selected_or_first_available_variant: variants.find(v => v.available) ?? variants[0] };
  let body = "";
  for (const id of template.order) {
    const section = template.sections[id];
    const font = { family: "Georgia", fallback_families: "serif" };
    const bodyFont = { family: "Arial", fallback_families: "sans-serif" };
    const settings = { ...section.settings, heading_font: font, body_font: bodyFont };
    const blocks = (section.block_order ?? []).map((key: string) => ({ ...section.blocks[key], shopify_attributes: "" }));
    const source = files[`sections/${section.type}.liquid`]!.replace(/{% schema %}[\s\S]*?{% endschema %}/, "")
      .replace(/{% style %}/g, "<style>").replace(/{% endstyle %}/g, "</style>");
    body += await engine.parseAndRender(source, { section: { id, settings, blocks }, product: nativeProduct,
      cart: { currency: { iso_code: runtime.currency } }, canonical_url: runtime.sourceUrl, routes: { cart_add_url: "/cart/add" } });
  }
  const $ = load(body);
  $('link[rel="stylesheet"]').remove();
  $('script[src]').remove();
  const css = Object.entries(files).find(([name]) => name.endsWith(".css"))![1];
  const js = Object.entries(files).find(([name]) => name.endsWith(".js"))![1];
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">${$("head").html()}<style>body{margin:0}${css}</style></head><body>${$("body").html()}<script>${js}</script></body></html>`;
}
