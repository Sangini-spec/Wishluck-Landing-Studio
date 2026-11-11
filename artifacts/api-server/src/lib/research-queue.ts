import type {Competitor} from "./domain";
type Page={url:string;title:string;reason:string};
const host=(url:string)=>new URL(url).hostname.replace(/^www\./,"");
export function isCommerceReference(url:string){
  try{
    const u=new URL(url);
    return !/\/(?:blogs?|articles?|news|category)(?:\/|$)|d2c-brands|d2c-skincare-brands|brands-in-india|manufacturer/i.test(u.pathname);
  }catch{return false;}
}
/** Ranking chooses priority, not how many fallbacks can be tried. */
export function researchQueue(ranked:Page[],candidates:Page[],previous:Competitor[]){
  const seen=new Set(previous.filter(c=>c.status==="crawled"&&c.analysis).map(c=>host(c.url)));
  return [...ranked,...candidates].filter(page=>{
    if(!isCommerceReference(page.url))return false;
    const key=host(page.url);
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,24);
}
/** Retain prior captures only for the exact same reviewed product and brand. */
export function reusableCaptures(previous:Competitor[],sameInputs:boolean){
  return sameInputs?previous.filter(c=>c.status==="crawled"&&c.analysis&&isCommerceReference(c.url)):[];
}
