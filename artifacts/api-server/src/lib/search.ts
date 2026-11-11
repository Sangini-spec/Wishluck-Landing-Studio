import { z } from "zod";
import { AppError } from "./domain";

export const searchProvider=()=>process.env.SEARCH_PROVIDER?.trim().toLowerCase()||"tavily";
const searchKey=()=>process.env.TAVILY_API_KEY||process.env.SEARCH_API_KEY;
export const searchReady=()=>searchProvider()==="tavily"&&!!searchKey();
const resultSchema=z.object({results:z.array(z.object({url:z.string().url(),title:z.string(),content:z.string().optional()}))});

export async function search(query:string):Promise<{url:string;title:string;description?:string}[]>{
  if(searchProvider()!=="tavily")throw new AppError(503,"The configured search provider is no longer supported. Configure Tavily to enable competitor research.");
  if(!searchReady())throw new AppError(503,"Competitor search is not connected. Please contact your workspace administrator to enable research.");
  const response=await fetch("https://api.tavily.com/search",{
    method:"POST",
    headers:{"Authorization":`Bearer ${searchKey()}`,"Content-Type":"application/json"},
    // Basic is one credit; disable automatic upgrades and unnecessary paid features.
    body:JSON.stringify({query,topic:"general",search_depth:"basic",auto_parameters:false,max_results:20,include_answer:false,include_raw_content:false,include_images:false}),
    signal:AbortSignal.timeout(25000),
  });
  if(response.status===401||response.status===403)throw new AppError(503,"Search authentication failed. Ask your workspace administrator to reconnect search.");
  if(response.status===432||response.status===433)throw new AppError(503,"The search account has reached its usage limit. Research was stopped; no results were simulated.");
  if(response.status===429)throw new AppError(503,"Search is rate limited. Wait a moment and retry research.");
  if(!response.ok)throw new AppError(502,`Search is temporarily unavailable (HTTP ${response.status}).`);
  const parsed=resultSchema.safeParse(await response.json());
  if(!parsed.success)throw new AppError(502,"Search returned an invalid response. Research was stopped.");
  return parsed.data.results.filter(r=>r.url.startsWith("https://")).map(r=>({url:r.url,title:r.title,description:r.content}));
}
