import { saveArtifact } from "./assets";
import { publicUrl } from "./network";
import { getDesign, getPublication, publications, saveDesign } from "./store";
import { AppError } from "./domain";
import {withRunLock} from "./jobs";
import {createJob,getJob,saveJob,startDurableJob} from "./durable-jobs";
import {contentHash,type DurableJob} from "./job-recovery";
import {shopifyConfig} from "./shopify-auth";
import {storefrontAccess,storefrontPasswordKey} from "./storefront-access";
import {storefrontLighthouse} from "./storefront-lighthouse";

export async function queueAudit(id:string,publicationId?:string){
  return withRunLock((await getDesign(id)).run.id,async()=>{
    const {design,content,category,run}=await getDesign(id);
    const previous=design.lighthouse?.jobId?await getJob(design.lighthouse.jobId):undefined;
    if(previous&&["queued","running"].includes(previous.status))return design;
    const pub=publicationId?await getPublication(publicationId):(await publications()).find(p=>p.designId===id&&p.shop===shopifyConfig().shop&&p.status==="published"&&p.previewUrl);
    if(!pub?.previewUrl||pub.designId!==id||pub.status!=="published"||pub.shop!==shopifyConfig().shop)throw new AppError(409,"A published preview in the selected store is required.");
    const hash=contentHash({publicationId:pub.id,themeId:pub.themeId,designId:id});
    const {job}=await createJob({kind:"lighthouse",designId:id,runId:run.id,shop:pub.shop,publicationId:pub.id,
      themeId:pub.themeId,contentHash:hash,identity:`lighthouse:${pub.shop}:${id}:${pub.id}:${previous?.id??"first"}`});
    design.lighthouse={status:"running",jobId:job.id,testedAt:new Date().toISOString()};
    await saveDesign(design,content,category);
    startDurableJob(job.id,async active=>{
      try{
        await withRunLock(run.id,async()=>{
          if(shopifyConfig().shop!==active.shop)throw new AppError(409,"The selected store changed before Lighthouse started.");
          active.phase="auditing";await saveJob(active);
          const result=await audit(id,pub.id,active.id);
          active.status=result.lighthouse?.status==="completed"?"completed":"failed";
          active.phase=active.status;active.error=result.lighthouse?.error;await saveJob(active);
        });
      }catch{await recoverAudit(active);}
    });
    return design;
  });
}
export async function recoverAudit(job:DurableJob){
  const saved=await getDesign(job.designId).catch(()=>null);
  if(saved?.design.lighthouse?.jobId===job.id&&saved.design.lighthouse.status==="completed"){
    job.status="completed";job.phase="completed";await saveJob(job);return;
  }
  job.status="attention";job.error="Lighthouse was interrupted. Run the audit again; no scores were recorded for this attempt.";
  if(saved&&saved.design.lighthouse?.jobId===job.id){
    saved.design.lighthouse={status:"failed",jobId:job.id,error:job.error,testedAt:new Date().toISOString()};
    await saveDesign(saved.design,saved.content,saved.category);
  }
  await saveJob(job);
}
export async function audit(id:string,publicationId?:string,jobId?:string){
  const {design,content,category,run}=await getDesign(id);
  const pub=publicationId?await getPublication(publicationId):(await publications()).find(p=>p.designId===id&&p.shop===shopifyConfig().shop&&p.status==="published"&&p.previewUrl);
  if(!pub?.previewUrl||pub.designId!==id||pub.status!=="published"||pub.shop!==shopifyConfig().shop)throw new AppError(409,"Publish to your selected development store first. Lighthouse must audit a real Shopify storefront, not a local HTML approximation.");
  try{
    if(pub.method==="theme-access-cli"&&!pub.productId)throw new Error("Select a store product before running storefront quality checks. A theme-only setup page is not a product-page audit.");
    await publicUrl(pub.previewUrl);
    const access=await storefrontAccess(pub.shop!,pub.previewUrl);
    const response=await access.request(pub.previewUrl);
    const html=await response.text();
    if(!response.ok||/\/password|\/account\/login/.test(new URL(response.url).pathname)||!/<form\b[^>]*action=["'][^"']*\/cart\/add/i.test(html)){
      throw new Error(`Storefront product access is blocked or the product form is missing. Verify ${storefrontPasswordKey(pub.shop!)} or authorized draft-preview access. A password or setup page was not scored.`);
    }
    const {data,html:report}=await storefrontLighthouse(pub.previewUrl,access);
    if(data.runtimeError||/\/password|\/account\/login/.test(data.finalDisplayedUrl||data.finalUrl||""))throw new Error("Lighthouse did not reach the product page. Store password protection must be handled through authorised preview access.");
    if(["performance","seo","accessibility"].some(key=>!Number.isFinite(data.categories?.[key]?.score)))throw new Error("Lighthouse returned incomplete scores. No scores were recorded.");
    const reportUrl=await saveArtifact(run.id,pub.previewUrl,report,"text/html");
    const performance=Math.round((data.categories.performance.score??0)*100),seo=Math.round((data.categories.seo.score??0)*100),accessibility=Math.round((data.categories.accessibility.score??0)*100);
    design.lighthouse={status:"completed",jobId,performance,seo,accessibility,url:reportUrl,testedAt:new Date().toISOString()};
    const item=design.checks.find(c=>c.key==="lighthouse");
    if(item){item.status=performance>=85&&seo>=95&&accessibility>=90?"passed":"failed";item.detail=`Real mobile Lighthouse: performance ${performance}, SEO ${seo}, accessibility ${accessibility}. Report: ${reportUrl}`;}
  }catch(e){
    let message=e instanceof Error?e.message:"Lighthouse failed";
    message=message.replace(/https?:\/\/\S+/g,"[preview URL]").replace(/preview_key[=:][^&\s]+/gi,"preview_key=[REDACTED]");
    design.lighthouse={status:"failed",jobId,error:message,testedAt:new Date().toISOString()};
    const item=design.checks.find(c=>c.key==="lighthouse");
    if(item){item.status="unverified";item.detail=message;}
  }
  await saveDesign(design,content,category);
  return design;
}
