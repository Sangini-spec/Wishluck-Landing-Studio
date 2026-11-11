import {createHash} from "node:crypto";
import {AppError,type Run} from "./domain";
import {research} from "./research";
import {generate} from "./generation";
import {searchReady} from "./search";

export const researchKey=(run:Run)=>createHash("sha256").update(JSON.stringify({product:run.product,brand:run.brand})).digest("hex");
export function researchIsCurrent(run:Run){
  const key=researchKey(run);
  return run.competitors.filter(c=>c.status==="crawled"&&c.analysis).length>=8&&
    run.researchKey===key;
}
export async function researchThenGenerate(run:Run,refresh=false,services={research,generate,searchReady}){
  if(!services.searchReady())throw new AppError(503,"Competitor research is required before design generation. Search is not connected.");
  if(refresh||!researchIsCurrent(run))await services.research(run);
  const count=run.competitors.filter(c=>c.status==="crawled"&&c.analysis).length;
  if(count<8)throw new AppError(422,`Research captured ${count} of the required 8 competitor pages. No new designs were generated. Review the blocked sources and retry research.`);
  await services.generate(run);
}
