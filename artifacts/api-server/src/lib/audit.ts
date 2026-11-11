import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { saveArtifact } from "./assets";
import { publicUrl } from "./network";
import { getDesign, publications, saveDesign } from "./store";
import { AppError } from "./domain";
import {enqueue} from "./jobs";
const exec=promisify(execFile);

export async function queueAudit(id:string,publicationId?:string){
  const {design,content,category,run}=await getDesign(id);
  let release!:()=>void,cancelled=false;
  const ready=new Promise<void>(resolve=>{release=resolve;});
  // Reserve the run before persisting running state, but don't start the audit
  // until that state is durable. A second job cannot strand another design.
  enqueue(run.id,async()=>{await ready;return cancelled?undefined:audit(id,publicationId);});
  try{design.lighthouse={status:"running",testedAt:new Date().toISOString()};await saveDesign(design,content,category);return design;}
  catch(error){cancelled=true;throw error;}
  finally{release();}
}
export async function audit(id:string,publicationId?:string){
  const {design,content,category,run}=await getDesign(id);
  const pub=(await publications()).find(p=>p.designId===id&&(!publicationId||p.id===publicationId)&&p.status==="published"&&p.previewUrl);
  if(!pub?.previewUrl)throw new AppError(409,"Publish to your development store first. Lighthouse must audit a real Shopify storefront, not a local HTML approximation.");
  const dir=await mkdtemp(path.join(tmpdir(),"wishluck-audit-"));
  try{
    if(pub.method==="theme-access-cli"&&!pub.productId)throw new Error("Select a store product before running storefront quality checks. A theme-only setup page is not a product-page audit.");
    await publicUrl(pub.previewUrl);
    const response=await fetch(pub.previewUrl,{signal:AbortSignal.timeout(20000)});
    const html=await response.text();
    if(!response.ok||/\/password|\/account\/login/.test(new URL(response.url).pathname)||!/<form\b[^>]*action=["'][^"']*\/cart\/add/i.test(html)){
      throw new Error("Storefront product access is blocked or the product form is missing. Authorised storefront/draft preview access is required; a password or setup page was not scored.");
    }
    const require=createRequire(import.meta.url);
    const cli=path.join(path.dirname(require.resolve("lighthouse/package.json")),"cli/index.js");
    const output=path.join(dir,"report");
    await exec(process.execPath,[cli,pub.previewUrl,"--chrome-path="+(process.env.CHROMIUM_PATH||"/repl/tools/bin/chromium"),"--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage","--only-categories=performance,seo,accessibility","--output=json","--output=html",`--output-path=${output}`,"--quiet"],{timeout:180000,maxBuffer:1000000});
    const data=JSON.parse(await readFile(`${output}.report.json`,"utf8"));
    if(data.runtimeError||/\/password|\/account\/login/.test(data.finalDisplayedUrl||data.finalUrl||""))throw new Error("Lighthouse did not reach the product page. Store password protection must be handled through authorised preview access.");
    if(["performance","seo","accessibility"].some(key=>!Number.isFinite(data.categories?.[key]?.score)))throw new Error("Lighthouse returned incomplete scores. No scores were recorded.");
    const reportUrl=await saveArtifact(run.id,pub.previewUrl,await readFile(`${output}.report.html`),"text/html");
    const performance=Math.round((data.categories.performance.score??0)*100),seo=Math.round((data.categories.seo.score??0)*100),accessibility=Math.round((data.categories.accessibility.score??0)*100);
    design.lighthouse={status:"completed",performance,seo,accessibility,url:reportUrl,testedAt:new Date().toISOString()};
    const item=design.checks.find(c=>c.key==="lighthouse");
    if(item){item.status=performance>=85&&seo>=95&&accessibility>=90?"passed":"failed";item.detail=`Real mobile Lighthouse: performance ${performance}, SEO ${seo}, accessibility ${accessibility}. Report: ${reportUrl}`;}
  }catch(e){
    let message=e instanceof Error?e.message:"Lighthouse failed";
    message=message.replace(/https?:\/\/\S+/g,"[preview URL]").replace(/preview_key[=:][^&\s]+/gi,"preview_key=[REDACTED]");
    design.lighthouse={status:"failed",error:message,testedAt:new Date().toISOString()};
    const item=design.checks.find(c=>c.key==="lighthouse");
    if(item){item.status="unverified";item.detail=message;}
  }
  finally{await rm(dir,{recursive:true,force:true});}
  await saveDesign(design,content,category);
  return design;
}
