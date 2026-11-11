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

const exec = promisify(execFile);
let connection:Connection={configured:false,connected:false,shop:"",message:"Shopify access has not been verified. Test the connection to your existing custom app.",missing:[]};
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
  try{
    const data=await admin("query { shop { name myshopifyDomain primaryDomain { url } } }");
    connection={configured:true,connected:true,shop:data.shop.myshopifyDomain,name:data.shop.name,message:"Live Shopify Admin API connection verified.",missing:[]};
  }catch(e){connection={...connection,connected:false,message:e instanceof Error?e.message:"Connection failed"};}
  return connection;
}
export async function themes():Promise<Theme[]>{
  if(!connection.connected)await connectShopify();
  if(!connection.connected)throw new AppError(503,connection.message);
  const data=await admin("query { themes(first: 50) { nodes { id name role } } }");
  return data.themes.nodes.map((t:any)=>({...t,role:t.role.toLowerCase()}));
}
export async function publish(designId:string,themeId:string,confirm:boolean){
  if(!confirm)throw new AppError(400,"Confirm the global product template suffix change before publishing.");
  const {design,content,run,category}=await getDesign(designId);
  if(design.status!=="approved")throw new AppError(409,"Approve the design before publishing.");
  if(!run.product||!run.brand)throw new AppError(409,"Missing product analysis.");
  const allThemes=await themes();
  const theme=allThemes.find(t=>t.id===themeId);
  if(!theme||!["unpublished","development"].includes(theme.role))throw new AppError(400,"Select an unpublished or development theme. Live themes are never writable here.");
  const p:Publication={id:randomUUID(),designId,title:run.product.title,status:"uploading",createdAt:new Date().toISOString(),themeName:theme.name};
  await savePublication(p);
  try{
    const shop=await admin("query { shop { myshopifyDomain primaryDomain { url } } }");
    const sourceHost=new URL(run.product.sourceUrl).hostname;
    if(![shop.shop.myshopifyDomain,new URL(shop.shop.primaryDomain.url).hostname].includes(sourceHost))throw new AppError(409,"This product is from another store. Analyse a product from your connected store before publishing; external variant IDs cannot be reused.");
    const files=compile(design,content,run.product,run.brand);
    const filenames=Object.keys(files);
    const check=await admin("query($id: ID!, $names:[String!]!) { theme(id:$id) { role files(filenames:$names,first:50) { nodes { filename } } } }",{id:themeId,names:filenames});
    if(check.theme?.role==="MAIN")throw new AppError(409,"The selected theme became live. Publishing was stopped.");
    if(check.theme?.files?.nodes?.length)throw new AppError(409,"Generated filenames already exist. Generate a new version rather than overwrite existing files.");
    const productData=await admin("query($q:String!){products(first:2,query:$q){nodes{id handle templateSuffix variants(first:1){nodes{id}}}}}",{q:`handle:${run.product.handle}`});
    const product=productData.products.nodes.find((v:any)=>v.handle===run.product!.handle);
    if(!product)throw new AppError(404,"Product handle was not found in the connected store.");
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
    const suffix=`wl-${design.id.slice(0,8)}`;
    const assigned=await admin("mutation($product:ProductUpdateInput!){productUpdate(product:$product){product{id templateSuffix} userErrors{field message}}}",{product:{id:product.id,templateSuffix:suffix,seo:{title:content.headline.slice(0,70),description:content.subheading.slice(0,160)}}});
    if(assigned.productUpdate.userErrors?.length)throw new AppError(422,assigned.productUpdate.userErrors.map((e:any)=>e.message).join("; "));
    if(assigned.productUpdate.product?.templateSuffix!==suffix)throw new AppError(502,"Shopify did not return the expected template suffix.");
    p.status="published";
    const numericTheme=themeId.split("/").pop();
    p.previewUrl=`${shop.shop.primaryDomain.url}/products/${encodeURIComponent(run.product.handle)}?preview_theme_id=${numericTheme}`;
    p.editorUrl=`https://${shop.shop.myshopifyDomain}/admin/themes/${numericTheme}/editor?template=product.${suffix}&previewPath=${encodeURIComponent(`/products/${run.product.handle}`)}`;
    design.status="published";
    await saveDesign(design,content,category);
    await db.insert(feedbackTable).values({id:randomUUID(),designId,category,action:"published",reason:"Published successfully to an unpublished/development theme."});
  }catch(e){p.status="failed";p.error=e instanceof Error?e.message:"Publishing failed";}
  await savePublication(p);
  return p;
}
