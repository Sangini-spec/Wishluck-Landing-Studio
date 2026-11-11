import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, feedbackTable, artifactsTable } from "@workspace/db";
import {
  CreateRunBody,GetRunParams,UpdateBrandBody,UpdateProductBody,SubmitFeedbackBody,PublishDesignBody,
  GetRunResponse,GetDashboardResponse,ListRunsResponse,GetSettingsResponse,GetMemoryResponse,GetShopifyStatusResponse,ListThemesResponse,PublishDesignResponse,
} from "@workspace/api-zod";
import { getRun,listRuns,saveRun,getDesign,saveDesign,categoryContext,publications,event } from "../lib/store";
import { analyseProduct } from "../lib/analysis";
import { research } from "../lib/research";
import { searchReady,searchProvider } from "../lib/search";
import { generate,generateOne } from "../lib/generation";
import { publicUrl } from "../lib/network";
import { enqueue,isActive,withRunLock } from "../lib/jobs";
import { AppError,type Run } from "../lib/domain";
import { aiReady } from "../lib/ai";
import { shopifyStatus,connectShopify,themes,publish,admin,publishingContext,verifiedShopifyStatus,switchShopifyStore } from "../lib/shopify";
import {deleteRuns,deleteMemory,deletePublications} from "../lib/deletion";
import {savedStores,withStoreLock} from "../lib/shopify-selection";
import {SwitchShopifyStoreBody} from "@workspace/api-zod";
import {GetCliPublishingStatusResponse,UploadCliThemeBody,ActivateCliThemeBody} from "@workspace/api-zod";
import {cliStatus,uploadCliTheme,activateCliTheme} from "../lib/shopify-cli";
import { preview } from "../lib/preview";
import { compile,zipDesign } from "../lib/compiler";
import { objectStorageClient } from "../lib/objectStorage";
import { audit } from "../lib/audit";
import { missingFacts } from "../lib/facts";

