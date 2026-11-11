import { load } from "cheerio";
import { z } from "zod";
import { crawl, shopifyFont } from "./crawler";
import { publicUrl, safeFetch, permitted } from "./network";
import { askJson, aiReady } from "./ai";
import { event, saveRun } from "./store";
import type { Product, Run } from "./domain";
import { AppError } from "./domain";
import { admin } from "./shopify";
import type { Brand } from "./domain";
import { missingFacts } from "./facts";

const strip = (text: string) => load(text || "").text().trim();
export async function analyseProduct(run: Run) {
  const url = await publicUrl(run.url);
  const match = url.pathname.match(/\/products\/([^/]+)/);
  if (!match?.[1]) throw new AppError(400, "Use a Shopify product URL containing /products/product-handle.");
  const handle = decodeURIComponent(match[1]);
  await event(run,"extracting","Reading the product and capturing desktop/mobile evidence.");
  let evidence: {
    html:string;text:string;sections:string[];screenshot?:string;mobileScreenshot?:string;
    brand:Brand;screenshotBytes?:Buffer;
  };
  let adminRaw:any,adminCurrency:string|undefined;
  try{evidence=await crawl(url.href, run.id);}
  catch(crawlError){
    // Authorised API access to the user's own store is not a robots bypass.
    // No unauthorised competitor or external store is fetched through this path.
    const data=await admin("query($q:String!){shop{myshopifyDomain currencyCode primaryDomain{url}} products(first:2,query:$q){nodes{id title handle vendor productType descriptionHtml images(first:30){nodes{url}} variants(first:100){nodes{id title price compareAtPrice availableForSale}}}}}",{q:`handle:${handle}`}).catch(()=>null);
    if(!data||![data.shop.myshopifyDomain,new URL(data.shop.primaryDomain.url).hostname].includes(url.hostname)){
      throw new AppError(422,`Storefront analysis failed: ${crawlError instanceof Error?crawlError.message:"website unavailable"}. An authorised own-store API fallback is not available for this URL.`);
    }
    const p=data.products.nodes.find((v:any)=>v.handle===handle);
    if(!p)throw new AppError(404,"Product handle was not found in your connected store.");
    adminRaw={id:p.id.split("/").pop(),title:p.title,vendor:p.vendor,type:p.productType,description:p.descriptionHtml,
      images:p.images.nodes.map((i:any)=>i.url),variants:p.variants.nodes.map((v:any)=>({id:v.id.split("/").pop(),title:v.title,price:Math.round(Number(v.price)*100),compare_at_price:v.compareAtPrice?Math.round(Number(v.compareAtPrice)*100):null,available:v.availableForSale}))};
    adminCurrency=data.shop.currencyCode;
    const body=strip(p.descriptionHtml);
    evidence={html:p.descriptionHtml,text:body,sections:[],brand:{
      primary:"#222222",secondary:"#eeeeee",background:"#ffffff",text:"#222222",button:"#222222",
      headingFont:"Arial",bodyFont:"Arial",shopifyHeadingFont:"assistant_n4",shopifyBodyFont:"assistant_n4",
      headingSize:"48px",bodySize:"16px",headingWeight:"600",bodyWeight:"400",tone:"Needs merchant review",radius:"0px",spacing:"36px",imageStyle:"Unavailable",buttonStyle:"Unavailable",
      evidence:"Manual defaults only: storefront CSS and screenshots could not be obtained. These values were NOT measured. Review and save the brand profile before generation.",
    }};
    run.warnings.push(`Public storefront unavailable (${crawlError instanceof Error?crawlError.message:"crawl failed"}). Product facts came from your authorised Shopify Admin API. Screenshots, computed fonts, palette and visual brand analysis remain unverified.`);
  }
  run.screenshot = evidence.screenshot;
  run.mobileScreenshot = evidence.mobileScreenshot;
  run.brand = evidence.brand;
  const $ = load(evidence.html);
  const jsonld: Record<string, any>[] = [];
  $('script[type="application/ld+json"]').each((_i,e) => {
    try {
      const parsed = JSON.parse($(e).text());
      for (const p of Array.isArray(parsed) ? parsed : [parsed]) jsonld.push(...(p["@graph"] ?? [p]));
    } catch { /* Invalid merchant schema is not treated as source evidence. */ }
  });
  const structured = jsonld.find(p => p["@type"] === "Product" || Array.isArray(p["@type"]) && p["@type"].includes("Product"));
  const jsUrl = `${url.origin}/products/${encodeURIComponent(handle)}.js`;
  let raw: any=adminRaw;
  try {
    if(!raw){
    await permitted(jsUrl);
    const response = await safeFetch(jsUrl);
    if (!response.ok) throw new Error(`Shopify product endpoint returned ${response.status}`);
    raw = await response.json();
    if (!raw.title || !Array.isArray(raw.variants)) throw new Error("Invalid Shopify product response");
    }
  } catch (e) {
    run.warnings.push(`Product JSON unavailable: ${e instanceof Error ? e.message : "unknown error"}. Using public structured data; cart requires verified variant IDs.`);
  }
  if (!raw && !structured) throw new AppError(422,"No public Shopify product data found. Password-protected stores need a public preview or connected store access.");
  const title = String(raw?.title ?? structured?.name ?? $("h1").first().text()).trim();
  const offer = Array.isArray(structured?.offers) ? structured?.offers[0] : structured?.offers;
  let currency = String(adminCurrency ?? offer?.priceCurrency ?? "");
  if (!currency) {
    const matchCurrency = evidence.html.match(/Shopify\.currency\s*=\s*\{\s*["']?active["']?\s*:\s*["']([A-Z]{3})/);
    currency = matchCurrency?.[1] ?? $('meta[property="product:price:currency"]').attr("content") ?? "XXX";
  }
  const variants = (raw?.variants ?? []).map((v: any) => ({
    id: String(v.id), title: String(v.public_title ?? v.title ?? "Default"), price: Number(v.price) / 100,
    compareAtPrice: v.compare_at_price ? Number(v.compare_at_price) / 100 : null, available: v.available === true,
  }));
  const imageData=raw?.images ?? structured?.image ?? [];
  const images:string[]=(Array.isArray(imageData)?imageData:[imageData]).map((v:any)=>String(v?.src??v?.url??v)).filter(Boolean);
  const specs: Record<string,string> = {};
  $("table tr").each((_i,e) => {
    const cells = $(e).find("th,td").toArray().map(v => $(v).text().trim());
    if (cells.length === 2 && cells[0] && cells[1]) specs[cells[0]] = cells[1].slice(0,500);
  });
  for(const item of Array.isArray(structured?.additionalProperty)?structured.additionalProperty:[]){
    if(item.name&&item.value)specs[String(item.name)]=String(item.value).slice(0,500);
  }
  if(structured?.material)specs.Materials=String(structured.material);
  for(const key of ["width","height","depth","weight"]){
    const value=structured?.[key];
    if(value)specs[key]=typeof value==="object"?`${value.value??""} ${value.unitText??value.unitCode??""}`.trim():String(value);
  }
  const collection = $('a[href*="/collections/"]').toArray().map(a => $(a).attr("href")).find(h => h && !h.includes("/products/") && !h.includes("/all"));
  const description = strip(raw?.description ?? structured?.description ?? "");
  const rating = structured?.aggregateRating;
  const product: Product = {
    title, handle, brand: String(raw?.vendor ?? structured?.brand?.name ?? structured?.brand ?? url.hostname),
    category: String(raw?.type || structured?.category || "Uncategorised").trim(),
    description, images: images.filter(Boolean).map(i => new URL(i.startsWith("//") ? `https:${i}` : i,url).href).filter(i => i.startsWith("https://")),
    variants, price: variants[0]?.price ?? (offer?.price ? Number(offer.price) : undefined),
    compareAtPrice: variants[0]?.compareAtPrice ?? null, currency, specs,
    shopifyId: raw?.id ? String(raw.id) : undefined,
    rating: rating?.ratingValue && Number(rating.ratingValue) > 0 ? Number(rating.ratingValue) : null,
    reviewCount: rating?.reviewCount ? Number(rating.reviewCount) : null,
    collectionUrl: collection ? new URL(collection,url).href : undefined,
    sourceUrl: url.href, missingFacts: ["Delivery estimate","COD availability","Return policy","Package contents"].filter(f => !(f in specs)),
    reviews:(Array.isArray(structured?.review)?structured.review:structured?.review?[structured.review]:[]).filter((r:any)=>typeof r.reviewBody==="string"&&r.reviewBody.trim()).slice(0,30).map((r:any)=>({
      text:String(r.reviewBody),author:String(r.author?.name??"Source reviewer"),sourceUrl:url.href,
      rating:r.reviewRating?.ratingValue?Number(r.reviewRating.ratingValue):null,
    })),
  };
  product.missingFacts=missingFacts(product);
  if (!variants.length) run.warnings.push("Variant IDs could not be verified. Shopify cart and publishing must not be claimed working.");
  if (currency === "XXX") run.warnings.push("Currency was not found; it is marked unknown, not guessed.");
  run.product = product;
  await event(run,"analysing_brand","Computed styles extracted. Analysing brand screenshot and sourced product facts.");
  if (aiReady() && evidence.screenshotBytes) {
    try {
      const result = await askJson(
        `Analyse this product screenshot and computed style evidence. Return JSON {tone,imageStyle,category,secondary,notes}. secondary must be a hex colour actually visible, not invented. category is a broad reusable product category (e.g. Clothing, Accessories), based on source product facts. Describe tone and image style conservatively. Facts: ${JSON.stringify(product)}. Computed styles: ${JSON.stringify(run.brand)}. Source excerpt: ${evidence.text.slice(0,10000)}`,
        z.object({ tone:z.string(),imageStyle:z.string(),category:z.string(),secondary:z.string().regex(/^#[0-9a-fA-F]{6}$/),notes:z.string() }), evidence.screenshotBytes);
      Object.assign(run.brand, { tone:result.value.tone,imageStyle:result.value.imageStyle,secondary:result.value.secondary,evidence:`CSS/computed styles + vision analysis of actual screenshot. ${result.value.notes}` });
      if (product.category === "Uncategorised") product.category = result.value.category;
      run.aiCost = result.estimatedCost;
    } catch {
      run.warnings.push("Visual AI analysis failed; computed styles remain available and need manual review.");
    }
  } else run.warnings.push(evidence.screenshotBytes?"AI is not configured; tone and image style require manual review.":"No screenshot was available; visual brand analysis was not performed.");
  run.brand.shopifyHeadingFont = shopifyFont(run.brand.headingFont);
  run.brand.shopifyBodyFont = shopifyFont(run.brand.bodyFont);
  run.status = "analysed";
  await event(run,"review","Product and brand analysis saved. Review and correct the findings before generation.");
  await saveRun(run);
}
