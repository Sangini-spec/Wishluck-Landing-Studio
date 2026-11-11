import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, type Run, type Design, type DesignContent } from "./domain";
import { askJson, aiReady } from "./ai";
import { categoryContext, event, saveDesign } from "./store";
import { fingerprint, compare } from "./fingerprints";
import { checkDesign } from "./quality";
import { designFamilies, visualPlanSchema, type VisualPlan } from "./design-plan";
import {designResearch,influenceSchema,validateInfluences} from "./research-evidence";
import { cleanProductSpecs,missingFacts } from "./facts";

const copySchema = z.object({
  headline:z.string().max(180),subheading:z.string().max(500),story:z.string().max(2500),
  benefits:z.array(z.object({title:z.string().max(100),text:z.string().max(500)})).max(6),
  faqs:z.array(z.object({question:z.string().max(160),answer:z.string().max(700)})).max(8),
  visualPlan:visualPlanSchema.required(),
  researchInfluences:z.array(influenceSchema).min(2).max(4),
});
const directions = [
  {name:"The product story",key:"story-led",description:"An editorial product narrative with imagery and source-backed detail."},
  {name:"Every detail, considered",key:"benefit-grid",description:"An efficient product discovery experience built around factual details."},
  {name:"Proof, not promises",key:"social-proof",description:"A product-evidence direction. Reviews appear only when they are verified."},
  {name:"Straight to the essentials",key:"offer-led",description:"Price, variant choices and purchase controls take the lead. No invented offers."},
];
const compositions = ["split","editorial","grid","purchase","reversed","framed","compact","panorama","inset","catalogue","feature","asymmetric"];

