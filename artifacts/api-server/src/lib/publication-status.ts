import type {Publication,Design} from "./domain";
export function publicationState(p:Publication){
  if(p.remoteRole==="missing")return "deleted";
  if(["live","main"].includes(p.remoteRole??"")||(!p.remoteRole&&p.livePublished===true))return "published";
  if(p.status==="failed")return "failed";
  if(p.status==="uploading")return "uploading";
  if(p.edited)return "edited";
  if(p.verified||p.status==="published")return "uploaded";
  return p.status;
}
/** Existing remote themes, not attempts or historical receipt rows. */
export function publicationCounts(publications:Publication[]){
  const seen=new Set<string>();let published=0,uploaded=0;
  for(const p of publications){
    if(!p.themeId||!p.shop||!p.remoteRole||p.remoteRole==="missing")continue;
    const key=`${p.shop.toLowerCase()}:${p.themeId.split("/").at(-1)}`;
    if(seen.has(key))continue;
    const state=publicationState(p);
    if(state==="published"){seen.add(key);published++;}
    else if(state==="uploaded"||state==="edited"){seen.add(key);uploaded++;}
  }
  return {published,uploaded};
}
export function recordPublicationState(p:Publication,at=new Date().toISOString()){
  const state=publicationState(p);
  p.timeline??=[];
  if(!p.timeline.length&&p.verified)p.timeline.push({status:"uploaded",at:p.uploadedAt??p.createdAt});
  if(p.timeline.at(-1)?.status!==state)p.timeline.push({status:state,at});
  p.lifecycleStatus=state;
  if(state==="uploaded"&&!p.uploadedAt)p.uploadedAt=p.createdAt;
  if(state==="published"&&!p.publishedAt)p.publishedAt=at;
  if(state==="edited"&&!p.editedAt)p.editedAt=at;
  return p;
}
export function designUploadState(design:Design,publications:Publication[]):Design{
  const uploads=publications.filter(p=>p.designId===design.id&&(p.verified||p.status==="published"||p.livePublished===true));
  if(uploads.some(p=>p.livePublished))return {...design,status:"published"};
  if(uploads.some(p=>p.edited))return {...design,status:"edited"};
  if(uploads.length||["published","uploaded","edited"].includes(design.status))return {...design,status:"uploaded"};
  return design;
}
