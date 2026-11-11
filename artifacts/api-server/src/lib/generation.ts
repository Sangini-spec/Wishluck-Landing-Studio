import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, type Run, type Design, type DesignContent } from "./domain";
import { askJson, aiReady } from "./ai";
import { categoryContext, event, saveDesign } from "./store";
import { fingerprint, compare } from "./fingerprints";
import { checkDesign } from "./quality";

const copySchema = z.object({
  headline:z.string().max(180),subheading:z.string().max(500),story:z.string().max(2500),
  benefits:z.array(z.object({title:z.string().max(100),text:z.string().max(500)})).max(6),
  faqs:z.array(z.object({question:z.string().max(160),answer:z.string().max(700)})).max(8),
});
const directions = [
  {name:"The product story",key:"story-led",description:"An editorial product narrative with imagery and source-backed detail."},
  {name:"Every detail, considered",key:"benefit-grid",description:"An efficient product discovery experience built around factual details."},
  {name:"Proof, not promises",key:"social-proof",description:"A product-evidence direction. Reviews appear only when they are verified."},
  {name:"Straight to the essentials",key:"offer-led",description:"Price, variant choices and purchase controls take the lead. No invented offers."},
];
const compositions = ["split","editorial","grid","purchase","reversed","framed","compact","panorama","inset","catalogue","feature","asymmetric"];

export async function generateOne(run: Run, index: number, version=1): Promise<Design> {
  const p=run.product,b=run.brand;
  if(!p||!b)throw new AppError(409,"Product and brand analysis must finish before generation.");
  if(b.evidence?.includes("Manual defaults only")&&!b.evidence.includes("Merchant reviewed"))throw new AppError(409,"Review and save your actual brand values before generating from a storefront-blocked analysis.");
  const context=await categoryContext(p.category);
  const direction=directions[index%4]!;
  let content:DesignContent={
    headline:p.title,subheading:p.description.slice(0,260),story:p.description,
    benefits:Object.entries(p.specs).slice(0,4).map(([title,text])=>({title,text})),
    faqs:[{question:`What is ${p.title}?`,answer:p.description.slice(0,500)||`${p.title} is offered by ${p.brand}. Review the available variants before purchasing.`}],
    specs:p.specs,sections:["hero","story","benefits","specs","faq"],
    composition:compositions[index]!,imagePosition:"left",colorUse:"neutral",ctaPlacement:"hero-and-sticky",
    learningIds:[...run.learnings,...context.learnings].slice(0,12).map(l=>l.id),generationMode:"source-only",
    productSnapshot:structuredClone(p),brandSnapshot:structuredClone(b),
  };
  let aiFailed=false;
  if(aiReady()){
    try{
      const result=await askJson(`Write original product copy for ${direction.key}. Return JSON {headline,subheading,story,benefits:[{title,text}],faqs:[{question,answer}]}. Ground EVERY factual statement in product source facts only. Never invent reviews, discounts, shipping, returns, materials, dimensions, suitability or statistics. Do not turn absent fields into marketing claims. FAQ answers must stand alone. Include size/material/care/policy questions ONLY if answers are in facts. Tone: ${b.tone}. Product facts:${JSON.stringify(p)}. Competitor pattern learnings:${JSON.stringify([...run.learnings,...context.learnings].slice(0,12))}. Feedback to apply:${JSON.stringify(context.feedback.map(f=>({action:f.action,reason:f.reason})))}`,copySchema);
      content={...content,...result.value,generationMode:"ai"};
      run.aiCost=(run.aiCost??0)+result.estimatedCost;
    }catch{aiFailed=true;}
  }
  const prior=context.designs;
  let best={score:-1,content};
  for(let j=0;j<48;j++){
    const composition=compositions[(index+j)%compositions.length]!;
    const candidate={
      ...content,composition,imagePosition:j%2===0?"left":"right",
      colorUse:["neutral","brand-hero","brand-details"][Math.floor(j/2)%3]!,
      ctaPlacement:["hero-and-sticky","hero-repeat-sticky"][Math.floor(j/3)%2]!,
      sections:(index+j)%3===0?["hero","story","benefits","specs","faq"]:(index+j)%3===1?["hero","specs","benefits","story","faq"]:["hero","benefits","story","specs","faq"],
    };
    const score=compare(fingerprint(candidate,b),prior).uniqueness;
    if(score>best.score){best={score,content:candidate};}
    if(score>=45&&j>=index)break;
  }
  content=best.content;
  if(p.reviews?.length){
    const at=direction.key==="social-proof"?1:Math.max(1,content.sections.indexOf("faq"));
    content.sections.splice(at,0,"reviews");
  }
  const fp=fingerprint(content,b);
  const comparison=compare(fp,prior);
  const id=randomUUID();
  const warnings:string[]=[];
  if(run.competitors.filter(c=>c.status==="crawled").length<8)warnings.push("Competitor research minimum not met: fewer than eight successfully crawled sources.");
  if(content.generationMode==="source-only")warnings.push(aiFailed?"AI generation failed; source-only fallback, not an AI-generated design.":"AI unavailable; source-only fallback, not an AI-generated design.");
  if(comparison.uniqueness<20)warnings.push("Layout novelty is below the configured 20% minimum. Reject or regenerate before publishing.");
  if(comparison.comparedCount===0)warnings.push("No prior category designs exist. The initial novelty score is a baseline, not proof of uniqueness.");
  if(p.missingFacts.length)warnings.push(`Unverified facts omitted: ${p.missingFacts.join(", ")}.`);
  const design:Design={
    id,runId:run.id,name:direction.name,direction:direction.key,description:direction.description,
    status:"draft",version,createdAt:new Date().toISOString(),...comparison,fingerprint:fp,checks:[],scores:{seo:0,aeo:0,geo:0,overall:0},
    previewUrl:`/api/designs/${id}/preview`,downloadUrl:`/api/designs/${id}/download`,warnings,
    lighthouse:{status:"not_run"},
  };
  Object.assign(design,checkDesign(design,content,p));
  await saveDesign(design,content,p.category);
  return design;
}
export async function generate(run:Run){
  if(!run.product||!run.brand)throw new AppError(409,"Analyse a product first.");
  run.status="generating";
  await event(run,"retrieving_memory",`Reading saved learnings and fingerprints for ${run.product.category}.`);
  for(let i=0;i<4;i++){
    await event(run,"generating_designs",`Creating ${directions[i]!.key} direction ${i+1} of 4.`);
    await generateOne(run,i);
  }
  run.status="ready";
  await event(run,"ready","Four designs saved with original/source-grounded copy, layout fingerprints and local technical checks. Shopify and external checks remain unverified.");
}
