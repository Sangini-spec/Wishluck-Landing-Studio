import {load} from "cheerio";
import {AppError} from "./domain";
import {publicUrl,permitted,safeFetch} from "./network";
import {admin} from "./shopify";
import {shopifyConfig} from "./shopify-auth";
import type {ProductDiscovery} from "@workspace/api-zod";

const limit=24;
export function productLink(raw:string,base:string):string|null{
  try{
    const url=new URL(raw,base),source=new URL(base);
    if(url.origin!==source.origin||url.protocol!=="https:"||url.username||url.password)return null;
    const match=url.pathname.match(/^(.*)\/products\/([^/]+)\/?$/);
    if(!match||/\.(js|json)$/i.test(match[2]))return null;
    url.pathname=`${match[1].replace(/\/collections\/[^/]+$/,"")}/products/${match[2]}`;
    url.search="";url.hash="";return url.href;
  }catch{return null;}
}
async function limitedText(response:Response){
  const reader=response.body?.getReader();if(!reader)return "";
  const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;
      if(size>2_000_000)throw new AppError(422,"The store response is too large to inspect safely. Try a collection or specific product URL.");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }finally{await reader.cancel().catch(()=>{});}
}
type Services={validate:typeof publicUrl;permit:typeof permitted;fetch:typeof safeFetch;shop:()=>string;admin:typeof admin};
const defaults:Services={validate:publicUrl,permit:permitted,fetch:safeFetch,shop:()=>shopifyConfig().shop,admin};
export async function discoverProducts(raw:string,services:Services=defaults):Promise<ProductDiscovery>{
  const source=await services.validate(raw);
  const products=new Map<string,{url:string;title:string}>();
  const add=(url:string,title:string,base=source.href)=>{
    const canonical=productLink(url,base);
    if(canonical&&(products.has(canonical)||products.size<limit)){
      let fallback=new URL(canonical).pathname.split("/").pop()!;try{fallback=decodeURIComponent(fallback);}catch{/* Keep an undecodable handle as display text only. */}
      products.set(canonical,{url:canonical,title:title.trim().slice(0,240)||fallback.replaceAll("-"," ")});
    }
  };
  const result=(sourceUrl:string,message?:string)=>({sourceUrl,products:[...products.values()],message:message??`Choose a product to analyse. Showing up to ${limit} products; you can also paste a specific product link.`});
  // Only the exact connected store can use its installed Admin credentials.
  if(source.hostname===services.shop()){
    const collection=source.pathname.match(/\/collections\/([^/]+)\/?$/);
    const data=collection?await services.admin("query($query:String!){collections(first:1,query:$query){nodes{handle products(first:24){nodes{title handle}}}}}",{query:`handle:${decodeURIComponent(collection[1])}`}):
      await services.admin("query{products(first:24){nodes{title handle}}}");
    const nodes=collection?data.collections.nodes.find((c:any)=>c.handle===decodeURIComponent(collection[1]))?.products.nodes??[]:data.products.nodes;
    for(const p of nodes)add(`/products/${encodeURIComponent(p.handle)}`,p.title);
    if(products.size)return result(source.href,"Products from your connected store. Choose the one to analyse.");
    throw new AppError(422,"No products were found in your connected store. Add a product in Shopify, then try again.");
  }
  let final=source,blocked=false;
  const reasons:string[]=[];
  try{
    await services.permit(source.href);
    const response=await services.fetch(source.href);
    if(!response.ok)throw new AppError(422,`The store page returned HTTP ${response.status}.`);
    final=await services.validate(response.url||source.href);
    const html=await limitedText(response),$=load(html);
    blocked=final.pathname==="/password"||$('form[action*="/password"] input[name="password"]').length>0;
    if(!blocked){
      const direct=productLink(final.href,final.href);if(direct)add(direct,$("h1").first().text(),final.href);
      $("link[rel='canonical'], a[href]").each((_i,node)=>{
        const value=$(node).attr("href");
        if(value)add(value,$(node).text()||$(node).attr("title")||"",final.href);
      });
    }
  }catch(error){reasons.push(error instanceof Error?error.message:"The store page could not be read.");}
  if(blocked)throw new AppError(422,"This store is password protected. Connect this store with authorised access, or provide an accessible product page. A store URL is supported, but its products must be readable.");
  // Collection catalog endpoints preserve the user's requested collection.
  const collection=final.pathname.match(/^(.*\/collections\/[^/]+)\/?$/);
  const catalog=new URL(collection?`${collection[1]}/products.json`:"/products.json",final.origin);
  catalog.searchParams.set("limit",String(limit));
  try{
    await services.permit(catalog.href);
    const response=await services.fetch(catalog.href);
    if(response.ok){
      const json=JSON.parse(await limitedText(response));
      if(Array.isArray(json.products)){
        for(const p of json.products)if(typeof p.handle==="string"&&typeof p.title==="string")add(`/products/${encodeURIComponent(p.handle)}`,p.title,final.href);
      }
    }else reasons.push(`The public product catalogue returned HTTP ${response.status}.`);
  }catch(error){reasons.push(error instanceof Error?error.message:"The public product catalogue could not be read.");}
  if(!products.size)throw new AppError(422,`No readable products were found at this URL. Try a product or collection link, or connect the store if it is protected. ${reasons.join(" ")}`.trim());
  return result(final.href);
}
