import {randomUUID} from "node:crypto";
import {AppError,type Run,type Design,type DesignContent} from "./domain";
import {categoryContext,event,saveDesign} from "./store";
import {fingerprint,compare} from "./fingerprints";
import {checkDesign} from "./quality";
import {cleanProductSpecs,missingFacts} from "./facts";
import {planResearchDesign} from "./creative-generation";

// Keep the fourth argument compatible with old internal callers. Modern
// composition is constrained by rendered page history, never by preset families.
export async function generateOne(run:Run,index:number,version=1,_legacyFamilies:string[]=[]):Promise<Design>{
  const p=run.product,b=run.brand;
  if(!p||!b)throw new AppError(409,"Product and brand analysis must finish before generation.");
  const cleaned=cleanProductSpecs(p.specs);
  if(Object.keys(cleaned).length!==Object.keys(p.specs).length){
    p.specs=cleaned;p.missingFacts=missingFacts(p);
    const warning="Ignored non-product privacy/cookie table rows; they are not product specifications.";
    if(!run.warnings.includes(warning))run.warnings.push(warning);
  }
  if(b.evidence?.includes("Manual defaults only")&&!b.evidence.includes("Merchant reviewed"))
    throw new AppError(409,"Review and save your actual brand values before generating from a storefront-blocked analysis.");
  const context=await categoryContext(p.category);
  const base:DesignContent={
    headline:p.title,subheading:p.description.slice(0,260),story:p.description,
    benefits:[],faqs:[],specs:p.specs,sections:[],composition:"composed",
    imagePosition:"left",colorUse:"neutral",ctaPlacement:"hero-and-sticky",
    learningIds:[...run.learnings,...context.learnings].slice(0,18).map(l=>l.id),generationMode:"source-only",
    productSnapshot:structuredClone(p),brandSnapshot:structuredClone(b),
  };
  const {content,influences}=await planResearchDesign(run,index,base,context);
  const fp=fingerprint(content,b),comparison=compare(fp,context.designs),id=randomUUID();
  const warnings:string[]=[];
  if(comparison.comparedCount===0)warnings.push("No prior category designs exist. The initial novelty score is a baseline, not proof of uniqueness.");
  if(p.missingFacts.length)warnings.push(`Unverified facts omitted: ${p.missingFacts.join(", ")}.`);
  const design:Design={
    id,runId:run.id,name:content.visualPlan!.name,direction:"Research-composed",description:content.visualPlan!.rationale,
    status:"draft",version,createdAt:new Date().toISOString(),...comparison,fingerprint:fp,
    checks:[],scores:{seo:0,aeo:0,geo:0,overall:0},
    previewUrl:`/api/designs/${id}/preview`,downloadUrl:`/api/designs/${id}/download`,
    warnings,lighthouse:{status:"not_run"},researchInfluences:influences,
  };
  Object.assign(design,checkDesign(design,content,p,b));
  await saveDesign(design,content,p.category);
  return design;
}
export async function generate(run:Run){
  if(!run.product||!run.brand)throw new AppError(409,"Analyse a product first.");
  run.status="generating";
  run.error=null;
  await event(run,"retrieving_memory",`Reading saved research, merchant feedback and page structures for ${run.product.category}.`);
  for(let i=0;i<4;i++){
    await event(run,"generating_designs",`Composing research-led concept ${i+1} of 4.`);
    await generateOne(run,i);
  }
  run.status="ready";
  await event(run,"ready","Four independently composed designs saved with research references and local technical checks. External Shopify checks remain unverified.");
}