const router:IRouter=Router();
const idParam=(raw:unknown)=>GetRunParams.parse({id:raw}).id;
router.get("/dashboard",async(_req,res)=>{
  const [runs,pubs]=await Promise.all([listRuns(),publications()]);
  const memories=await Promise.all([...new Set(runs.flatMap(r=>r.product?[r.product.category]:[]))].map(categoryContext));
  res.json(GetDashboardResponse.parse({totalRuns:runs.length,totalDesigns:runs.reduce((n,r)=>n+r.designs.length,0),publishedCount:pubs.filter(p=>p.status==="published").length,
    categories:memories.filter(c=>c.designs.length||c.learnings.length).length,recentRuns:runs.slice(0,5),publications:pubs}));
});
router.get("/runs",async(_req,res)=>{res.json(ListRunsResponse.parse(await listRuns()));});
router.delete("/runs/:id",async(req,res)=>res.json(await deleteRuns(idParam(req.params.id))));
router.delete("/history/runs",async(_req,res)=>res.json(await deleteRuns()));
router.delete("/memory/:category",async(req,res)=>res.json(await deleteMemory(String(req.params.category))));
router.delete("/publications/:id",async(req,res)=>res.json(await deletePublications(idParam(req.params.id))));
router.delete("/history/publications",async(_req,res)=>res.json(await deletePublications()));
router.get("/shopify/stores",async(_req,res)=>res.json(await savedStores()));
router.post("/shopify/store",async(req,res)=>{
  const {shop}=SwitchShopifyStoreBody.parse(req.body);
  res.json(await switchShopifyStore(shop.toLowerCase()));
});
router.post("/runs",async(req,res)=>{
  const input=CreateRunBody.parse(req.body);
  const url=await publicUrl(input.url);
  if(!url.pathname.includes("/products/"))throw new AppError(400,"Enter a Shopify product URL with /products/ in the path.");
  const run:Run={id:randomUUID(),url:url.href,status:"queued",stage:"validating",createdAt:new Date().toISOString(),events:[],warnings:[],competitors:[],learnings:[],designs:[]};
  await saveRun(run);
  enqueue(run.id,async current=>{current.status="analysing";await event(current,"validating","URL validated; starting public product analysis.");await analyseProduct(current);});
  res.status(201).json(GetRunResponse.parse(run));
});
router.get("/runs/:id",async(req,res)=>{res.json(GetRunResponse.parse(await getRun(idParam(req.params.id))));});
router.patch("/runs/:id/brand",async(req,res)=>{
  const run=await getRun(idParam(req.params.id));if(isActive(run.id))throw new AppError(409,"Wait for analysis to finish.");
  const brand=UpdateBrandBody.parse(req.body);
  for(const key of ["primary","secondary","background","text","button"] as const)if(!/^#[0-9a-f]{6}$/i.test(brand[key]))throw new AppError(400,`${key} must be a six-digit hex colour.`);
  for(const key of ["shopifyHeadingFont","shopifyBodyFont"] as const)if(brand[key]&&!/^[a-z][a-z0-9_]{1,60}$/.test(brand[key]!))throw new AppError(400,"Use a valid Shopify font-library identifier.");
  run.brand={...brand,evidence:`${brand.evidence??""} Merchant reviewed and saved ${new Date().toISOString()}.`};await saveRun(run);res.json(GetRunResponse.parse(await getRun(run.id)));
});
router.patch("/runs/:id/product",async(req,res)=>{
  const run=await getRun(idParam(req.params.id));if(isActive(run.id))throw new AppError(409,"Wait for analysis to finish.");
  if(!run.product)throw new AppError(409,"No product has been extracted.");
  const update=UpdateProductBody.parse(req.body);
  if(update.title!==undefined&&!update.title.trim())throw new AppError(400,"Product title cannot be blank.");
  if(update.currency&&!/^[A-Z]{3}$/.test(update.currency))throw new AppError(400,"Currency must be a three-letter ISO code, e.g. INR.");
  if(update.images?.some(i=>!/^https:\/\/[^/]+\/.+/.test(i)))throw new AppError(400,"Product images must use complete HTTPS URLs.");
  if(update.variants?.some(v=>!/^\d+$/.test(v.id)||v.price<0))throw new AppError(400,"Use actual numeric Shopify variant IDs and nonnegative prices.");
  if(update.rating!==undefined&&update.rating!==null&&(update.rating<1||update.rating>5))throw new AppError(400,"Rating must be a genuine value between 1 and 5, or cleared.");
  if(update.reviewCount!==undefined&&update.reviewCount!==null&&update.reviewCount<0)throw new AppError(400,"Review count cannot be negative.");
  if(update.reviews?.some(r=>!r.text.trim()||!r.sourceUrl.startsWith("https://")||(r.rating!==undefined&&r.rating!==null&&(r.rating<1||r.rating>5))))throw new AppError(400,"Every genuine review needs text, its HTTPS source URL, and a rating between 1 and 5 or no rating.");
  const {collectionUrl,...fields}=update;
  Object.assign(run.product,fields);
  if(collectionUrl===null)delete run.product.collectionUrl;else if(collectionUrl!==undefined){
    const u=new URL(collectionUrl);if(u.protocol!=="https:")throw new AppError(400,"Collection link must use HTTPS.");run.product.collectionUrl=u.href;
  }
  run.product.missingFacts=missingFacts(run.product);
  if(update.price!==undefined&&run.product.variants.length===1)run.product.variants[0]!.price=update.price;
  await saveRun(run);res.json(GetRunResponse.parse(await getRun(run.id)));
});
router.post("/runs/:id/research",async(req,res)=>{
  const run=await getRun(idParam(req.params.id));if(!run.product)throw new AppError(409,"Analyse a product first.");
  if(!searchReady())throw new AppError(503,"Competitor search is not connected. Please contact your workspace administrator to enable research.");
  if(isActive(run.id))throw new AppError(409,"This run already has an active job.");
  run.status="researching";run.error=null;await saveRun(run);enqueue(run.id,research);res.json(GetRunResponse.parse(run));
});
router.post("/runs/:id/generate",async(req,res)=>{
  const run=await getRun(idParam(req.params.id));if(!run.product||!run.brand)throw new AppError(409,"Complete product and brand analysis first.");
  if(run.brand.evidence?.includes("Manual defaults only")&&!run.brand.evidence.includes("Merchant reviewed"))throw new AppError(409,"The storefront blocked CSS/screenshot analysis. Review and save your actual brand values before generating.");
  if(isActive(run.id))throw new AppError(409,"This run already has an active job.");
  run.status="generating";run.error=null;await saveRun(run);enqueue(run.id,generate);res.json(GetRunResponse.parse(run));
});
router.get("/runs/:id/progress",async(req,res)=>{
  const id=idParam(req.params.id);await getRun(id);
  res.set({"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});res.flushHeaders();
  let closed=false;
  req.on("close",()=>{closed=true;clearInterval(timer);});
  const send=async()=>{if(closed)return;try{const run=await getRun(id);res.write(`data: ${JSON.stringify(run)}\n\n`);}catch{res.end();clearInterval(timer);}};
  const timer=setInterval(send,2000);await send();
});
router.post("/designs/:id/feedback",async(req,res)=>{
  const id=idParam(req.params.id),body=SubmitFeedbackBody.parse(req.body);
  const {design,content,category}=await getDesign(id);
  if(design.status==="published")throw new AppError(409,"Published designs cannot be changed by feedback. Generate a new version.");
  design.status=body.action==="approve"?"approved":"rejected";
  await db.insert(feedbackTable).values({id:randomUUID(),designId:id,category,action:body.action,reason:body.reason?.slice(0,2000)});
  await saveDesign(design,content,category);res.json(design);
});
router.post("/designs/:id/regenerate",async(req,res)=>{
  const {design,run}=await getDesign(idParam(req.params.id));
  if(isActive(run.id))throw new AppError(409,"This run already has an active job.");
  const directions=["story-led","benefit-grid","social-proof","offer-led"];
  // Preserve every generated version and its feedback; never overwrite published or rejected evidence.
  const generated=await withRunLock(run.id,()=>generateOne(run,Math.max(0,directions.indexOf(design.direction)),design.version+1));
  res.json(generated);
});
router.get("/designs/:id/preview",async(req,res)=>{
  const {design,content,run}=await getDesign(idParam(req.params.id));
  if(!run.product||!run.brand)throw new AppError(409,"Product or brand missing.");
  res.set({"Content-Type":"text/html; charset=utf-8","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"}).send(preview(design,content,run.product,run.brand));
});
router.get("/designs/:id/download",async(req,res)=>{
  const {design,content,run}=await getDesign(idParam(req.params.id));
  if(!run.product||!run.brand)throw new AppError(409,"Product or brand missing.");
  const zip=await zipDesign(compile(design,content,run.product,run.brand));
  res.set({"Content-Type":"application/zip","Content-Disposition":`attachment; filename="wishluck-${design.id.slice(0,8)}.zip"`}).send(zip);
});
router.post("/designs/:id/quality",async(req,res)=>{res.json(await audit(idParam(req.params.id)));});
router.get("/shopify/cli",async(_req,res)=>res.json(GetCliPublishingStatusResponse.parse(await cliStatus())));
router.post("/shopify/cli/uploads",async(req,res)=>{
  const body=UploadCliThemeBody.parse(req.body);
  if(!body.confirmUnpublishedUpload)throw new AppError(400,"Confirm creating a separate unpublished theme.");
  const {run}=await getDesign(body.designId);
  res.json(PublishDesignResponse.parse(await withRunLock(run.id,()=>withStoreLock(()=>uploadCliTheme(body.designId,body.expectedShop)))));
});
router.post("/shopify/cli/uploads/:id/activate",async(req,res)=>{
  const body=ActivateCliThemeBody.parse(req.body);
  if(!body.confirmReplaceLiveTheme)throw new AppError(400,"Explicit confirmation is required to replace the live storefront.");
  const p=(await publications()).find(row=>row.id===idParam(req.params.id));
  if(!p)throw new AppError(404,"CLI upload not found.");
  const {run}=await getDesign(p.designId);
  res.json(PublishDesignResponse.parse(await withRunLock(run.id,()=>withStoreLock(()=>activateCliTheme(p.id,body)))));
});
router.get("/shopify/status",async(_req,res)=>{res.json(GetShopifyStatusResponse.parse(await verifiedShopifyStatus()));});
router.post("/shopify/connect",async(_req,res)=>{res.json(GetShopifyStatusResponse.parse(await connectShopify()));});
router.get("/shopify/themes",async(_req,res)=>{res.json(ListThemesResponse.parse(await themes()));});
router.get("/shopify/products",async(_req,res)=>{res.json(await admin("query{products(first:50){nodes{id title handle variants(first:100){nodes{id title price availableForSale}} images(first:10){nodes{url altText}}}}}"));});
router.get("/designs/:id/publishing",async(req,res)=>{res.json(await publishingContext(idParam(req.params.id)));});
router.post("/shopify/publish",async(req,res)=>{const body=PublishDesignBody.parse(req.body);const {run}=await getDesign(body.designId);res.json(PublishDesignResponse.parse(await withRunLock(run.id,()=>withStoreLock(()=>publish(body.designId,body.themeId,body.confirmTemplateAssignment,body)))));});
router.get("/shopify/publish/:id/status",async(req,res)=>{const p=(await publications()).find(p=>p.id===idParam(req.params.id));if(!p)throw new AppError(404,"Publication not found");res.json(p);});
router.get("/settings",async(_req,res)=>{
  let database="Unavailable";try{await db.execute(sql`select 1`);database="Connected · PostgreSQL";}catch{/* Keep integration status available during a database outage. */}
  res.json(GetSettingsResponse.parse({shopify:shopifyStatus(),database,
    ai:{provider:process.env.TEXT_MODEL||"OpenAI · gpt-5.4-mini",configured:aiReady(),message:aiReady()?"Replit AI integration configured. Actual calls may still fail; failures are shown per run.":"AI not configured. Source-only output is labelled explicitly."},
    search:{provider:searchProvider(),configured:searchReady(),message:searchReady()?"Search is configured. Provider access is checked on research.":"Competitor search is not connected."}}));
});
router.get("/memory",async(_req,res)=>{
  const runs=await listRuns(),categories=[...new Set(runs.flatMap(r=>r.product?[r.product.category]:[]))];
  const data=await Promise.all(categories.map(async category=>{
    const context=await categoryContext(category);
    return{category,runCount:runs.filter(r=>r.product?.category===category).length,designCount:context.designs.length,approvedCount:context.designs.filter(d=>["approved","published"].includes(d.status)).length,rejectedCount:context.designs.filter(d=>d.status==="rejected").length,learnings:context.learnings,fingerprints:context.designs};
  }));
  res.json(GetMemoryResponse.parse(data.filter(c=>c.designCount>0||c.learnings.length>0)));
});
router.get("/evidence/:id",async(req,res)=>{
  const [record]=await db.select().from(artifactsTable).where(eq(artifactsTable.id,idParam(req.params.id)));
  if(!record)throw new AppError(404,"Evidence not found");
  const slash=record.objectPath.indexOf("/");
  const [bytes]=await objectStorageClient.bucket(record.objectPath.slice(0,slash)).file(record.objectPath.slice(slash+1)).download();
  res.set({"Content-Type":record.contentType,"X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: https:","Content-Disposition":record.contentType==="text/html"?`attachment; filename="evidence-${record.id}.html"`:"inline"}).send(bytes);
});
export default router;