export async function generateOne(run: Run, index: number, version=1,excludedFamilies:string[]=[]): Promise<Design> {
  const p=run.product,b=run.brand;
  if(!p||!b)throw new AppError(409,"Product and brand analysis must finish before generation.");
  const cleaned=cleanProductSpecs(p.specs);
  if(Object.keys(cleaned).length!==Object.keys(p.specs).length){
    p.specs=cleaned;p.missingFacts=missingFacts(p);
    const warning="Ignored non-product privacy/cookie table rows; they are not product specifications.";
    if(!run.warnings.includes(warning))run.warnings.push(warning);
  }
  if(b.evidence?.includes("Manual defaults only")&&!b.evidence.includes("Merchant reviewed"))throw new AppError(409,"Review and save your actual brand values before generating from a storefront-blocked analysis.");
  const context=await categoryContext(p.category);
  const research=designResearch(run);
  if(research.length<8)throw new AppError(409,"Complete competitor research before generating a design.");
  let researchInfluences:z.infer<typeof influenceSchema>[]=[];
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
  if(!aiReady())throw new AppError(503,"AI design generation is not connected. No repetitive template fallback was generated.");
  const excluded=excludedFamilies.length?excludedFamilies:context.designs.slice(0,4).map(d=>String(d.fingerprint.designFamily??""));
  let allowed=designFamilies.filter(f=>!excluded.includes(f));
  if(!allowed.length)throw new AppError(409,"No distinct composition is available for this batch.");
  const recent=context.designs.slice(0,60).map(d=>({name:d.name,fingerprint:d.fingerprint}));
  let lastAiError="The design provider returned no usable design.";
  let aiSucceeded=false;
  for(let attempt=0;attempt<3&&!aiSucceeded;attempt++){
    try{
      const result=await askJson(`You are an expert ecommerce art director, not a copywriter filling one template. Create concept ${index+1} in an independently designed four-concept batch. Let the actual competitor evidence and this product determine its direction; do not fill a fixed story/benefits/proof/offer template. Return JSON {headline,subheading,story,benefits:[{title,text}],faqs:[{question,answer}],researchInfluences,visualPlan:{family,name,rationale,heroScale,imageTreatment,colorStrategy,contentRhythm,typography,detailLayout,alignment,accentPlacement,headingSize,sectionSpacing,sections}}. name is an original short title; rationale explains the concrete art direction and researched observations.
Choose a structural primitive family from ${JSON.stringify(allowed)}. These are layout primitives, NOT finished templates. Compose a new art direction from the evidence, rather than choosing a preset design. heroScale: monumental|balanced|compact; imageTreatment: cutout|framed|fullbleed|collage; colorStrategy: light|ink|brand|contrast; contentRhythm: spacious|dense|alternating; typography: display|editorial|technical; detailLayout: tiles|timeline|bento|split|columns; alignment: start|center; accentPlacement: edge|panel|rule. Also choose exact headingSize (integer 30–80) and sectionSpacing (even integer 12–100) for this product, not just one default scale.
Return researchInfluences:[{sourceUrl,observation,application,planFields:[field names]}] with 2–4 influences from at least TWO distinct captured pages below. Cite the exact source URLs. State an observed pattern and how it changes actual visualPlan fields. Apply those decisions to the returned plan, not just the rationale. Never import competitor brand assets, product claims or creative copy.
Keep output concise: name at most 80 characters, rationale at most 400 characters (two sentences), headline 180, subheading 500, story 2500, each benefit title 100/text 500, each FAQ question 160/answer 700. Each influence observation and application must be at most 250 characters. At most 6 benefits and 8 FAQs. Do not explain the research again in a long rationale.
Choose 4–8 unique sections from hero,story,benefits,specs,faq,reviews,gallery,purchase; hero must be first and faq present. Use gallery only if multiple source images exist, reviews only if genuine source reviews exist. Avoid empty sections. All choices must be meaningfully different from saved designs below, not just flipped columns, one changed colour or reordered same boxes. Plan the whole page's rhythm, visual hierarchy and contrasting surfaces. Keep actual brand fonts/palette, but use scale, inversion, image staging, type treatment, layout and section architecture boldly. A monochrome brand can still have eight distinctive compositions. Give the plan an original descriptive name (not one of four fixed titles), and a short rationale grounded in the actual research observations. Use concise headline (ideally 3–8 words) and subheading, not the full SKU name as the headline.
Ground EVERY factual statement in product source facts only. No invented reviews, discounts, shipping, returns, materials, dimensions, suitability or statistics; no competitor creative-copy reuse. FAQ answers stand alone; policy/material questions ONLY if answered in facts. Original brand:${JSON.stringify(b)}. Product:${JSON.stringify(p)}.
Actual successfully captured competitor design observations:${JSON.stringify(research)}.
Source-linked learnings:${JSON.stringify([...run.learnings,...context.learnings].slice(0,12))}. Saved design history to avoid:${JSON.stringify(recent)}. Feedback:${JSON.stringify(context.feedback.map(f=>({action:f.action,reason:f.reason})))}.
Previous attempt error if any:${attempt?lastAiError:"none"}`,copySchema.extend({visualPlan:visualPlanSchema.required().extend({family:z.enum(allowed as [VisualPlan["family"],...VisualPlan["family"][]])})}),undefined,true);
      if(!allowed.includes(result.value.visualPlan.family))throw new Error("The design repeated a family already used in this batch.");
      validateInfluences(run,result.value.researchInfluences);
      if(result.value.visualPlan.headingSize===undefined||result.value.visualPlan.sectionSpacing===undefined)throw new Error("Choose product-specific heading size and spacing.");
      const proposed={...content,...result.value,sections:result.value.visualPlan.sections,composition:result.value.visualPlan.family,imagePosition:result.value.visualPlan.alignment==="center"?"center":"left",colorUse:result.value.visualPlan.colorStrategy};
      const novelty=compare(fingerprint(proposed,b),context.designs);
      if(novelty.uniqueness<38){
        if(allowed.length>1)allowed=allowed.filter(f=>f!==result.value.visualPlan.family);
        const previous=context.designs.find(d=>d.id===novelty.closestDesign)?.fingerprint;
        const axes=(plan:Record<string,unknown>)=>Object.fromEntries(["designFamily","family","heroScale","imageTreatment","colorStrategy","contentRhythm","typeTreatment","typography","detailLayout","alignment","accentPlacement","sectionOrder"].filter(k=>plan[k]!==undefined).map(k=>[k,plan[k]]));
        throw new Error(`Only ${novelty.uniqueness}% structural difference; minimum 38%. Your plan: ${JSON.stringify(axes(fingerprint(proposed,b)))}. Closest saved composition: ${JSON.stringify(axes(previous??{}))}. Recompose at least five of the matching visual axes using OTHER real research observations. A different title or rationale does not change the layout.`);
      }
      researchInfluences=result.value.researchInfluences;
      content={...content,...result.value,generationMode:"ai"};
      run.aiCost=(run.aiCost??0)+result.estimatedCost;
      aiSucceeded=true;
    }catch(e){lastAiError=e instanceof Error?e.message:"AI design response failed.";}
  }
  if(!aiSucceeded)throw new AppError(502,/structural difference|too similar/i.test(lastAiError)
    ?"The AI proposals were too similar to existing category designs. No repetitive result was saved; your existing designs are unchanged. Refresh competitor research before trying again."
    :"AI generation could not satisfy the design requirements. No new design was saved; your product, research and existing designs are unchanged.");
  const prior=context.designs;
  const cleanPlan=(plan:VisualPlan):VisualPlan=>{
    const sections=[...new Set(plan.sections)].filter(k=>k!=="hero"&&k!=="faq"&&(k!=="reviews"||p.reviews?.length)&&(k!=="gallery"||p.images.length>1)&&(k!=="specs"||Object.keys(p.specs).length)&&(k!=="benefits"||content.benefits.length));
    return {...plan,imageTreatment:plan.imageTreatment==="collage"&&p.images.length<2?"framed":plan.imageTreatment,sections:["hero",...sections,"faq"]};
  };
  const apply=(plan:VisualPlan):DesignContent=>({...content,visualPlan:cleanPlan(plan),sections:cleanPlan(plan).sections,
    composition:plan.family,imagePosition:plan.alignment==="center"?"center":"left",colorUse:plan.colorStrategy,
    ctaPlacement:plan.sections.includes("purchase")?"hero-repeat-sticky":"hero-and-sticky"});
  content=apply(content.visualPlan!);
  if(compare(fingerprint(content,b),prior).uniqueness<38)throw new AppError(409,"The new design was too similar after content validation and was not saved. Refresh research and regenerate.");
  const fp=fingerprint(content,b);
  const comparison=compare(fp,prior);
  const id=randomUUID();
  const warnings:string[]=[];
  if(run.competitors.filter(c=>c.status==="crawled").length<8)warnings.push("Competitor research minimum not met: fewer than eight successfully crawled sources.");
  if(comparison.comparedCount===0)warnings.push("No prior category designs exist. The initial novelty score is a baseline, not proof of uniqueness.");
  if(p.missingFacts.length)warnings.push(`Unverified facts omitted: ${p.missingFacts.join(", ")}.`);
  const design:Design={
    id,runId:run.id,name:content.visualPlan!.name,direction:direction.key,description:content.visualPlan!.rationale,
    status:"draft",version,createdAt:new Date().toISOString(),...comparison,fingerprint:fp,checks:[],scores:{seo:0,aeo:0,geo:0,overall:0},
    previewUrl:`/api/designs/${id}/preview`,downloadUrl:`/api/designs/${id}/download`,warnings,
    lighthouse:{status:"not_run"},
    researchInfluences,
  };
  Object.assign(design,checkDesign(design,content,p));
  await saveDesign(design,content,p.category);
  return design;
}
export async function generate(run:Run){
  if(!run.product||!run.brand)throw new AppError(409,"Analyse a product first.");
  run.status="generating";
  await event(run,"retrieving_memory",`Reading saved learnings and fingerprints for ${run.product.category}.`);
  const recent=(await categoryContext(run.product.category)).designs.slice(0,4).map(d=>d.fingerprint.designFamily).filter((x):x is string=>typeof x==="string");
  const families:string[]=[...new Set(recent)].slice(0,4);
  for(let i=0;i<4;i++){
    await event(run,"generating_designs",`Creating ${directions[i]!.key} direction ${i+1} of 4.`);
    const design=await generateOne(run,i,1,families);
    families.push(String(design.fingerprint.designFamily));
  }
  run.status="ready";
  await event(run,"ready","Four designs saved with original/source-grounded copy, layout fingerprints and local technical checks. Shopify and external checks remain unverified.");
}
