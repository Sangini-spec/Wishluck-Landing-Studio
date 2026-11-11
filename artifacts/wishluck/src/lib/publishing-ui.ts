import type {Publication,PublishingJob} from "@workspace/api-client-react";

export type PendingUpload={id?:string;shop:string;designId:string};
export type HistoryPreferences={collapsed:boolean;hidden:string[]};
export function historyPreferences(raw:string|null):HistoryPreferences{
  try{
    const value=JSON.parse(raw??"null");
    return {collapsed:value?.collapsed===true,hidden:Array.isArray(value?.hidden)?value.hidden.filter((id:unknown):id is string=>typeof id==="string"):[]};
  }catch{return {collapsed:false,hidden:[]};}
}
export function readyPublication(pending:PendingUpload,uploads:Publication[],jobs:PublishingJob[]){
  if(!pending.id)return undefined;
  const job=jobs.find(j=>j.id===pending.id&&j.shop===pending.shop&&j.designId===pending.designId&&j.kind==="upload");
  return uploads.find(p=>p.designId===pending.designId&&p.shop===pending.shop&&p.verified&&p.status==="published"&&p.editorUrl&&
    (p.id===pending.id||p.jobId===pending.id||p.id===job?.publicationId));
}
export function uploadPhase(phase?:string){
  return ({queued:"Waiting to start",preparing:"Preparing your design",creating:"Uploading your theme",verifying:"Verifying uploaded files",assigning:"Connecting your product",assigned:"Finishing your preview",completed:"Preparing the theme editor"} as Record<string,string>)[phase??""]??"Preparing your Shopify preview";
}
