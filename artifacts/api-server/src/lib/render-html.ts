// HTML preview markup. Mirrors shopify/sections/wishluck-hero.liquid and wishluck-content.liquid
// element-for-element so the preview and the native theme share one visual system.
import { escapeHtml as e } from "./compiler";
import type { Brand, DesignContent, Product } from "./domain";
import type { VisualPlan } from "./design-plan";
import { trustFacts } from "./facts";
import { baseTone, brightness, ctaFor, heroCx, secCx, secSpec, surfaceColor, flipFor, headingFor, heroImageWant, pad2, planClasses, type Palette, type SectionKey, type Tone, toneFor, viewCaption } from "./render-plan";

export interface Ctx { c: DesignContent; p: Product; b: Brand; plan: VisualPlan; pal: Palette; format: (n: number) => string }

const toneStyle = (t: Tone, v = "--wl-") =>
  `${v}bg:${t.background};${v}text:${t.text_color};${v}primary:${t.primary};${v}secondary:${t.secondary};${v}on-primary:${t.on_primary};${v}button:${t.button_color};${v}button-text:${t.button_text};${v}stage:${t.stage}`;
const darkBg = (bg: string) => (brightness(bg) < 110 ? " wl-dark" : "");
const dark = (t: Tone) => (brightness(t.background) < 110 ? " wl-dark" : "");
const para = (s: string) => s.split(/\n+/).filter(Boolean).map(x => `<p>${e(x)}</p>`).join("");
const arrow = `<span class="wl-arrow" aria-hidden="true"></span>`;

function figure(url: string, i: number, alt: string) {
  const img = `<img src="${e(url)}" alt="${e(alt)}" width="1200" height="1200"${i === 1 ? ` fetchpriority="high"` : ` loading="lazy"`}>`;
  return `<figure class="wl-fig wl-fig-${i}">${i === 1 ? img : `<button type="button" class="wl-thumb" data-wl-swap aria-label="Show view ${i}">${img}</button>`}<figcaption class="wl-fig-cap">${e(viewCaption(url, i))}</figcaption></figure>`;
}

export function heroHtml(x: Ctx) {
  const { c, p, plan, pal, format } = x;
  const hc = plan.composition?.hero;
  const t = hc ? baseTone(plan, x.b) : toneFor(plan, pal, "hero", 0);
  const imgs = p.images.slice(0, hc ? hc.imageCount : heroImageWant(plan));
  const cls = hc ? heroCx(plan, hc) + darkBg(surfaceColor(t, hc.surface)) : planClasses(plan) + dark(t);
  const style = hc ? `${toneStyle(t, "--wl-c-")};--wl-share:${hc.mediaShare}` : toneStyle(t);
  const facts = trustFacts(p);
  const available = p.variants.some(v => v.available);
  const first = p.variants.find(v => v.available) ?? p.variants[0];
  const price = first?.price ?? p.price;
  const compare = first?.compareAtPrice ?? p.compareAtPrice;
  const form = `<form class="wl-form" id="wl-form-preview"><label for="wl-variant-preview">Variant<select id="wl-variant-preview" name="id">${p.variants.map(v => `<option value="${e(v.id)}" data-price="${v.price}" data-compare="${v.compareAtPrice ?? 0}" data-available="${v.available}"${v === first ? " selected" : ""}>${e(v.title)}${v.available ? "" : " - Sold out"}</option>`).join("")}</select></label><label for="wl-qty-preview">Qty<input id="wl-qty-preview" name="quantity" type="number" min="1" max="99" value="1" inputmode="numeric"></label><button type="submit" data-label="Add to cart"${available ? "" : " disabled"}>Add to cart</button><div class="wl-status" role="status" aria-live="polite"></div></form>`;
  return `<section class="wl wl-hero ${cls}" style="${style}" data-wl-product>
<div class="wl-hero-grid">
<div class="wl-mark" aria-hidden="true">${`<span>${e(p.brand)}</span>`.repeat(4)}</div>
<div class="wl-media" data-count="${imgs.length}">${imgs.map((u, i) => figure(u, i + 1, i === 0 ? p.title : `${p.title} ${viewCaption(u, i + 1)}`)).join("")}</div>
<div class="wl-copy" id="wl-product-purchase">
<p class="wl-kicker"><span>${e(p.brand)}</span>${p.category ? `<span class="wl-kicker-meta">${e(p.category)}</span>` : ""}</p>
<h1>${e(c.headline)}</h1>
<div class="wl-description">${para(c.subheading)}</div>
<div class="wl-price"><span data-wl-price>${price === undefined ? "Price unavailable" : e(format(price))}</span> <del data-wl-compare>${compare && price && compare > price ? e(format(compare)) : ""}</del></div>
${form}
${facts.length ? `<div class="wl-trust"><p>${e(facts.join(" · "))}</p></div>` : ""}
${p.collectionUrl ? `<p class="wl-copy-link"><a href="${e(p.collectionUrl)}" target="_blank" rel="noopener">Explore the collection</a></p>` : ""}
</div>
</div>
<div class="wl-sticky"><span class="wl-sticky-price" data-wl-price>${price !== undefined ? e(format(price)) : ""}</span><button type="button"${available ? "" : " disabled"}>Add to cart</button></div>
</section>`;
}

