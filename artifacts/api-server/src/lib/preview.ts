import { readFileSync } from "node:fs";
import path from "node:path";
import { rootDir, escapeHtml as e, contrastText } from "./compiler";
import type { Product, Brand, DesignContent, Design } from "./domain";
import { trustFacts } from "./facts";

const json=(v:unknown)=>JSON.stringify(v).replace(/</g,"\\u003c");
export function preview(design:Design,c:DesignContent,p:Product,b:Brand){
  const colour=(v:string)=>/^#[0-9a-f]{6}$/i.test(v)?v:"#222222";
  const font=(v:string)=>v.replace(/[^a-z0-9 ,'"-]/gi,"").slice(0,150);
  const format=(price:number)=>p.currency==="XXX"?`${price.toFixed(2)} (currency unverified)`:new Intl.NumberFormat("en",{style:"currency",currency:p.currency}).format(price);
  const productSchema={"@context":"https://schema.org","@type":"Product",name:p.title,url:p.sourceUrl,image:p.images,brand:{"@type":"Brand",name:p.brand},description:p.description,
    ...(p.currency!=="XXX"&&p.price!==undefined?{offers:{"@type":"Offer",price:p.price,priceCurrency:p.currency,availability:`https://schema.org/${p.variants.some(v=>v.available)?"InStock":"OutOfStock"}`}}:{}),
    ...(p.rating&&p.reviewCount?{aggregateRating:{"@type":"AggregateRating",ratingValue:p.rating,reviewCount:p.reviewCount}}:{})};
  const form=`<form class="wl-form"><label for="variant">Variant<select id="variant" name="id">${p.variants.map(v=>`<option value="${e(v.id)}" data-price="${v.price}" data-available="${v.available}">${e(v.title)}${v.available?"":" — Sold out"}</option>`).join("")}</select></label><label for="qty">Qty<input id="qty" name="quantity" type="number" min="1" max="99" value="1"></label><button type="submit"${!p.variants.some(v=>v.available)?" disabled":""}>Add to cart</button><div class="wl-status" role="status"></div></form>`;
  const hero=`<section class="wl wl-hero wl-${e(c.composition==="grid"?"grid-hero":c.composition)} wl-color-${e(c.colorUse)}" style="${c.imagePosition==="right"?"--wl-image-order:2":""}"><div class="wl-visual" style="order:${c.imagePosition==="right"?2:0}">${p.images[0]?`<img src="${e(p.images[0])}" alt="${e(p.title)}" width="800" height="900" fetchpriority="high">`:""}</div><div class="wl-copy" id="wl-product-purchase"><div><div class="wl-kicker">${e(p.brand)}</div><h1>${e(c.headline)}</h1><p class="wl-description">${e(c.subheading)}</p><div class="wl-price"><span data-price>${p.price===undefined?"Price unavailable":e(format(p.price))}</span>${p.compareAtPrice&&p.price&&p.compareAtPrice>p.price?` <del>${e(format(p.compareAtPrice))}</del>`:""}</div></div><div>${form}${p.rating&&p.reviewCount?`<p class="wl-trust">${e(p.rating)} / 5 · ${e(p.reviewCount)} source reviews</p>`:""}${p.collectionUrl?`<p><a target="_blank" rel="noopener" href="${e(p.collectionUrl)}">Explore the collection</a></p>`:""}</div></div><div class="wl-sticky"><span data-price>${p.price!==undefined?e(format(p.price)):""}</span><button type="button">Add to cart</button></div></section>`;
  const sections=c.sections.map(key=>{
    if(key==="hero")return hero.replace(/<p class="wl-trust">.*?<\/p>/,"").replace("</form>",`</form>${trustFacts(p).length?`<p class="wl-trust">${e(trustFacts(p).join(" · "))}</p>`:""}`);
    const inner=key==="story"?`<h2>The story</h2><p>${e(c.story)}</p>`:
      key==="benefits"?`<h2>Product details</h2><div class="wl-grid">${c.benefits.map(i=>`<article class="wl-card"><h3>${e(i.title)}</h3><p>${e(i.text)}</p></article>`).join("")}</div>`:
      key==="specs"?`<h2>Specifications</h2>${Object.keys(c.specs).length?`<table><tbody>${Object.entries(c.specs).map(([k,v])=>`<tr><th scope="row">${e(k)}</th><td>${e(v)}</td></tr>`).join("")}</tbody></table>`:"<p>No verified specifications were found in the source.</p>"}`:
      key==="faq"?`<h2>Questions, answered</h2>${c.faqs.map(f=>`<details><summary>${e(f.question)}</summary><p>${e(f.answer)}</p></details>`).join("")}`:
      key==="reviews"?`<h2>From our customers</h2><div class="wl-grid">${(p.reviews??[]).map(r=>`<blockquote class="wl-card"><p>${e(r.text)}</p><cite>${e(r.author)}${r.rating?` · ${e(r.rating)} / 5`:""}</cite></blockquote>`).join("")}</div>`:"";
    return `<section class="wl wl-color-${e(c.colorUse)} wl-benefits-${c.composition.includes("grid")?"cards":c.composition.includes("editorial")?"editorial":"stack"}">${inner}${c.ctaPlacement==="hero-repeat-sticky"&&key==="benefits"?`<p><a class="wl-link" href="#wl-product-purchase">Choose your variant</a></p>`:""}</section>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(c.headline)} | ${e(p.brand)}</title><meta name="description" content="${e(c.subheading.slice(0,160))}"><link rel="canonical" href="${e(p.sourceUrl)}"><style>body{margin:0} :root{--wl-primary:${colour(b.primary)};--wl-bg:${colour(b.background)};--wl-text:${colour(b.text)};--wl-button:${colour(b.button)};--wl-heading:${font(b.headingFont)};--wl-body:${font(b.bodyFont)};--wl-radius:${Math.min(40,parseInt(b.radius)||0)}px;--wl-heading-size:${Math.min(80,parseInt(b.headingSize)||56)}px} ${readFileSync(path.join(rootDir,"shopify/assets/wishluck.css"),"utf8").replace(".wl-grid-hero",".wl-grid")}</style><script type="application/ld+json">${json(productSchema)}</script><script type="application/ld+json">${json({"@context":"https://schema.org","@type":"FAQPage",mainEntity:c.faqs.map(f=>({"@type":"Question",name:f.question,acceptedAnswer:{"@type":"Answer",text:f.answer}}))})}</script></head><body>${sections}<script>
const form=document.querySelector('form'),sel=document.querySelector('select'),sticky=document.querySelector('.wl-sticky'),status=document.querySelector('.wl-status');
form?.addEventListener('submit',ev=>{ev.preventDefault();status.textContent='Preview only. Publish to Shopify to test the real cart on the store domain.';});
sticky?.querySelector('button')?.addEventListener('click',()=>{form?.requestSubmit();form?.scrollIntoView({behavior:'smooth',block:'center'});});
if(form&&sticky)new IntersectionObserver(entries=>sticky.classList.toggle('is-visible',!entries[0].isIntersecting)).observe(form);
sel?.addEventListener('change',()=>{const option=sel.selectedOptions[0];document.querySelectorAll('[data-price]').forEach(el=>{try{el.textContent=new Intl.NumberFormat('en',{style:'currency',currency:${json(p.currency)}}).format(Number(option.dataset.price));}catch{el.textContent=option.dataset.price;}});form.querySelector('button').disabled=option.dataset.available!=='true';});
</script></body></html>`;
}
