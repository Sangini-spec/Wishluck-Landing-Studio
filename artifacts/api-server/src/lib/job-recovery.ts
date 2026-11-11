import {createHash} from "node:crypto";
import type {PublishingJob} from "@workspace/api-zod";

export type DurableJob=PublishingJob&{
  identity:string;
  runId:string;
  beforeThemeIds?:string[];
  sourceHash?:string;
  title?:string;
};
function stable(value:unknown):unknown{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));
  return value;
}
export const contentHash=(value:unknown)=>createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

// Only exact unique names not present before creation may be recovered.
// Never infer ownership from a generic prefix or from "the newest theme".
export function recoveredTheme(job:DurableJob,themes:{id:string;name:string;role:string}[]){
  if(job.themeId)return themes.find(t=>t.id===job.themeId);
  if(!job.themeName||!job.beforeThemeIds)return undefined;
  const matches=themes.filter(t=>t.name===job.themeName&&!job.beforeThemeIds!.includes(t.id));
  return matches.length===1?matches[0]:undefined;
}
export async function reportInterruptedUpload(job:DurableJob,list:()=>Promise<{id:string;name:string;role:string}[]>){
  const theme=recoveredTheme(job,await list());
  return {theme,message:theme
    ?"Recovered the existing Shopify theme. No files or product fields were rewritten. Review it in Shopify; interrupted verification or assignment was not replayed."
    :"Upload was interrupted and no unique theme could be identified. No retry or new theme was created. Review Shopify before starting different content."};
}
