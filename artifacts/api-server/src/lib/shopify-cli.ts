import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {createRequire} from "node:module";
import {mkdir,mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {randomUUID,createHash} from "node:crypto";
import {AppError,type Publication} from "./domain";
import {compile} from "./compiler";
import {standaloneTheme} from "./theme-package";
import {getDesign,getPublication,savePublication,publications,saveDesign} from "./store";
import {shopifyConfig} from "./shopify-auth";
import {admin,publishingContext} from "./shopify";
import {preparePublicationProduct} from "./publication-product";
import type {CliUploadInput} from "@workspace/api-zod";
import {db,feedbackTable} from "@workspace/db";
import {createJob,durableJobs,saveJob,startDurableJob,withJobLock,getJob} from "./durable-jobs";
import {contentHash,type DurableJob,reportInterruptedUpload} from "./job-recovery";
import {withRunLock} from "./jobs";
import {withStoreLock} from "./shopify-selection";
import {queueAudit} from "./audit";
import {recordPublicationState} from "./publication-status";

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
export function themeFileHash(filename:string,text:string){
  let value=text.replace(/^\uFEFF/,"").replaceAll("\r\n","\n");
  if(filename.endsWith(".json")){
    const parsed=shopifyJson(text);
    if(filename.startsWith("templates/"))for(const section of Object.values(parsed.sections??{}) as any[]){
      if(section.blocks&&Object.keys(section.blocks).length===0)delete section.blocks;
      if(Array.isArray(section.block_order)&&!section.block_order.length)delete section.block_order;
    }
    value=JSON.stringify(canonical(parsed));
  }
  return createHash("sha256").update(value).digest("hex");
}
export async function verifyCliFiles(shop:string,themeId:string,files:Record<string,string>,directory:string):Promise<Record<string,string>|void>{
  const hashes:Record<string,string>={};
  await mkdir(directory,{recursive:true,mode:0o700});
  await runThemeCli(shop,["pull","--theme",themeId,"--path",directory,"--json"]);
  for(const [filename,expected]of Object.entries(files)){
    let actual:string;
    try{actual=await readFile(path.join(directory,filename),"utf8");}catch{throw new AppError(502,`Shopify readback is missing ${filename}. Theme was not marked verified.`);}
    if(!sameThemeFile(filename,expected,actual))throw new AppError(502,`Shopify readback differs for ${filename}. Theme was not marked verified.`);
    hashes[filename]=themeFileHash(filename,actual);
  }
  return hashes;
}
function currentStore(expectedShop:string){
  const shop=shopifyConfig().shop;
  if(shop!==expectedShop)throw new AppError(409,"The selected store changed. Review the destination again.");
  cliCredential(shop);return shop;
}
export async function cliStatus(){
  const shop=shopifyConfig().shop;
  const storePublications=(await publications()).filter(p=>p.shop===shop);
  const configured=!!shop&&(()=>{try{cliCredential(shop);return true;}catch{return false;}})();
  const result={shop,configured,authenticated:false,livePublishingEnabled:process.env.SHOPIFY_CLI_ALLOW_LIVE_PUBLISH==="true",credentialKey:shop?cliSecretKey(shop):"",uploads:storePublications.filter(p=>p.method==="theme-access-cli"),
    jobs:(await durableJobs()).filter(j=>j.shop===shop),
    currentLiveThemeId:undefined as string|undefined,message:undefined as string|undefined};
  if(configured){
    try{
      const list=await cliThemes(shop);result.authenticated=true;result.currentLiveThemeId=list.find((t:any)=>["live","main"].includes(t.role))?.id;
      // Native Shopify publishing is an external writer. Derive current role on
      // every status fetch so reloads/other browser sessions see the real state.
      for(const p of storePublications){
        const theme=list.find((t:any)=>t.id===p.themeId?.split("/").at(-1));
        if(!p.themeId||p.status==="uploading")continue;
        const latest=await getPublication(p.id);if(latest)Object.assign(p,latest);
        p.remoteRole=theme?.role??"missing";p.livePublished=!!theme&&["live","main"].includes(theme.role);
        p.checkedAt=new Date().toISOString();recordPublicationState(p);
        await savePublication(p);
      }
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
async function readAssignment(shop:string,productId:string):Promise<string|null>{
  if(shopifyConfig().shop!==shop)throw new AppError(409,"Select the saved store before checking its product assignment.");
  const result=await admin("query($id:ID!){product(id:$id){id templateSuffix}}",{id:productId});
  return result.product?.templateSuffix??null;
}
const uploadServices={currentStore,getDesign,cliThemes,runThemeCli,verifyCliFiles,readAssignment};
export type UploadServices=typeof uploadServices;
export async function uploadCliTheme(designId:string,expectedShop:string,options?:CliUploadInput,services:UploadServices=uploadServices){
  const shop=services.currentStore(expectedShop);
  const {design,content,run}=await services.getDesign(designId);
  assertCliUploadEligibility(design.status,run.product,run.brand);
  if(!run.product||!run.brand)throw new AppError(409,"Product and brand data are required.");
  const mode=options?.productMode??"none";
  // A design is a single uploadable version. Different destination options
  // must not bypass idempotency and create multiple themes for that version.
  const prior=(await durableJobs()).find(j=>j.kind==="upload"&&j.designId===designId);
  const previous=(await publications()).find(p=>p.designId===designId&&(p.verified||p.status==="published"));
  if(previous){
    if(previous.shop!==shop)throw new AppError(409,"This design was already uploaded to another store. Regenerate it to create a new uploadable version.");
    return previous;
  }
  if(prior&&prior.shop!==shop)throw new AppError(409,"This design already has a saved upload in another store. Review it before creating a new design version.");
  if(!prior&&["uploaded","edited","published"].includes(design.status))throw new AppError(409,"This design has already been uploaded. Open its editor or regenerate a new version; it cannot be uploaded again.");
  // Validate a complete package before any product import or theme creation.
  const sourceHash=contentHash(standaloneTheme(compile(design,content,run.product,run.brand)));
  const hash=contentHash({sourceHash,mode,productId:options?.productId??"",assign:!!options?.confirmTemplateAssignment,
    importRights:!!options?.confirmProductImport,currency:!!options?.confirmCurrencyMismatch});
  const {job,created}=prior?{job:prior,created:false}:await createJob({kind:"upload",designId,runId:run.id,shop,contentHash:hash,sourceHash,title:run.product.title,
    identity:`upload:${designId}`});
  const existing=await getPublication(job.id);
  if(!created){
    // Includes interrupted/uncertain attempts: never turn a retry into a push.
    if(job.status==="attention"||!existing)await withJobLock(job.id,async()=>{
      const latest=await getJob(job.id);
      if(latest&&(latest.status==="attention"||(!existing&&!["queued","running"].includes(latest.status))))await recoverCliUpload(latest,undefined,services);
    });
    const saved=await getPublication(job.id);
    return saved??existing??{id:job.id,jobId:job.id,jobPhase:job.phase,designId,title:run.product.title,
      status:job.status==="queued"||job.status==="running"?"uploading":"failed",createdAt:job.createdAt,shop,
      method:"theme-access-cli",error:job.error};
  }
  const id=job.id;
  const p:Publication={id,designId,title:run.product.title,status:"uploading",createdAt:new Date().toISOString(),shop,method:"theme-access-cli",verified:false,livePublished:false,
    jobId:id,jobPhase:"queued",warnings:[]};
  await savePublication(p);
  startDurableJob(id,async activeJob=>{
    try{
      await withRunLock(run.id,()=>withStoreLock(async()=>{
        await executeCliUpload(p,activeJob,options,services);
      }));
    }catch{
      activeJob.status="attention";activeJob.error="Upload stopped. Review the saved theme and job; no automatic upload retry was attempted.";
      p.status="failed";p.error=activeJob.error;recordPublicationState(p);await savePublication(p);
      await saveJob(activeJob);
    }
    if(p.status==="published"&&p.productId){
      try{await queueAudit(p.designId,p.id);}
      catch{p.warnings??=[];p.warnings.push("Upload verified; automatic Lighthouse could not be queued. Use Run audit to retry.");await savePublication(p);}
    }
  });
  return p;
}
async function executeCliUpload(p:Publication,job:DurableJob,options?:CliUploadInput,services:UploadServices=uploadServices){
  const shop=services.currentStore(job.shop),designId=p.designId;
  const {design,content,run,category}=await services.getDesign(designId);
  if(!run.product||!run.brand)throw new AppError(409,"Missing saved product or brand.");
  const mode=options?.productMode??"none";
  const base=await mkdtemp(path.join(tmpdir(),"wishluck-cli-theme-"));
  const phase=async(value:string)=>{
    job.phase=value;p.jobPhase=value;
    job.themeId=p.themeId;job.templateAssigned=p.templateAssigned;
    await savePublication(p);await saveJob(job);
  };
  try{
    if(contentHash(standaloneTheme(compile(design,content,run.product,run.brand)))!==job.sourceHash)throw new AppError(409,"Design content changed before upload started. No theme was created.");
    await phase("preparing");
    const before=await services.cliThemes(shop);
    job.beforeThemeIds=before.map((t:any)=>t.id);
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
    // Full UUID is persisted before the non-idempotent command. In the uncertain
    // create window recovery can list this exact name but must never push again.
    job.themeName=`Wishluck ${job.id}`;job.publicationId=p.id;
    job.contentHash=contentHash(files);
    await phase("creating");
    const result=await services.runThemeCli(shop,["push","--unpublished","--nodelete","--theme",job.themeName,"--path",directory,"--strict","--json"]);
    const theme=parseCliTheme(result.theme,shop);
    if(before.some((t:any)=>t.id===theme.id))throw new AppError(502,"CLI did not create a separate theme. Upload is unverified.");
    p.themeId=theme.id;p.themeName=theme.name;p.previewUrl=theme.previewUrl;p.editorUrl=theme.editorUrl;
    await phase("verifying");
    const hashes=await services.verifyCliFiles(shop,theme.id,files,path.join(base,"readback"));
    if(hashes)p.fileHashes=hashes;
    const after=await services.cliThemes(shop);
    if(before.some((t:any)=>!after.some((v:any)=>v.id===t.id&&v.role===t.role&&v.name===t.name)))throw new AppError(502,"Existing theme roles or names changed during upload. Review the store before proceeding.");
    if(target){
      const suffix=p.templateSuffix!;
      if(options?.confirmTemplateAssignment){
        await phase("assigning");
        const assigned=await admin("mutation($product:ProductUpdateInput!){productUpdate(product:$product){product{id templateSuffix} userErrors{field message}}}",
          {product:{id:target.native.id,templateSuffix:suffix,seo:{title:target.content.headline.slice(0,70),description:target.content.subheading.slice(0,160)}}});
        if(assigned.productUpdate.userErrors?.length)throw new AppError(422,assigned.productUpdate.userErrors.map((e:any)=>e.message).join("; "));
        const readback=await admin("query($id:ID!){product(id:$id){id templateSuffix}}",{id:target.native.id});
        if(readback.product?.templateSuffix!==suffix)throw new AppError(502,"Uploaded theme is intact, but product template assignment could not be verified.");
        p.templateAssigned=true;
        await phase("assigned");
      }
      const nativePreview=target.native.status==="DRAFT"?target.native.onlineStorePreviewUrl:null;
      p.previewUrl=nativePreview?`${nativePreview}${nativePreview.includes("?")?"&":"?"}preview_theme_id=${theme.id}`:`https://${shop}/products/${encodeURIComponent(target.native.handle)}?preview_theme_id=${theme.id}`;
      const path=nativePreview?new URL(nativePreview).pathname+new URL(nativePreview).search:`/products/${encodeURIComponent(target.native.handle)}`;
      p.editorUrl=`${theme.editorUrl}?template=product.${suffix}&previewPath=${encodeURIComponent(path)}`;
      if(design.status!=="published"){
        await db.insert(feedbackTable).values({id:randomUUID(),designId,category,action:"published",reason:"Verified CLI publication to a new unpublished Shopify theme."});
        design.status="uploaded";await saveDesign(design,content,category);
      }
    }
    p.verified=true;p.status="published";p.remoteRole="unpublished";p.checkedAt=new Date().toISOString();
    p.uploadedAt=p.checkedAt;recordPublicationState(p);
    p.jobPhase="completed";job.phase="completed";job.status="completed";
  }catch(error){
    p.status="failed";p.error=error instanceof AppError?error.message:"CLI upload stopped. Review the saved job before continuing.";
    recordPublicationState(p);
    job.status="attention";job.error=p.error;
    // Even a CLI timeout can have created the theme. Reconcile read-only.
    if(job.phase==="creating")await recoverCliUpload(job,p,services,false);
  }
  finally{await rm(base,{recursive:true,force:true});}
  await savePublication(p);
  await saveJob(job);
}
export async function recoverCliUpload(job:DurableJob,publication?:Publication,services:UploadServices=uploadServices,persist=true){
  const p=publication??await getPublication(job.id)??{
    id:job.id,jobId:job.id,jobPhase:job.phase,designId:job.designId,title:job.title??"Recovered upload",
    shop:job.shop,method:"theme-access-cli",status:"failed",createdAt:job.createdAt};
  // Publication completion is persisted before the final job checkpoint.
  if(p.status==="published"&&p.verified){
    job.status="completed";job.phase="completed";job.themeId=p.themeId;job.templateAssigned=p.templateAssigned;
    await saveJob(job);return;
  }
  job.themeId??=p.themeId;
  try{
    const {theme,message}=await reportInterruptedUpload(job,()=>services.cliThemes(job.shop));
    job.error=message;
    if(theme){
      job.themeId=theme.id;
      if(p){
        p.themeId=theme.id;p.themeName=theme.name;p.remoteRole=theme.role;
        p.livePublished=["main","live"].includes(theme.role);
        p.editorUrl??=`https://${job.shop}/admin/themes/${theme.id}/editor`;
        p.previewUrl??=`https://${job.shop}/?preview_theme_id=${theme.id}`;
      }
    }
    // Assignment may have succeeded just before the process stopped. Read its
    // outcome, never replay productUpdate over a merchant's subsequent edits.
    if(p?.productId&&["assigning","assigned","completed"].includes(job.phase)){
      const suffix=await services.readAssignment(job.shop,p.productId);
      p.templateAssigned=suffix===p.templateSuffix;
      job.templateAssigned=p.templateAssigned;
    }
  }catch{job.error="Interrupted upload could not be reconciled with Shopify. Check the saved store and theme; no upload was retried.";}
  job.status="attention";
  p.status="failed";p.error=job.error;p.jobPhase=job.phase;
  if(persist){await savePublication(p);await saveJob(job);}
}
export async function checkCliPublication(publicationId:string,expectedShop:string){
  const shop=currentStore(expectedShop),p=(await publications()).find(p=>p.id===publicationId);
  if(!p||p.method!=="theme-access-cli"||p.shop!==shop||!p.themeId)throw new AppError(404,"No CLI publication for this store was found.");
  const target=(await cliThemes(shop)).find((t:any)=>t.id===p.themeId);
  if(!target){
    p.remoteRole="missing";p.livePublished=false;p.checkedAt=new Date().toISOString();
    recordPublicationState(p);await savePublication(p);return p;
  }
  p.remoteRole=target.role;p.livePublished=["main","live"].includes(target.role);p.checkedAt=new Date().toISOString();
  // Read-only comparison: an editor visit alone is NOT evidence of an edit.
  const base=await mkdtemp(path.join(tmpdir(),"wishluck-edit-check-"));
  try{
    const {design,content,run}=await getDesign(p.designId);
    if(run.product&&run.brand){
      const expected=Object.keys(p.fileHashes??standaloneTheme(compile(design,content,run.product,run.brand)));
      await runThemeCli(shop,["pull","--theme",p.themeId,"--path",base,"--json"]);
      const hashes:Record<string,string>={};
      for(const name of expected){
        try{hashes[name]=themeFileHash(name,await readFile(path.join(base,name),"utf8"));}
        catch{hashes[name]="missing";}
      }
      if(p.fileHashes)p.edited=Object.entries(p.fileHashes).some(([name,hash])=>hashes[name]!==hash);
      else{
        p.fileHashes=hashes;
        p.warnings??=[];const note="Edit tracking started on this check; earlier Shopify edits cannot be inferred.";
        if(!p.warnings.includes(note))p.warnings.push(note);
      }
    }
  }finally{await rm(base,{recursive:true,force:true});}
  recordPublicationState(p);
  await savePublication(p);
  if(p.productId&&p.templateAssigned){
    const result=await admin("query($id:ID!){product(id:$id){id status templateSuffix}}",{id:p.productId});
    p.productStatus=result.product?.status;
    if(!result.product||result.product.templateSuffix!==p.templateSuffix)throw new AppError(409,"The product/template assignment changed in Shopify. Review it in the editor before continuing.");
  }
  await savePublication(p);return p;
}
const lifecycleRefreshes=new Map<string,Promise<void>>();
export async function refreshPublicationRoles(){
  const shop=shopifyConfig().shop??"";
  let pending=lifecycleRefreshes.get(shop);
  if(!pending){
    pending=cliStatus().then(status=>{
      if(status.configured&&!status.authenticated)throw new AppError(503,"Shopify status could not be refreshed. Retry to verify publication counts.");
    }).finally(()=>{lifecycleRefreshes.delete(shop);});
    lifecycleRefreshes.set(shop,pending);
  }
  await pending;
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
