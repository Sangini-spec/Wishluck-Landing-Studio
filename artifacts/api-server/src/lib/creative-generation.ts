import {z} from "zod";
import {askJson,aiReady} from "./ai";
import {AppError,type Run,type DesignContent} from "./domain";
import {creativePlanSchema,compositionSchema,surfaces} from "./composition-plan";
import {composedVisualPlan} from "./design-plan";
import {designResearch,influenceSchema,validateInfluences} from "./research-evidence";
import {compare,fingerprint} from "./fingerprints";
import {categoryContext} from "./store";
import {campaignBrief} from "./campaign-brief";
import {writeCampaignCopy,assertCustomerCopy} from "./campaign-copy";
import {logger} from "./logger";

const copySchema=z.object({
  headline:z.string().max(180).describe("Customer-facing product value proposition."),
  subheading:z.string().max(500).describe("Customer-facing product introduction, never an explanation of how a page or data source was generated."),
  story:z.string().max(2500).describe("An original customer-facing product narrative grounded in the supplied facts."),
  benefits:z.array(z.object({title:z.string().max(100),text:z.string().max(500)})).max(6),
  visualPlan:creativePlanSchema,
  researchInfluences:z.array(influenceSchema.extend({
    planFields:z.array(z.enum(["composition","imageTreatment","typography","headingSize","sectionSpacing"])).min(1).max(4),
  })).min(2).max(4),
});
type Copy=z.infer<typeof copySchema>;
function compose(result:Copy,base:DesignContent,run:Run):DesignContent{
  const p=run.product!,brief=campaignBrief(p,run.brand??undefined),nodes=result.visualPlan.composition.sections;
  const kinds=nodes.map(s=>s.kind);
  if(new Set(kinds).size!==kinds.length)throw new Error("Each content kind may occur only once. Compose different structures, not repeated copies of one section.");
  for(const required of brief.requiredSections)
    if(!kinds.includes(required as typeof kinds[number]))throw new Error(`This campaign needs a ${required} section to make its factual content and purchase journey complete.`);
  if(kinds.filter(kind=>["story","benefits","specs","gallery","reviews"].includes(kind)).length<brief.minimumExplanatorySections)
    throw new Error("Include at least two substantive explanatory or proof sections in addition to FAQ and purchase. Do not return a product-description-only page.");
  if(!result.headline.trim()||!result.subheading.trim()||!result.story.trim())throw new Error("Write a complete customer-facing value proposition, introduction and product story.");
  assertCustomerCopy(result,nodes.map(node=>node.title));
  if(/rejected (?:proposal|design|layout|rail|split|stack|concept)|previous (?:proposal|rejection)|retry attempt/i.test(result.visualPlan.rationale))
    throw new Error("Explain only the final campaign strategy and its actual research references. Do not discuss rejected ideas or internal retries in the rationale.");
  for(const node of nodes){
    if(node.kind==="gallery"&&p.images.length<2)throw new Error("A gallery requires at least two real product images.");
    if(node.kind==="reviews"&&!p.reviews?.length)throw new Error("No verified reviews exist. Omit the reviews section.");
    if(node.kind==="benefits"&&!result.benefits.length)throw new Error("Do not include an empty benefits section.");
    if(node.kind==="specs"&&!Object.keys(base.specs).length)throw new Error("No product specifications are verified. Omit specifications.");
  }
  if(result.visualPlan.composition.hero.imageCount>p.images.length)throw new Error(`Use at most ${p.images.length} real product images in the hero.`);
  const visualPlan=composedVisualPlan(result.visualPlan);
  return {...base,headline:result.headline,subheading:result.subheading,story:result.story,benefits:result.benefits,
    specs:brief.verifiedSpecs,faqs:brief.questions.map(({question,answer})=>({question,answer})),
    visualPlan,sections:visualPlan.sections,composition:"composed",imagePosition:visualPlan.composition!.hero.mediaSide,
    colorUse:visualPlan.colorStrategy,ctaPlacement:kinds.includes("purchase")?"hero-repeat-sticky":"hero-and-sticky",generationMode:"ai"};
}
export async function planResearchDesign(run:Run,index:number,base:DesignContent,context:Awaited<ReturnType<typeof categoryContext>>,ask=askJson){
  if(!aiReady())throw new AppError(503,"AI design generation is not connected. No template fallback was generated.");
  const research=designResearch(run);
  if(research.length<8)throw new AppError(409,"Complete competitor research before generating a design.");
  if(!run.product?.images.length)throw new AppError(422,"Add a real product image before generating a design.");
  const brief=campaignBrief(run.product,run.brand??undefined);
  if(!brief.product.title.trim()||!brief.product.description)
    throw new AppError(409,"Review the product title and description before generating a campaign page. Missing specifications and policies will remain explicitly unverified.");
  // Keep strategy, rejected layouts and technical instructions out of the
  // copywriter's context. A fresh layout never requires rewriting valid copy.
  const campaignCopy=await writeCampaignCopy(run,index,ask);
  const latest=context.designs.filter(d=>d.fingerprint.schemaVersion===3).slice(0,3);
  const recentHeroes=latest.map(d=>d.fingerprint.hero as Record<string,unknown>);
  const heroModes=compositionSchema.shape.hero.shape.layout.options.filter(mode=>!recentHeroes.some(hero=>hero.layout===mode));
  const allowedModes=heroModes.length?heroModes:compositionSchema.shape.hero.shape.layout.options;
  const allowedSurfaces=recentHeroes.length===3&&recentHeroes.every(hero=>["paper","muted"].includes(String(hero.surface)))
    ?["ink","brand"] as const:surfaces;
  const outputSchema=copySchema.pick({visualPlan:true,researchInfluences:true}).extend({visualPlan:creativePlanSchema.extend({composition:compositionSchema.extend({
    sections:compositionSchema.shape.sections.min(Math.max(4,brief.requiredSections.length)),
    hero:compositionSchema.shape.hero.extend({
      layout:z.enum(allowedModes as [typeof allowedModes[number],...typeof allowedModes[number][]]),
      surface:z.enum(allowedSurfaces as unknown as [typeof surfaces[number],...typeof surfaces[number][]]),
    }),
  })})});
  let problem="",previousProposal:unknown;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const result=await ask(`You are an ecommerce art director composing concept ${index+1} from REAL market research.
There are NO finished page families or four preset directions. You compose a page from independently editable native Shopify primitives. Do not simply repeat the visual arrangement of the saved pages.
Return only the visual plan and researchInfluences. Product copy has already been written by the brand's copywriter; do not write or critique copy.
Finished storefront copy: ${JSON.stringify(campaignCopy)}
visualPlan contains name, rationale, typography, imageTreatment, headingSize, sectionSpacing, and composition.
COMPOSITION: hero chooses layout split|stack|offset|rail|showcase, mediaSide left|right, mediaShare 35–70 in steps of5, imageRatio square|portrait|landscape, imageCount 1–${Math.min(4,run.product.images.length)}, surface paper|ink|brand|muted, alignment start|center, contentWidth compact|balanced|wide.
For this concept use one of these still-distinct hero geometries: ${JSON.stringify(allowedModes)}. Hero surfaces available for this concept: ${JSON.stringify(allowedSurfaces)}. These constraints prevent a batch of near-identical first screens; they do not prescribe the rest of the page.
Start with the factual CAMPAIGN BRIEF below, then choose the visual composition. Optimise content completeness and useful answers before decoration. This is a full conversion-focused campaign, not a catalogue hero plus description.
Campaign brief: ${JSON.stringify(brief)}
Compose ${Math.max(4,brief.requiredSections.length)}–7 individually different content sections, each with kind story|benefits|specs|faq|reviews|gallery|purchase, layout stack|split|grid|feature|alternating|band, surface paper|ink|brand|muted, headingPlacement above|beside|center, columns 1–4, width full|contained|narrow, spacing EVEN24–100 and an original title <=65characters.
Include every requiredSections entry from the brief. Choose the order and independent structure for a coherent selling strategy, not a shuffled preset. FAQs are populated automatically from the brief's verified answers; do not generate FAQ answers.
Include at least two substantive sections from story, benefits, specifications, real gallery or verified reviews, in addition to FAQ and purchase. More sections are not automatically better: each must add real information rather than repeating the same description.
Use each content kind at most once. Include faq, but its position is your decision. Do not include reviews without actual verified source reviews; gallery requires multiple source images; omit specs when no actual specifications exist. Never use an empty content section.
Available product benefits: ${campaignCopy.benefits.length}. If zero, omit benefits; use the factual story and real image gallery instead. Section titles are finished customer-facing words, never labels explaining the website.
The hero always contains real price/variants/quantity/cart; keep purchasing easy to find. Make genuine structural choices across the WHOLE page: image and purchase arrangement, editorial versus dense sections, full-width versus restrained passages, independently positioned headings, distinct media proportions and contrast transitions. Do not create a monochrome wall of repeated two-column boxes. Use the brand's actual fonts and brand-derived colors; preserve image visibility, not decorative cropping.
Every design must apply 2–4 concrete observations from at least TWO captured competitor URLs in researchInfluences. planFields may cite composition, typography, imageTreatment, headingSize, sectionSpacing. State what was observed and exactly how your composition applies it. Research changes the composition, not merely the description. Do NOT copy any competitor's wording, logos, photos or code.
Creative text limits: name80, rationale400, headline180, subheading500, story2500characters; benefits title100/text500; FAQ question160/answer700; influence observation/application250. headingSize integer30–80; sectionSpacing EVEN12–100.
The name and rationale describe the finished creative concept and its research influences. Use one sentence about its final selling strategy and one about the applied references. Never mention rejected proposals, retry attempts, scoring thresholds or internal generation instructions in customer-facing copy.
Keep copy factual. Do not invent reviews, materials, dimensions, shipping/return promises, discounts, guarantees, statistics or suitability. Competitor claims are never facts about this product.
Brand: ${JSON.stringify(run.brand)}
Verified product facts: ${JSON.stringify(run.product)}
Captured reference observations: ${JSON.stringify(research)}
Category learnings: ${JSON.stringify([...run.learnings,...context.learnings].slice(0,18))}
Saved page structures to avoid: ${JSON.stringify(context.designs.slice(0,40).map(d=>({name:d.name,fingerprint:d.fingerprint})))}
Merchant feedback: ${JSON.stringify(context.feedback.map(f=>({action:f.action,reason:f.reason})))}
${attempt?`The previous proposal was rejected: ${problem}. Previous structural proposal: ${JSON.stringify(previousProposal)}. Compose a materially different page; do not just rename it.`:""}`,
        outputSchema,undefined,true);
      run.aiCost=(run.aiCost??0)+result.estimatedCost;
      validateInfluences(run,result.value.researchInfluences);
      const content=compose({...campaignCopy,...result.value},base,run);
      previousProposal=fingerprint(content,run.brand!);
      const comparison=compare(previousProposal as Record<string,unknown>,context.designs);
      if(comparison.uniqueness<38){
        const nearest=context.designs.find(d=>d.id===comparison.closestDesign);
        throw new Error(`Only ${comparison.uniqueness}% structural difference from an existing page; minimum38%. Closest rendered design: ${JSON.stringify(nearest?.fingerprint)}. The next concept must deliberately contrast this exact page, not just the last proposal: change at least three visible hero decisions and independently recompose at least two content sections (layout, heading position, width or surface). Consider image-led gallery and purchase sections where the actual source supports them. Use a different captured research observation to justify each major change. Keep factual purchase controls and brand fidelity.`);
      }
      return {content,influences:result.value.researchInfluences};
    }catch(error){
      problem=error instanceof Error?error.message:"The proposed design was invalid.";
      logger.warn({runId:run.id,concept:index+1,attempt:attempt+1,reason:problem.slice(0,2000)},"Design planning attempt rejected");
    }
  }
  throw new AppError(502,/structural difference/.test(problem)
    ?"The proposed pages were still too similar to saved designs. No repetitive result was saved. Refresh competitor research before retrying."
    :`A design did not pass its quality checks. Existing designs were kept.${problem.trim().startsWith("[")?" Retry to finish the remaining designs.":` ${problem.slice(0,300)}`}`);
}
