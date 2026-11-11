import {z} from "zod";
import {AppError,type Run} from "./domain";
export const influenceSchema=z.object({
  // The model's JSON-schema subset does not support format:uri. Exact source
  // membership is enforced below, which also rejects invented or invalid URLs.
  sourceUrl:z.string(),observation:z.string().min(8).max(350),application:z.string().min(8).max(350),
  planFields:z.array(z.enum(["family","heroScale","imageTreatment","colorStrategy","contentRhythm","typography","detailLayout","alignment","accentPlacement","sections","headingSize","sectionSpacing"])).min(1).max(4),
});
export function designResearch(run:Run){
  return run.competitors.filter(c=>c.status==="crawled"&&c.analysis).map(c=>({url:c.url,observations:c.analysis,sections:c.sections}));
}
export function validateInfluences(run:Run,influences:z.infer<typeof influenceSchema>[]){
  const sources=new Set(designResearch(run).map(c=>c.url));
  if(new Set(influences.map(i=>i.sourceUrl)).size<2||influences.some(i=>!sources.has(i.sourceUrl)))
    throw new AppError(422,"The design must apply observations from at least two actually captured competitor pages.");
}
