import {AppError,type Run} from "./domain";
import {research} from "./research";
import {generate} from "./generation";
import {searchReady} from "./search";
import {refreshMissingVariants} from "./source-refresh";
import {reviewedInputKey,sameReviewedInputs} from "./research-identity";

export const researchKey=reviewedInputKey;
export function researchIsCurrent(run:Run){
  return run.competitors.filter(c=>c.status==="crawled"&&c.analysis).length>=8&&
    sameReviewedInputs(run);
}
export async function researchThenGenerate(run:Run,refresh=false,services:{research:typeof research;generate:typeof generate;searchReady:typeof searchReady;refreshSource?:typeof refreshMissingVariants}={research,generate,searchReady,refreshSource:refreshMissingVariants}){
  if(!services.searchReady())throw new AppError(503,"Competitor research is required before design generation. Search is not connected.");
  await services.refreshSource?.(run);
  if(refresh||!researchIsCurrent(run))await services.research(run);
  const count=run.competitors.filter(c=>c.status==="crawled"&&c.analysis).length;
  if(count<8)throw new AppError(422,`Research captured ${count} of the required 8 competitor pages. No new designs were generated. Review the blocked sources and retry research.`);
  await services.generate(run);
}