function items(rows: { t: string; b: string }[], tag: "ol" | "dl", kind: "h3" | "dt" | "cite") {
  const inner = rows.map((r, i) => {
    const n = `<span class="wl-item-n" aria-hidden="true">${pad2(i + 1)}</span>`;
    if (tag === "dl") return `<div class="wl-item" data-wl-reveal>${n}<dt class="wl-item-t">${e(r.t)}</dt><dd class="wl-item-b">${para(r.b)}</dd></div>`;
    if (kind === "cite") return `<li class="wl-item" data-wl-reveal>${n}<blockquote class="wl-item-b">${para(r.b)}</blockquote><p class="wl-item-t">${e(r.t)}</p></li>`;
    return `<li class="wl-item" data-wl-reveal>${n}<h3 class="wl-item-t">${e(r.t)}</h3><div class="wl-item-b">${para(r.b)}</div></li>`;
  }).join("");
  return `<${tag} class="wl-items">${inner}</${tag}>`;
}

export function sectionHtml(x: Ctx, key: Exclude<SectionKey, "hero">, i: number) {
  const { c, p, plan, pal, format } = x;
  const sc = plan.composition ? secSpec(plan, key) : undefined;
  const t = sc ? baseTone(plan, x.b) : toneFor(plan, pal, key, i);
  const mode = key === "benefits" ? "cards" : key;
  let body = "";
  if (key === "story") {
    const img = p.images[1];
    body = `<div class="wl-story-grid"><div class="wl-prose" data-wl-reveal>${para(c.story)}</div>${img ? `<figure class="wl-fig wl-story-fig" data-wl-reveal><img src="${e(img)}" alt="${e(p.title)}" loading="lazy" width="1000" height="1250"></figure>` : ""}</div>`;
  } else if (key === "benefits") body = items(c.benefits.map(b => ({ t: b.title, b: b.text })), "ol", "h3");
  else if (key === "specs") body = items(Object.entries(c.specs).map(([k, v]) => ({ t: k, b: v })), "dl", "dt");
  else if (key === "reviews") {
    const rs = p.reviews ?? [];
    if (!rs.length) return "";
    body = items(rs.map(r => ({ t: r.author, b: `${r.rating ? `${r.rating} / 5 - ` : ""}${r.text}` })), "ol", "cite");
  } else if (key === "faq") {
    body = `<div class="wl-faq">${c.faqs.map((f, n) => `<details class="wl-q" data-wl-reveal><summary><span class="wl-item-n" aria-hidden="true">${pad2(n + 1)}</span><span>${e(f.question)}</span></summary><div class="wl-a">${para(f.answer)}</div></details>`).join("")}</div>`;
  } else if (key === "gallery") {
    const imgs = p.images.slice(0, 4);
    if (imgs.length < 2) return "";
    body = `<div class="wl-gallery" data-count="${imgs.length}">${imgs.map((u, n) => `<figure class="wl-gfig" data-wl-reveal><img src="${e(u)}" alt="${e(`${p.title} ${viewCaption(u, n + 1)}`)}" loading="lazy" width="1200" height="1200"><figcaption class="wl-fig-cap">${e(viewCaption(u, n + 1))}</figcaption></figure>`).join("")}</div>`;
  } else if (key === "purchase") {
    const v = p.variants.find(v => v.available) ?? p.variants[0];
    const price = v?.price ?? p.price;
    body = `<div class="wl-buy" data-wl-reveal>${p.images[0] ? `<figure class="wl-buy-fig"><img src="${e(p.images[0])}" alt="${e(p.title)}" loading="lazy" width="320" height="320"></figure>` : ""}<div class="wl-buy-name"><p class="wl-kicker"><span>${e(p.brand)}</span></p><p class="wl-buy-title">${e(p.title)}</p></div><p class="wl-buy-price">${price === undefined ? "" : e(format(price))}</p><a class="wl-btn" href="#wl-product-purchase">${e(ctaFor(plan))}${arrow}</a></div>`;
  }
  const heading = sc ? sc.title : headingFor(plan, key);
  const cls = sc ? secCx(plan, sc) + darkBg(surfaceColor(t, sc.surface)) : planClasses(plan, flipFor(plan, i)) + dark(t);
  const style = sc ? `${toneStyle(t, "--wl-c-")};--wl-space:${sc.spacing}px` : toneStyle(t);
  return `<section class="wl wl-sec wl-sec-${mode} ${cls}" style="${style}"><div class="wl-inner"><header class="wl-head" data-wl-reveal><span class="wl-num">${pad2(i + 1)}</span><h2>${e(heading)}</h2></header><div class="wl-body">${body}</div></div></section>`;
}
