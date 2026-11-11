import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError, type Publication } from "./domain";
import { compile, rootDir } from "./compiler";
import { getDesign, savePublication, saveDesign } from "./store";
import { db, feedbackTable } from "@workspace/db";
import type { Connection, Theme } from "@workspace/api-zod";
import { shopifyConfig, customAdmin } from "./shopify-auth";
import { importDraft, mappedProduct, productFields } from "./shopify-products";
import type { PublishInput, PublishingContext } from "@workspace/api-zod";
import {rememberStore,selectStore,withStoreLock} from "./shopify-selection";

const exec = promisify(execFile);
let connection:Connection={configured:false,connected:false,shop:"",message:"Shopify access has not been verified. Test the connection to your existing custom app.",missing:[]};
let lastVerified=0;
export const shopifyStatus=()=>({...connection,...shopifyConfig(),message:connection.connected?connection.message:"Credentials are checked for presence only. Test connection to verify actual Shopify access."});
export async function admin(query:string,variables:Record<string,unknown>={}):Promise<any>{
  // Use the installed custom app requested by the assignment. An authorised
  // managed Shopify connector is an explicit alternative, never a new store.
  if(process.env.SHOPIFY_CONNECTOR_NAME!=="shopify"&&process.env.SHOPIFY_CONNECTOR_NAME!=="shopify-store")return customAdmin(query,variables);
  try{
    const {stdout}=await exec(process.execPath,[path.join(rootDir,"shopify-admin-api.mjs"),JSON.stringify({query,variables})],{timeout:45000,maxBuffer:4*1024*1024});
    const result=JSON.parse(stdout);
    if(result.errors?.length)throw new AppError(502,result.errors.map((e:any)=>e.message).join("; "));
    return result.data;
  }catch(error:any){
    let detail="Shopify integration is not connected or the API request was denied.";
    try {const data=JSON.parse(error.stdout);detail=data.errors?.map((e:any)=>e.message).join("; ")||data.message||detail;} catch { /* Never echo credential-bearing process errors. */ }
    throw new AppError(503,detail);
  }
}
export async function connectShopify(){
  const requestedShop=shopifyConfig().shop;
  try{
    const data=await admin("query { shop { name myshopifyDomain primaryDomain { url } } }");
    const verified:Connection={configured:true,connected:true,shop:data.shop.myshopifyDomain,name:data.shop.name,primaryDomain:data.shop.primaryDomain.url,message:"Live Shopify Admin API connection verified.",missing:[]};
    if(requestedShop===shopifyConfig().shop){connection=verified;lastVerified=Date.now();await rememberStore(verified);}
  }catch(e){connection={...connection,connected:false,message:e instanceof Error?e.message:"Connection failed"};}
  return connection;
}
export async function verifiedShopifyStatus(){
  if(Date.now()-lastVerified>60000){await connectShopify();lastVerified=Date.now();}
  return shopifyStatus();
}
export async function switchShopifyStore(shop:string){
  return withStoreLock(async()=>{
    if(["shopify","shopify-store"].includes(process.env.SHOPIFY_CONNECTOR_NAME??""))throw new AppError(409,"This managed connection must be reconnected through its Shopify connection settings.");
    const data=await customAdmin("query { shop { name myshopifyDomain primaryDomain { url } } }",{},0,shop);
    if(data.shop.myshopifyDomain.toLowerCase()!==shop.toLowerCase())throw new AppError(409,"Shopify returned a different store. The current connection was not changed.");
    const verified:Connection={configured:true,connected:true,shop:data.shop.myshopifyDomain,name:data.shop.name,primaryDomain:data.shop.primaryDomain.url,message:"Live Shopify Admin API connection verified.",missing:[]};
    await selectStore(verified);connection=verified;lastVerified=Date.now();
    return verified;
  });
}
export async function themes():Promise<Theme[]>{
  if(!connection.connected)await connectShopify();
  if(!connection.connected)throw new AppError(503,connection.message);
  const data=await admin("query { themes(first: 50) { nodes { id name role } } }");
  return data.themes.nodes.map((t:any)=>({...t,role:t.role.toLowerCase()}));
}
export async function publishingContext(designId:string):Promise<PublishingContext>{
  const {run}=await getDesign(designId);
  const data=await admin("query{shop{name myshopifyDomain currencyCode primaryDomain{url}} currentAppInstallation{accessScopes{handle}} products(first:50){nodes{id title handle status}}}");
  const normal=(s:string)=>s.toLowerCase().replace(/^www\./,"");
  const host=new URL(run.product!.sourceUrl).hostname;
  await connectShopify();
  return {shop:data.shop.myshopifyDomain,name:data.shop.name,primaryDomain:data.shop.primaryDomain.url,currency:data.shop.currencyCode,
    sourceHost:host,sourceCurrency:run.product!.currency,sameStore:[data.shop.myshopifyDomain,new URL(data.shop.primaryDomain.url).hostname].some(h=>normal(h)===normal(host)),
    products:data.products.nodes,canImport:data.currentAppInstallation.accessScopes.some((s:any)=>s.handle==="write_products")};
}
export async function publish(designId:string,themeId:string,confirm:boolean,options:Partial<PublishInput>={}){
  if(!confirm)throw new AppError(400,"Confirm the global product template suffix change before publishing.");
  const {design,content,run,category}=await getDesign(designId);
  if(design.status!=="approved")throw new AppError(409,"Approve the design before publishing.");
  if(!run.product||!run.brand)throw new AppError(409,"Missing product analysis.");
  const allThemes=await themes();
  const theme=allThemes.find(t=>t.id===themeId);
  if(!theme||!["unpublished","development"].includes(theme.role))throw new AppError(400,"Select an unpublished or development theme. Live themes are never writable here.");
  const context=await publishingContext(designId);
  if(options.expectedShop&&options.expectedShop!==context.shop)throw new AppError(409,"The connected Shopify store changed. Reopen the publishing dialog and review the destination again.");
  const mode=options.productMode??"source";
  if(!context.sameStore&&mode==="source")throw new AppError(409,`This source product is on ${context.sourceHost}; your connected store is ${context.shop}. Choose a product in your store or explicitly import a draft copy.`);
  if(mode==="import"&&!options.confirmProductImport)throw new AppError(400,"Confirm that you have the rights to import the source product and images into your store as a draft.");
  if(mode==="import"&&!context.canImport)throw new AppError(403,"This installed app needs write_products to import a draft.");
  if(mode==="import"&&run.product.currency!==context.currency&&!options.confirmCurrencyMismatch)throw new AppError(409,`Confirm numeric prices in ${context.currency}; the source is priced in ${run.product.currency}. No currency conversion will be performed.`);
  if(mode==="existing"&&!options.productId)throw new AppError(400,"Choose the actual target product in your connected store.");
  const p:Publication={id:randomUUID(),designId,title:run.product.title,status:"uploading",createdAt:new Date().toISOString(),themeName:theme.name,shop:context.shop,imported:false,warnings:[]};
  await savePublication(p);
  try{
    // Verify source/selected target with the connected store, never reuse external IDs.
    let product:any;
    if(mode==="existing"){
      const selected=await admin(`query($id:ID!){product(id:$id){${productFields}}}`,{id:options.productId});
      product=selected.product;
    }else if(mode==="source"){
      const own=await admin(`query($q:String!){products(first:3,query:$q){nodes{${productFields}}}}`,{q:`handle:${run.product.handle}`});
      product=own.products.nodes.find((v:any)=>v.handle===run.product!.handle);
    }
    if(mode!=="import"&&!product)throw new AppError(404,"The target product was not found in your connected store.");
    let target=product?mappedProduct(run.product,product,context.primaryDomain,context.currency,false):{...run.product,images:[],rating:null,reviewCount:null,reviews:[]};
    if(mode==="source")Object.assign(target,{specs:run.product.specs,rating:run.product.rating,reviewCount:run.product.reviewCount,reviews:run.product.reviews});
    let publicationContent=structuredClone(content);
    if(mode==="existing"&&product.handle!==run.product.handle){
      // A selected different product keeps the composition, not unrelated source claims.
      publicationContent={...publicationContent,headline:target.title,subheading:target.description.slice(0,260),story:target.description,
        benefits:[],specs:{},faqs:[{question:`What is ${target.title}?`,answer:target.description||`${target.title} is offered by ${target.brand}.`}],
        sections:publicationContent.sections.filter(key=>!["benefits","specs","reviews"].includes(key))};
      p.warnings!.push("Source copy and imagery were replaced with the selected store product's actual facts. Review the native preview before use.");
    }
    if(mode==="import"){
      delete target.collectionUrl;
      const policy=/return|refund|shipping|delivery|\bcod\b|guarantee/i;
      target.specs=Object.fromEntries(Object.entries(target.specs).filter(([key,value])=>!policy.test(`${key} ${value}`)));
      publicationContent.specs=target.specs;
      publicationContent.benefits=publicationContent.benefits.filter(item=>!policy.test(`${item.title} ${item.text}`));
      publicationContent.faqs=publicationContent.faqs.filter(f=>!/return|refund|shipping|delivery|cod|guarantee/i.test(`${f.question} ${f.answer}`));
      publicationContent.sections=publicationContent.sections.filter(key=>key!=="reviews");
      p.warnings!.push("Draft import selected. The product will not be activated for sale; pricing, inventory and image rights require merchant review.");
    }
    // Theme validation happens BEFORE product creation so a theme permission failure
    // does not leave unnecessary product copies in the merchant's store.
    const files=compile(design,publicationContent,target,run.brand);
    const filenames=Object.keys(files);
    const check=await admin("query($id: ID!, $names:[String!]!) { theme(id:$id) { role files(filenames:$names,first:50) { nodes { filename } } } }",{id:themeId,names:filenames});
    if(check.theme?.role==="MAIN")throw new AppError(409,"The selected theme became live. Publishing was stopped.");
    if(check.theme?.files?.nodes?.length)throw new AppError(409,"These generated filenames already exist on this theme. Generate a new version to preserve any native-editor changes.");
    const result=await admin("mutation($themeId:ID!,$files:[OnlineStoreThemeFilesUpsertFileInput!]!){themeFilesUpsert(themeId:$themeId,files:$files){job{id done} upsertedThemeFiles{filename} userErrors{field message}}}",{themeId,files:filenames.map(filename=>({filename,body:{type:"TEXT",value:files[filename]}}))});
    const write=result.themeFilesUpsert;
    if(write.userErrors?.length)throw new AppError(422,write.userErrors.map((e:any)=>e.message).join("; "));
    if(write.job&&!write.job.done){
      let done=false;
      for(let i=0;i<15;i++){
        await new Promise(r=>setTimeout(r,1500));
        const job=await admin("query($id:ID!){job(id:$id){done}}",{id:write.job.id});
        if(job.job?.done){done=true;break;}
      }
      if(!done)throw new AppError(504,"Shopify theme write is still pending. Product assignment was not changed.");
    }
    const verified=await admin("query($id:ID!,$names:[String!]!){theme(id:$id){files(filenames:$names,first:50){nodes{filename}}}}",{id:themeId,names:filenames});
    if(verified.theme.files.nodes.length!==filenames.length)throw new AppError(502,"Not all theme files could be verified. Product assignment was not changed.");
    if(mode==="import"){
      product=await importDraft(admin,run.product,run.id,context.currency,!!options.confirmCurrencyMismatch,async created=>{
        p.imported=true;p.productId=created.id;p.productHandle=created.handle;p.productStatus=created.status;
        p.adminUrl=`https://${context.shop}/admin/products/${created.id.split("/").pop()}`;await savePublication(p);
      });
      p.imported=true;
      target=mappedProduct(run.product,product,context.primaryDomain,context.currency,true);
      p.variantMap=Object.fromEntries(run.product.variants.map(v=>[v.id,String(product.variants.nodes.find((nv:any)=>nv.title===v.title)?.id??"")]));
      if(Object.values(p.variantMap).some(v=>!v))throw new AppError(502,"Source variants could not all be matched to new store variant IDs. The imported product remains a draft.");
    }
    p.productId=product.id;p.productHandle=product.handle;p.productStatus=product.status;p.adminUrl=`https://${context.shop}/admin/products/${product.id.split("/").pop()}`;
    const suffix=`wl-${design.id.slice(0,8)}`;
    const assigned=await admin("mutation($product:ProductUpdateInput!){productUpdate(product:$product){product{id templateSuffix} userErrors{field message}}}",{product:{id:product.id,templateSuffix:suffix,seo:{title:content.headline.slice(0,70),description:content.subheading.slice(0,160)}}});
    if(assigned.productUpdate.userErrors?.length)throw new AppError(422,assigned.productUpdate.userErrors.map((e:any)=>e.message).join("; "));
    if(assigned.productUpdate.product?.templateSuffix!==suffix)throw new AppError(502,"Shopify did not return the expected template suffix.");
    p.status="published";
    const numericTheme=themeId.split("/").pop();
    const previewPath=product.status==="DRAFT"&&product.onlineStorePreviewUrl?new URL(product.onlineStorePreviewUrl).pathname+new URL(product.onlineStorePreviewUrl).search:`/products/${encodeURIComponent(product.handle)}`;
    p.previewUrl=product.status==="DRAFT"&&product.onlineStorePreviewUrl?`${product.onlineStorePreviewUrl}${product.onlineStorePreviewUrl.includes("?")?"&":"?"}preview_theme_id=${numericTheme}`:`${context.primaryDomain}${previewPath}?preview_theme_id=${numericTheme}`;
    p.editorUrl=`https://${context.shop}/admin/themes/${numericTheme}/editor?template=product.${suffix}&previewPath=${encodeURIComponent(previewPath)}`;
    design.status="published";
    await saveDesign(design,content,category);
    await db.insert(feedbackTable).values({id:randomUUID(),designId,category,action:"published",reason:"Published successfully to an unpublished/development theme."});
  }catch(e){
    p.status="failed";p.error=e instanceof Error?e.message:"Publishing failed";
    if(/exemption|access denied for themeFilesUpsert/i.test(p.error)){
      p.error=`Your store ${context.shop} is authenticated, but Shopify requires a theme-file API exemption in addition to write_themes. Automatic upload is blocked by Shopify. No draft product was created by this attempt. Request the exemption or download the theme ZIP for manual installation.`;
      p.helpUrl="https://docs.google.com/forms/d/e/1FAIpQLSfZTB1vxFC5d1-GPdqYunWRGUoDcOheHQzfK2RoEFEHrknt5g/viewform";
    }
  }
  await savePublication(p);
  return p;
}
