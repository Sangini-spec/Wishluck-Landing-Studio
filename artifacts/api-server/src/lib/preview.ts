import { readFileSync } from "node:fs";
import {cleanProductSpecs,isProductFact} from "./facts";
import path from "node:path";
import { rootDir, escapeHtml as e, STYLESHEETS } from "./compiler";
import type { Product, Brand, DesignContent, Design } from "./domain";
import { headingSizeFor, palette, planSections, resolvePlan, spacingFor } from "./render-plan";
import { heroHtml, sectionHtml, type Ctx } from "./render-html";

const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
const asset = (n: string) => readFileSync(path.join(rootDir, "shopify/assets", n), "utf8");

export function preview(_design: Design, c: DesignContent, p: Product, b: Brand) {
  c={...c,specs:cleanProductSpecs(c.specs),benefits:c.benefits.filter(item=>isProductFact(item.title,item.text))};
  const font = (v: string, f: string) => v.replace(/[^a-z0-9 ,'"-]/gi, "").slice(0, 150) || f;
  const format = (price: number) => p.currency === "XXX" ? `${price.toFixed(2)} (currency unverified)` : new Intl.NumberFormat("en", { style: "currency", currency: p.currency }).format(price);
  const plan = resolvePlan(c);
  const ctx: Ctx = { c, p, b, plan, pal: palette(plan, b), format };
  const productSchema = { "@context": "https://schema.org", "@type": "Product", name: p.title, url: p.sourceUrl, image: p.images, brand: { "@type": "Brand", name: p.brand }, description: p.description,
    ...(p.currency !== "XXX" && p.price !== undefined ? { offers: { "@type": "Offer", price: p.price, priceCurrency: p.currency, availability: `https://schema.org/${p.variants.some(v => v.available) ? "InStock" : "OutOfStock"}` } } : {}),
    ...(p.rating && p.reviewCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount } } : {}) };
  const keys = planSections(plan, c).filter(k => !(k === "reviews" && !(p.reviews ?? []).length) && !(k === "gallery" && p.images.length < 2));
  const html = keys.map((k, i) => k === "hero" ? heroHtml(ctx) : sectionHtml(ctx, k, i)).join("\n");
  const hasFaq = keys.includes("faq") && c.faqs.length;
  const root = `:root{--wl-heading:${font(b.headingFont, "Georgia, serif")};--wl-body:${font(b.bodyFont, "system-ui, sans-serif")};--wl-radius:${Math.min(40, parseInt(b.radius) || 0)}px;--wl-space:${spacingFor(plan)}px;--wl-heading-size:${headingSizeFor(plan)}px;--wl-body-size:${Math.max(12, Math.min(24, parseInt(b.bodySize) || 16))}px;--wl-weight:${Math.round(Math.max(100, Math.min(900, parseInt(b.headingWeight) || 400)) / 100) * 100};--wl-body-weight:${Math.round(Math.max(100, Math.min(900, parseInt(b.bodyWeight) || 400)) / 100) * 100}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(c.headline)} | ${e(p.brand)}</title><meta name="description" content="${e(c.subheading.slice(0, 160))}"><link rel="canonical" href="${e(p.sourceUrl)}"><style>body{margin:0}${root}
${STYLESHEETS.map(asset).join("\n")}</style><script type="application/ld+json">${json(productSchema)}</script>${hasFaq ? `<script type="application/ld+json">${json({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: c.faqs.map(f => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) })}</script>` : ""}</head><body>${html}<script>
${asset("wishluck-motion.js")}
(()=>{const root=document.querySelector('[data-wl-product]');if(!root)return;const form=root.querySelector('form'),sel=form.querySelector('select'),btn=form.querySelector('[type=submit]'),sticky=root.querySelector('.wl-sticky'),status=root.querySelector('.wl-status');
const fmt=v=>{try{return new Intl.NumberFormat('en',{style:'currency',currency:${json(p.currency)}}).format(v)}catch{return Number(v).toFixed(2)}};
const update=()=>{const o=sel.selectedOptions[0];if(!o)return;const ok=o.dataset.available==='true',pr=Number(o.dataset.price),cp=Number(o.dataset.compare||0);document.querySelectorAll('[data-wl-price]').forEach(el=>el.textContent=fmt(pr));const d=root.querySelector('[data-wl-compare]');if(d)d.textContent=cp>pr?fmt(cp):'';btn.disabled=!ok;btn.textContent=ok?btn.dataset.label:'Sold out';const sb=sticky&&sticky.querySelector('button');if(sb)sb.disabled=!ok;};
sel.addEventListener('change',update);
form.addEventListener('submit',ev=>{ev.preventDefault();status.textContent='Preview only. Publish to Shopify to test the real cart on the store domain.';});
sticky&&sticky.querySelector('button').addEventListener('click',()=>{form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});form.requestSubmit();});
if(sticky&&'IntersectionObserver'in window)new IntersectionObserver(es=>sticky.classList.toggle('is-visible',!es[0].isIntersecting)).observe(btn);
update();})();
</script></body></html>`;
}
