import {z} from "zod";
import {askJson} from "./ai";
import {campaignBrief} from "./campaign-brief";
import {AppError,type Run} from "./domain";
import {logger} from "./logger";

export const campaignCopySchema=z.object({
  headline:z.string().min(3).max(180),
  subheading:z.string().min(8).max(500),
  story:z.string().min(30).max(2500),
  benefits:z.array(z.object({title:z.string().min(2).max(100),text:z.string().min(8).max(500)})).max(6),
});
export function assertCustomerCopy(copy:z.infer<typeof campaignCopySchema>,titles:string[]=[]){
  const text=[copy.headline,copy.subheading,copy.story,...copy.benefits.flatMap(b=>[b.title,b.text]),...titles].join(" ");
  if(/\blanding[- ]?page\b|\bproduct page\b|\b(?:this|the) (?:page|design|layout)\b|\b(?:campaign|story|copy|section) should\b|\bhero section\b|\babove.the.fold\b|\b(?:verified|confirmed) (?:source |product )?facts\b|\bwhat(?:'s| is) confirmed\b|\b(?:copy|page) can (?:position|explain|show)\b|\bclear text\b/i.test(text))
    throw new Error("Product copy contains design instructions. Write directly to the shopper about the product, not its page, layout or generation.");
}
export async function writeCampaignCopy(run:Run,index:number,ask=askJson){
  const brief=campaignBrief(run.product!,run.brand??undefined);
  let reason="";
  for(let attempt=0;attempt<2;attempt++){
    try{
      const answer=await ask(`CAMPAIGN COPY: You are the brand's ecommerce copywriter. Write the finished words a shopper reads, not a brief for another writer or designer.
Product and merchant facts: ${JSON.stringify(brief.product)}
Verified attributes: ${JSON.stringify(brief.verifiedSpecs)}
Brand voice: ${brief.voice}
Write an original headline, short introduction, a concise product story and zero to six genuinely supported product benefits for concept ${index+1}.
Address the shopper naturally. Focus on the actual product and what it is for. Short accurate copy is better than padded explanations.
Only facts supplied above may support claims. Photography, lighting and the arrangement of a website are not product benefits. If facts are sparse, keep the story short and benefits empty rather than invent ingredients, efficacy, suitability, testing, policies or endorsements.
Your response will appear verbatim in a storefront. It must not contain the words "landing page", layout instructions, copywriting advice, verification disclaimers, or descriptions of purchase controls.
${reason?`Revise the words themselves to fix this issue: ${reason}`:""}`,
        campaignCopySchema,undefined,true);
      run.aiCost=(run.aiCost??0)+answer.estimatedCost;
      assertCustomerCopy(answer.value);
      return answer.value;
    }catch(error){
      reason=error instanceof Error?error.message:"Invalid product copy.";
      logger.warn({runId:run.id,concept:index+1,attempt:attempt+1,reason:reason.slice(0,1500)},"Campaign copy rejected");
    }
  }
  throw new AppError(502,"The product copy did not pass quality checks. Existing designs were kept. Retry generation to finish the remaining designs.");
}
