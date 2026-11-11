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
const exec=promisify(execFile);

export async function audit(id:string){
  const {design,content,category,run}=await getDesign(id);
  const pub=(await publications()).find(p=>p.designId===id&&p.status==="published"&&p.previewUrl);
  if(!pub?.previewUrl)throw new AppError(409,"Publish to your development store first. Lighthouse must audit a real Shopify storefront, not a local HTML approximation.");
  await publicUrl(pub.previewUrl);
  const dir=await mkdtemp(path.join(tmpdir(),"wishluck-audit-"));
  try{
    const require=createRequire(import.meta.url);
    const cli=path.join(path.dirname(require.resolve("lighthouse/package.json")),"cli/index.js");
    const output=path.join(dir,"report");
    await exec(process.execPath,[cli,pub.previewUrl,"--chrome-path="+(process.env.CHROMIUM_PATH||"/repl/tools/bin/chromium"),"--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage","--only-categories=performance,seo,accessibility","--output=json","--output=html",`--output-path=${output}`,"--quiet"],{timeout:180000,maxBuffer:1000000});
    const data=JSON.parse(await readFile(`${output}.report.json`,"utf8"));
    if(data.runtimeError||/\/password|\/account\/login/.test(data.finalDisplayedUrl||data.finalUrl||""))throw new Error("Lighthouse did not reach the product page. Store password protection must be handled through authorised preview access.");
    const reportUrl=await saveArtifact(run.id,pub.previewUrl,await readFile(`${output}.report.html`),"text/html");
    const performance=Math.round((data.categories.performance.score??0)*100),seo=Math.round((data.categories.seo.score??0)*100),accessibility=Math.round((data.categories.accessibility.score??0)*100);
    design.lighthouse={status:"completed",performance,seo,accessibility,url:reportUrl,testedAt:new Date().toISOString()};
    const item=design.checks.find(c=>c.key==="lighthouse");
    if(item){item.status=performance>=85&&seo>=95&&accessibility>=90?"passed":"failed";item.detail=`Real mobile Lighthouse: performance ${performance}, SEO ${seo}, accessibility ${accessibility}. Report: ${reportUrl}`;}
  }catch(e){design.lighthouse={status:"failed",error:e instanceof Error?e.message:"Lighthouse failed",testedAt:new Date().toISOString()};}
  finally{await rm(dir,{recursive:true,force:true});}
  await saveDesign(design,content,category);
  return design;
}
