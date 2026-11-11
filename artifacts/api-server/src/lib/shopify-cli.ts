import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {createRequire} from "node:module";
import {mkdir,mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {randomUUID} from "node:crypto";
import {AppError,type Publication} from "./domain";
import {compile} from "./compiler";
import {standaloneTheme} from "./theme-package";
import {getDesign,savePublication,publications,saveDesign} from "./store";
import {shopifyConfig} from "./shopify-auth";
import {admin,publishingContext} from "./shopify";
import {preparePublicationProduct} from "./publication-product";
import type {CliUploadInput} from "@workspace/api-zod";
import {db,feedbackTable} from "@workspace/db";

const exec=promisify(execFile);
const require=createRequire(import.meta.url);
export function cliSecretKey(shop:string){
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(shop))throw new AppError(400,"A canonical myshopify.com store domain is required.");
  return `SHOPIFY_CLI_THEME_TOKEN_${shop.replace(".myshopify.com","").replaceAll("-","_").toUpperCase()}`;
}
export function cliCredential(shop:string,env:NodeJS.ProcessEnv=process.env){
  const scoped=env[cliSecretKey(shop)];
  const generic=env.SHOPIFY_FLAG_STORE===shop?env.SHOPIFY_CLI_THEME_TOKEN:undefined;
  const token=scoped||generic;
  if(!token)throw new AppError(503,`Add ${cliSecretKey(shop)} through project Secrets. A generic SHOPIFY_CLI_THEME_TOKEN is accepted only when SHOPIFY_FLAG_STORE is explicitly bound to this same store.`);
  return token;
}
export function cliEnvironment(shop:string,token:string,home:string,source:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv{
  // Do not inherit other store tokens, app credentials, debug flags, a live
  // theme target or SHOPIFY_FLAG_PUBLISH from the parent server.
  return {PATH:source.PATH,HOME:home,XDG_CONFIG_HOME:path.join(home,"config"),CI:"1",NO_COLOR:"1",
    SHOPIFY_CLI_NO_ANALYTICS:"1",SHOPIFY_CLI_NO_UPDATE_NOTIFIER:"1",SHOPIFY_CLI_THEME_TOKEN:token,SHOPIFY_FLAG_STORE:shop};
}
export function safeCliMessage(message:string,token:string){
  return message.split(token).join("[REDACTED]").split(encodeURIComponent(token)).join("[REDACTED]")
    .replace(/\x1b\[[0-9;]*m/g,"").slice(0,3500);
}
export async function runThemeCli(shop:string,args:string[],json=true){
  const token=cliCredential(shop);
  // Keep CLI sessions outside the project/repository. No workspace Git state or
  // saved browser/CLI account is ever available to a Theme Access subprocess.
  const home=await mkdtemp(path.join(tmpdir(),"wishluck-cli-session-"));
  try{
    const binary=path.join(path.dirname(require.resolve("@shopify/cli/package.json")),"bin/run.js");
    const {stdout}=await exec(process.execPath,[binary,"theme",...args,"--store",shop,"--no-input","--no-color"],
      {cwd:home,env:cliEnvironment(shop,token,home),timeout:240000,maxBuffer:4*1024*1024});
    if(!json)return {};
    try{return JSON.parse(stdout);}catch{throw new AppError(502,"Shopify CLI did not return valid JSON. Upload success is unverified.");}
  }catch(error:any){
    if(error instanceof AppError)throw error;
    throw new AppError(502,`Shopify CLI failed: ${safeCliMessage(String(error.stdout||error.stderr||error.message),token)}`);
  }finally{await rm(home,{recursive:true,force:true});}
}
export async function cliThemes(shop:string){
  const result=await runThemeCli(shop,["list","--json"]);
  if(!Array.isArray(result.themes))throw new AppError(502,"Shopify CLI returned no theme list.");
  return result.themes.map((t:any)=>({...t,id:String(t.id)}));
}
export function parseCliTheme(raw:any,shop:string){
  if(!raw||!/^\d+$/.test(String(raw.id))||raw.role!=="unpublished")throw new AppError(502,"CLI did not return a new unpublished theme.");
  const returnedShop=raw.storeDomain??raw.shop;
  if(returnedShop&&returnedShop!==shop)throw new AppError(502,"CLI returned a theme for a different store.");
  const editorUrl=raw.editorUrl??raw.editor_url,previewUrl=raw.previewUrl??raw.preview_url;
  for(const value of [editorUrl,previewUrl]){
    if(typeof value!=="string")throw new AppError(502,"CLI did not return the editor and preview URLs.");
    const url=new URL(value);
    if(url.protocol!=="https:"||url.hostname!==shop)throw new AppError(502,"CLI returned an unexpected theme URL.");
  }
  return {id:String(raw.id),name:String(raw.name),role:raw.role,editorUrl,previewUrl};
}
async function writeDirectory(files:Record<string,string>,directory:string){
  for(const [name,body]of Object.entries(files)){
    await mkdir(path.dirname(path.join(directory,name)),{recursive:true,mode:0o700});
    await writeFile(path.join(directory,name),body,{mode:0o600});
  }
}
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function shopifyJson(text:string){
  // Shopify adds an autogenerated leading block-comment to template/settings
  // JSON during readback. Ignore that header, not strings or actual values.
  return JSON.parse(text.replace(/^\uFEFF/,"").replace(/^\s*\/\*[\s\S]*?\*\/\s*/,""));
}
export function sameThemeFile(filename:string,expected:string,actual:string){
  if(filename.endsWith(".json")){
    const left=shopifyJson(expected),right=shopifyJson(actual);
    if(filename.startsWith("templates/")){
      // Shopify omits empty block containers. They are equivalent to no blocks;
      // retain comparison of all non-empty blocks, their order and settings.
      for(const template of [left,right])for(const section of Object.values(template.sections??{}) as any[]){
        if(section.blocks&&Object.keys(section.blocks).length===0)delete section.blocks;
        if(Array.isArray(section.block_order)&&section.block_order.length===0)delete section.block_order;
      }
    }
    return JSON.stringify(canonical(left))===JSON.stringify(canonical(right));
  }
  return expected.replace(/^\uFEFF/,"").replaceAll("\r\n","\n")===actual.replace(/^\uFEFF/,"").replaceAll("\r\n","\n");
}
export async function verifyCliFiles(shop:string,themeId:string,files:Record<string,string>,directory:string){
  await mkdir(directory,{recursive:true,mode:0o700});
  await runThemeCli(shop,["pull","--theme",themeId,"--path",directory,"--json"]);
  for(const [filename,expected]of Object.entries(files)){
    let actual:string;
    try{actual=await readFile(path.join(directory,filename),"utf8");}catch{throw new AppError(502,`Shopify readback is missing ${filename}. Theme was not marked verified.`);}
    if(!sameThemeFile(filename,expected,actual))throw new AppError(502,`Shopify readback differs for ${filename}. Theme was not marked verified.`);
  }
}
function currentStore(expectedShop:string){
  const shop=shopifyConfig().shop;
  if(shop!==expectedShop)throw new AppError(409,"The selected store changed. Review the destination again.");
  cliCredential(shop);return shop;
}
export async function cliStatus(){
  const shop=shopifyConfig().shop;
  const configured=!!shop&&(()=>{try{cliCredential(shop);return true;}catch{return false;}})();
  const result={shop,configured,authenticated:false,livePublishingEnabled:process.env.SHOPIFY_CLI_ALLOW_LIVE_PUBLISH==="true",credentialKey:shop?cliSecretKey(shop):"",uploads:(await publications()).filter(p=>p.method==="theme-access-cli"&&p.shop===shop),
    currentLiveThemeId:undefined as string|undefined,message:undefined as string|undefined};
  if(configured){
    try{
      const list=await cliThemes(shop);result.authenticated=true;result.currentLiveThemeId=list.find((t:any)=>["live","main"].includes(t.role))?.id;
      // Native Shopify publishing is an external writer. Derive current role on
      // every status fetch so reloads/other browser sessions see the real state.
      result.uploads=result.uploads.map(p=>{
        const theme=list.find((t:any)=>t.id===p.themeId);
        return {...p,remoteRole:theme?.role??"missing",livePublished:!!theme&&["live","main"].includes(theme.role)};
      });
    }
    catch(error){result.message=error instanceof Error?error.message:"Theme Access authentication failed.";}
  }
  return result;
}
export function assertCliUploadEligibility(status:string,product:unknown,brand:unknown){
  // Selecting Publish is sufficient for an unpublished preview; separate
  // positive feedback is optional. Rejected/incomplete designs remain blocked.
  if(!product||!brand||status==="rejected")throw new AppError(409,"A non-rejected design with product and brand data is required.");
}
export async function uploadCliTheme(designId:string,expectedShop:string,options?:CliUploadInput){
  const shop=currentStore(expectedShop);
  const {design,content,run,category}=await getDesign(designId);
  assertCliUploadEligibility(design.status,run.product,run.brand);
  if(!run.product||!run.brand)throw new AppError(409,"Product and brand data are required.");
  const mode=options?.productMode??"none";
  // Validate a complete package before any product import or theme creation.
  standaloneTheme(compile(design,content,run.product,run.brand));
  const id=randomUUID(),base=await mkdtemp(path.join(tmpdir(),"wishluck-cli-theme-"));
  const p:Publication={id,designId,title:run.product.title,status:"uploading",createdAt:new Date().toISOString(),shop,method:"theme-access-cli",verified:false,livePublished:false,
    warnings:[]};
  await savePublication(p);
  try{
    const before=await cliThemes(shop);
    p.previousLiveThemeId=before.find((t:any)=>["live","main"].includes(t.role))?.id;
    const context=mode==="none"?null:await publishingContext(designId);
    if(context&&context.shop!==shop)throw new AppError(409,"The destination store changed.");
    const target=context?await preparePublicationProduct(admin,run.product,content,run.id,context,options!):null;
    const files=standaloneTheme(compile(design,target?.content??content,target?.product??run.product,run.brand));
    if(target){
      const settings=JSON.parse(files["config/settings_data.json"]);
      settings.current.preview_product=target.native.handle;
      files["config/settings_data.json"]=JSON.stringify(settings,null,2);
      Object.assign(p,{title:target.product.title,productId:target.native.id,productHandle:target.native.handle,productStatus:target.native.status,
        imported:target.imported,previousTemplateSuffix:target.native.templateSuffix??"",templateSuffix:`wl-${design.id.slice(0,8)}`,templateAssigned:false});
      p.adminUrl=`https://${shop}/admin/products/${target.native.id.split("/").pop()}`;
      if(target.native.status!=="ACTIVE")p.warnings!.push("This product remains a draft. Shopify may require authorized draft-preview access; cart acceptance cannot be proven for a draft. Activate products only through your own explicit Shopify action.");
      if(!options?.confirmTemplateAssignment)p.warnings!.push("Preview only: no global product template suffix or SEO fields were changed. The new theme uses this design as its default product template.");
      await savePublication(p);
    }else p.warnings!.push("Theme-only preview. Select a store product in the editor; no product was created or reassigned.");
    const directory=path.join(base,"theme");
    await writeDirectory(files,directory);
    const result=await runThemeCli(shop,["push","--unpublished","--nodelete","--theme",`Wishluck ${design.id.slice(0,8)} ${id.slice(0,6)}`,"--path",directory,"--strict","--json"]);
    const theme=parseCliTheme(result.theme,shop);
    if(before.some((t:any)=>t.id===theme.id))throw new AppError(502,"CLI did not create a separate theme. Upload is unverified.");
    p.themeId=theme.id;p.themeName=theme.name;p.previewUrl=theme.previewUrl;p.editorUrl=theme.editorUrl;
    await savePublication(p);
    await verifyCliFiles(shop,theme.id,files,path.join(base,"readback"));
    const after=await cliThemes(shop);
    if(before.some((t:any)=>!after.some((v:any)=>v.id===t.id&&v.role===t.role&&v.name===t.name)))throw new AppError(502,"Existing theme roles or names changed during upload. Review the store before proceeding.");
    if(target){
      const suffix=p.templateSuffix!;
      if(options?.confirmTemplateAssignment){
        const assigned=await admin("mutation($product:ProductUpdateInput!){productUpdate(product:$product){product{id templateSuffix} userErrors{field message}}}",
          {product:{id:target.native.id,templateSuffix:suffix,seo:{title:target.content.headline.slice(0,70),description:target.content.subheading.slice(0,160)}}});
        if(assigned.productUpdate.userErrors?.length)throw new AppError(422,assigned.productUpdate.userErrors.map((e:any)=>e.message).join("; "));
        const readback=await admin("query($id:ID!){product(id:$id){id templateSuffix}}",{id:target.native.id});
        if(readback.product?.templateSuffix!==suffix)throw new AppError(502,"Uploaded theme is intact, but product template assignment could not be verified.");
        p.templateAssigned=true;
      }
      const nativePreview=target.native.status==="DRAFT"?target.native.onlineStorePreviewUrl:null;
      p.previewUrl=nativePreview?`${nativePreview}${nativePreview.includes("?")?"&":"?"}preview_theme_id=${theme.id}`:`https://${shop}/products/${encodeURIComponent(target.native.handle)}?preview_theme_id=${theme.id}`;
      const path=nativePreview?new URL(nativePreview).pathname+new URL(nativePreview).search:`/products/${encodeURIComponent(target.native.handle)}`;
      p.editorUrl=`${theme.editorUrl}?template=product.${suffix}&previewPath=${encodeURIComponent(path)}`;
      if(design.status!=="published"){
        await db.insert(feedbackTable).values({id:randomUUID(),designId,category,action:"published",reason:"Verified CLI publication to a new unpublished Shopify theme."});
        design.status="published";await saveDesign(design,content,category);
      }
    }
    p.verified=true;p.status="published";p.remoteRole="unpublished";p.checkedAt=new Date().toISOString();
  }catch(error){p.status="failed";p.error=error instanceof Error?error.message:"CLI upload failed";}
  finally{await rm(base,{recursive:true,force:true});}
  await savePublication(p);
  return p;
}
export async function checkCliPublication(publicationId:string,expectedShop:string){
  const shop=currentStore(expectedShop),p=(await publications()).find(p=>p.id===publicationId);
  if(!p||p.method!=="theme-access-cli"||p.shop!==shop||!p.themeId)throw new AppError(404,"No CLI publication for this store was found.");
  const target=(await cliThemes(shop)).find((t:any)=>t.id===p.themeId);
  if(!target)throw new AppError(404,"The theme is no longer in Shopify. No automatic re-upload or live replacement was attempted.");
  p.remoteRole=target.role;p.livePublished=["main","live"].includes(target.role);p.checkedAt=new Date().toISOString();
  if(p.productId&&p.templateAssigned){
    const result=await admin("query($id:ID!){product(id:$id){id status templateSuffix}}",{id:p.productId});
    p.productStatus=result.product?.status;
    if(!result.product||result.product.templateSuffix!==p.templateSuffix)throw new AppError(409,"The product/template assignment changed in Shopify. Review it in the editor before continuing.");
  }
  await savePublication(p);return p;
}
export function assertLiveConfirmation(input:{confirmReplaceLiveTheme:boolean;expectedShop:string;themeId:string},p:Publication,shop:string){
  if(!input.confirmReplaceLiveTheme||input.expectedShop!==shop||p.shop!==shop||input.themeId!==p.themeId)throw new AppError(400,"Explicit confirmation for this exact store and theme is required to replace the live storefront.");
  if(p.method!=="theme-access-cli"||p.status!=="published"||!p.verified||!p.themeId)throw new AppError(409,"Only a verified CLI upload can be made live.");
}
export async function activateCliTheme(publicationId:string,input:{confirmReplaceLiveTheme:boolean;expectedShop:string;themeId:string;expectedLiveThemeId:string}){
  if(process.env.SHOPIFY_CLI_ALLOW_LIVE_PUBLISH!=="true")throw new AppError(403,"Live-theme activation is disabled server-side. The store owner must explicitly enable live publishing before confirming a replacement.");
  const shop=currentStore(input.expectedShop);
  const p=(await publications()).find(p=>p.id===publicationId);
  if(!p)throw new AppError(404,"CLI upload not found.");
  assertLiveConfirmation(input,p,shop);
  const {design,content,run}=await getDesign(p.designId);
  if(!["approved","published"].includes(design.status))throw new AppError(409,"Approve the design before making its theme live.");
  const before=await cliThemes(shop),target=before.find((t:any)=>t.id===p.themeId);
  if(target?.role!=="unpublished")throw new AppError(409,"The target is no longer an unpublished theme. Review the store again.");
  const live=before.find((t:any)=>["live","main"].includes(t.role));
  if(live?.id!==input.expectedLiveThemeId)throw new AppError(409,"The live theme changed. Refresh the destination and confirm again.");
  const base=await mkdtemp(path.join(tmpdir(),"wishluck-cli-theme-"));
  try{
    if(!run.product||!run.brand)throw new AppError(409,"Missing theme source data.");
    const directory=path.join(base,"theme");
    await writeDirectory(standaloneTheme(compile(design,content,run.product,run.brand)),directory);
    const settingsDirectory=path.join(base,"settings");
    await mkdir(settingsDirectory,{recursive:true,mode:0o700});
    await runThemeCli(shop,["pull","--theme",p.themeId!,"--path",settingsDirectory,"--only","config/settings_data.json","--json"]);
    const settings=shopifyJson(await readFile(path.join(settingsDirectory,"config/settings_data.json"),"utf8"));
    if(!settings.current?.preview_product)throw new AppError(409,"Select the matching homepage product in the Shopify theme editor before making this theme live. The live theme was not changed.");
    // --force only suppresses the CLI prompt AFTER the server confirmation,
    // exact store/theme match, design approval and live-theme race checks.
    await runThemeCli(shop,["publish","--theme",p.themeId!,"--force","--path",directory],false);
    const after=await cliThemes(shop);
    if(!after.some((t:any)=>t.id===p.themeId&&["live","main"].includes(t.role)))throw new AppError(502,"CLI returned, but the new live theme could not be verified.");
    p.livePublished=true;p.previousLiveThemeId=live?.id;await savePublication(p);return p;
  }finally{await rm(base,{recursive:true,force:true});}
}
