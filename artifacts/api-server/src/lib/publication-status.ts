import type {Publication,Design} from "./domain";
export function publicationState(p:Publication){
  if(p.livePublished===true)return "published";
  if(p.status==="failed")return "failed";
  if(p.status==="uploading")return "uploading";
  if(p.edited)return "edited";
  if(p.verified||p.status==="published")return "uploaded";
  return p.status;
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
