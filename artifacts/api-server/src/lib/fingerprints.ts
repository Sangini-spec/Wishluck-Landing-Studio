import type { Brand, Design, DesignContent } from "./domain";

export function fingerprint(content: DesignContent, brand: Brand) {
  return {
    sectionOrder:content.sections,heroType:content.composition,imagePosition:content.imagePosition,
    colourUsage:content.colorUse,ctaPlacement:content.ctaPlacement,
    typography:`${brand.shopifyHeadingFont}/${brand.shopifyBodyFont}`,
    benefitsPresentation: content.composition.includes("grid") ? "cards" : content.composition.includes("editorial") ? "editorial" : "stack",
    faqPosition:content.sections.indexOf("faq"),
    socialProofPlacement:content.sections.indexOf("reviews"),
  };
}
function sequenceSimilarity(a: string[], b: string[]) {
  const dp = Array.from({length:a.length+1},()=>new Array<number>(b.length+1).fill(0));
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++) dp[i]![j]=a[i-1]===b[j-1] ? dp[i-1]![j-1]!+1 : Math.max(dp[i-1]![j]!,dp[i]![j-1]!);
  return dp[a.length]![b.length]! / Math.max(a.length,b.length,1);
}
export function similarity(a: Record<string,unknown>, b: Record<string,unknown>) {
  const weights = {heroType:.30,imagePosition:.12,colourUsage:.12,ctaPlacement:.12,benefitsPresentation:.08,typography:.04,faqPosition:.02};
  let score = sequenceSimilarity((a.sectionOrder??[]) as string[],(b.sectionOrder??[]) as string[])*.20;
  for(const [key,weight] of Object.entries(weights)) if(a[key]===b[key])score+=weight;
  return Math.min(1,score);
}
export function compare(fp: Record<string,unknown>, previous: Design[]) {
  let highest=0,closest:string|null=null;
  for(const d of previous){const s=similarity(fp,d.fingerprint);if(s>highest){highest=s;closest=d.id;}}
  return {uniqueness:Math.round((1-highest)*100),comparedCount:previous.length,closestDesign:closest};
}
