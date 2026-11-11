import {load} from "cheerio";
const identifier=(value:unknown)=>/^(?:[1-9]\d*|gid:\/\/shopify\/ProductVariant\/[1-9]\d*)$/.test(String(value??""));
const money=(value:any)=>{
  const amount=value&&typeof value==="object"?value.amount:value;
  if(typeof amount!=="number"&&typeof amount!=="string"||typeof amount==="string"&&!amount.trim())return NaN;
  const n=Number(amount);return n>=0?n:NaN;
};
const cents=(value:any)=>Math.round(money(value)*100);
/** Public JSON endpoints use different money units. Never evaluate page scripts. */
export function normaliseProductJson(value:any,decimal=false){
  const p=value?.product??value;
  const variants=Array.isArray(p?.variants)?p.variants:p?.variants?.nodes??p?.variants?.edges?.map((e:any)=>e.node);
  if(!p?.title||!Array.isArray(variants))return undefined;
  return {...p,vendor:p.vendor??p.brand?.name,type:p.productType??p.type,
    description:p.descriptionHtml??p.description,
    currency:p.priceRange?.minVariantPrice?.currencyCode??p.currency,
    images:p.images?.nodes??p.images?.edges?.map((e:any)=>e.node)??p.images,
    variants:variants.filter((v:any)=>identifier(v.id)).map((v:any)=>({
      ...v,price:typeof v.price==="object"||decimal?cents(v.price):money(v.price),
      compare_at_price:v.compareAtPrice?cents(v.compareAtPrice):decimal&&v.compare_at_price?cents(v.compare_at_price):v.compare_at_price,
      available:typeof v.availableForSale==="boolean"?v.availableForSale:v.available,
    })).filter((v:any)=>Number.isFinite(v.price)),
  };
}
export function productFromHtml(html:string,handle:string,structured:any){
  const $=load(html);
  let embedded:any;
  const visit=(value:any,depth=0)=>{
    if(embedded||!value||typeof value!=="object"||depth>7)return;
    if(value.handle===handle){
      const normal=normaliseProductJson(value,typeof value.variants?.[0]?.price==="string");
      if(normal?.variants.length){embedded=normal;return;}
    }
    for(const child of Object.values(value).slice(0,150))visit(child,depth+1);
  };
  $('script[type="application/json"]').each((_,el)=>{try{visit(JSON.parse($(el).text()));}catch{/* Not executable data. */}});
  if(embedded)return {raw:embedded,headless:false};
  const title=String(structured?.name??$("h1").first().text()).trim();
  const offer=Array.isArray(structured?.offers)?structured.offers[0]:structured?.offers;
  const amount=money(offer?.price);
  let formRaw:any,headless=false;
  const scope=$("main").length?$("main"):$("body");
  scope.find("form").each((_,element)=>{
    if(formRaw||!title||!Number.isFinite(amount)||!String(offer?.priceCurrency??"").match(/^[A-Z]{3}$/))return;
    const form=$(element),action=form.attr("action")??"";
    if(!/^(?:\/cart\/add(?:\.js)?|\/api\/cart)(?:[?#]|$)/.test(action))return;
    const input=form.find('input[name="merchandiseId"],input[name="id"],select[name="id"]').first();
    const id=input.is("select")?input.find("option[selected]").attr("value")??input.find("option").first().attr("value"):input.attr("value");
    if(!identifier(id))return;
    const button=form.find('button[type="submit"],button:not([type]),input[type="submit"]').first();
    if(!button.length)return;
    headless=String(id).startsWith("gid://");
    formRaw={title,handle,vendor:structured?.brand?.name??structured?.brand,type:structured?.category,
      description:structured?.description,images:structured?.image,currency:offer.priceCurrency,
      variants:[{id,title:input.is("select")?input.find("option:selected").text()||"Selected option":"Selected option",
        price:cents(amount),available:!button.is("[disabled]")&&button.attr("aria-disabled")!=="true"}]};
  });
  return {raw:formRaw,headless};
}
