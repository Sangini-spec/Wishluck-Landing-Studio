// Explicit, isolated HTTP cart verification; never purchases or changes products.
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {load} from "cheerio";
import {storefrontAccess} from "../src/lib/storefront-access";
import {rootDir} from "../src/lib/compiler";

async function main(){
  const args=process.argv.slice(2),id=args[args.indexOf("--publication")+1];
  if(!args.includes("--publication")||!args.includes("--confirm-isolated-cart"))throw new Error("Required: --publication UUID --confirm-isolated-cart");
  const api=`https://${process.env.REPLIT_DEV_DOMAIN}/api`;
  const status=await(await fetch(`${api}/shopify/cli`)).json();
  const pub=status.uploads.find((p:any)=>p.id===id&&p.verified);
  if(!pub?.productHandle||!pub.productId)throw new Error("A verified, product-bound publication is required.");
  const access=await storefrontAccess(pub.shop,pub.previewUrl);
  const response=await access.request(pub.previewUrl),html=await response.text();
  if(!response.ok||new URL(response.url).pathname==="/password")throw new Error("Authorized product page was not reached.");
  const $=load(html),schemas:any[]=[],schemaErrors:string[]=[];
  $('script[type="application/ld+json"]').each((i,node)=>{
    try{const value=JSON.parse($(node).text());schemas.push(...(Array.isArray(value)?value:[value]));}
    catch{schemaErrors.push(`Invalid JSON-LD block ${i+1}`);}
  });
  const nodes=schemas.flatMap(value=>value["@graph"]??[value]);
  const productJson=await(await access.request(`${access.origin}/products/${encodeURIComponent(pub.productHandle)}.js`)).json();
  if(String(productJson.id)!==pub.productId.split("/").pop())throw new Error("Native product ID differs from selected publication product.");
  const accepted:any[]=[];
  const variants=productJson.variants.filter((v:any)=>v.available);
  if(!variants.length)throw new Error("No purchasable variants are available; cart acceptance cannot be claimed.");
  let cleared=false;
  try{
    for(const variant of variants){
      const result=await access.request(`${access.origin}/cart/add.js`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{id:variant.id,quantity:1}]})});
      const cart=await result.json();
      if(!result.ok||!cart.items?.some((item:any)=>String(item.variant_id)===String(variant.id)&&String(item.product_id)===String(productJson.id)))throw new Error(`Native cart did not accept selected variant (${result.status}).`);
      accepted.push({variantId:String(variant.id),quantity:1,status:result.status});
    }
  }finally{
    const result=await access.request(`${access.origin}/cart/clear.js`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    const cart=await result.json();cleared=result.ok&&cart.item_count===0;
  }
  if(!cleared)throw new Error("The isolated test cart could not be verified empty.");
  const report={testedAt:new Date().toISOString(),shop:pub.shop,themeId:pub.themeId,productHandle:pub.productHandle,
    authorizedProductPage:true,h1Count:$("h1").length,liquidError:html.includes("Liquid error"),
    cartForm:!!$('form[action*="/cart/add"]').length,productSchema:nodes.some(s=>s["@type"]==="Product"),
    faqSchema:nodes.some(s=>s["@type"]==="FAQPage"),schemaErrors,
    totalVariants:productJson.variants.length,availableVariants:variants.length,cartAccepted:accepted,isolatedCartCleared:cleared,
    limits:["HTTP/native-markup verification, not interactive mobile/desktop browser acceptance.","Local JSON-LD parsing is not Google Rich Results validation.","No Shopify editor changes or live theme activation were performed."]};
  const directory=path.join(rootDir,"generated-artifacts/storefront-verification");
  await mkdir(directory,{recursive:true});await writeFile(path.join(directory,`${pub.themeId}.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Native storefront check failed");process.exit(1);});
