import {load} from "cheerio";
import type {Run} from "./domain";
import {publicUrl,permitted,safeFetch} from "./network";
import {productFromHtml} from "./product-source";
import {logger} from "./logger";
import {reviewedInputKey,sameReviewedInputs} from "./research-identity";

async function readPublicHtml(url:string){
  await publicUrl(url);await permitted(url);
  const response=await safeFetch(url);
  if(!response.ok||!response.body)throw new Error("Public product page unavailable");
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,html="";
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000)throw new Error("Product page exceeded the capture limit");html+=decoder.decode(value,{stream:true});}}
  finally{await reader.cancel().catch(()=>{});}
  return html+decoder.decode();
}
/** Enrich legacy missing IDs without replacing merchant-written facts or brand. */
export async function refreshMissingVariants(run:Run,read=readPublicHtml){
  const p=run.product;
  if(!p||p.variants?.length||!p.sourceUrl)return false;
  try{
    const html=await read(p.sourceUrl),$=load(html);let structured:any;
    $('script[type="application/ld+json"]').each((_,el)=>{
      try{
        const value=JSON.parse($(el).text()),items=Array.isArray(value)?value:value["@graph"]??[value];
        structured??=items.find((item:any)=>(item["@type"]==="Product"||item["@type"]?.includes?.("Product"))&&item.name===p.title);
      }catch{/* Invalid public data is not evidence. */}
    });
    const found=productFromHtml(html,p.handle,structured).raw;
    if(!found?.variants.length||found.title!==p.title)return false;
    const firstPrice=found.variants[0].price/100;
    if(p.price!==undefined&&p.price!==firstPrice)return false;
    if(p.currency!=="XXX"&&p.currency!==found.currency)return false;
    const onlyIdentifiersChanged=p.price===firstPrice&&p.currency===found.currency,currentResearch=sameReviewedInputs(run);
    p.variants=found.variants.map((v:any)=>({id:String(v.id),title:String(v.title??"Selected option"),price:v.price/100,
      compareAtPrice:v.compare_at_price?v.compare_at_price/100:null,available:v.available===true}));
    p.price=firstPrice;p.currency=found.currency;
    run.warnings=run.warnings.filter(w=>!/^Product JSON unavailable:|^Variant IDs could not be verified\.|^The source does not expose purchase options\./.test(w));
    // Public identifiers alone do not change which products compete. Actual
    // price/currency corrections still invalidate previous research normally.
    if(onlyIdentifiersChanged&&currentResearch)run.researchKey=reviewedInputKey(run);
    return true;
  }catch{
    logger.info({runId:run.id},"Missing source variants could not be refreshed; generation still uses reviewed facts");
    return false;
  }
}
