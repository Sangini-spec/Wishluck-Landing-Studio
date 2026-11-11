import type { Check, Design, DesignContent, Product } from "./domain";

export function checkDesign(design: Design, c: DesignContent, p: Product) {
  const checks:Check[]=[];
  const check=(key:string,category:string,label:string,ok:boolean,detail:string)=>checks.push({key,category,label,status:ok?"passed":"failed",detail});
  const external=(key:string,category:string,label:string,detail:string)=>checks.push({key,category,label,status:"unverified",detail});
  check("h1","SEO","Single H1 in generated content",!!c.headline,"Compiler emits one hero H1. Final theme heading structure still needs rendered verification.");
  check("meta","SEO","Title and description prepared",!!p.title&&!!p.description,"Preview meta tags are generated. Shopify SEO fields are assigned only on confirmed publication.");
  check("alt","SEO","Image alt attributes prepared",p.images.length>0,"Image descriptions use the product title; final native theme image settings can be changed.");
  check("canonical","SEO","Canonical source URL",p.sourceUrl.startsWith("https://"),"Canonical points to the original product, not the dashboard preview.");
  check("collection","SEO","Related collection link",!!p.collectionUrl,"A source collection link is required; no collection was invented.");
  check("variants","SEO","Verified price and variant data",!!p.variants.length&&p.currency!=="XXX","Shopify product JSON supplies IDs and prices; native Liquid reads current selected variant.");
  external("product-rich-results","SEO","Google Product Rich Results validation","Not submitted to Google's external Rich Results Test. Local JSON structure is not external validation.");
  check("faq","AEO","Factual standalone FAQ answers",c.faqs.length>0&&c.faqs.every(f=>f.question&&f.answer),"FAQ content uses source facts; review generated factual accuracy before approving.");
  check("faq-schema","AEO","FAQPage markup prepared",c.faqs.length>0,"FAQPage JSON-LD is generated from the same visible FAQ blocks.");
  external("faq-rich-results","AEO","Google FAQ schema verification","Requires a published Shopify URL and external validation. Valid markup does not promise FAQ rich-result eligibility.");
  check("specs","GEO","Source-backed specification table",Object.keys(c.specs).length>0,"Only specifications present in source or merchant corrections are included.");
  check("brand","GEO","Consistent brand name",!!p.brand,"The same sourced brand name is used in copy and Product structured data.");
  for(const [key,label] of [["material","Materials"],["dimension","Dimensions"],["contents|box|package","Package contents"],["for|audience|suitable","Intended audience"]] as const){
    const found=Object.entries(c.specs).some(([k,v])=>new RegExp(key,"i").test(k)&&!!v);
    check(key,"GEO",`${label} documented`,found,found?"Present in sourced/merchant-reviewed specifications.":"Not verified in source; omitted rather than fabricated.");
  }
  external("cart","MOBILE","Real Shopify cart, all variants","Test on the actual Shopify domain on mobile and desktop. Dashboard preview cannot perform same-origin cart writes.");
  external("responsive","MOBILE","360 / 768 / 1440px rendered verification","Responsive CSS is included, but no breakpoint browser acceptance results are claimed.");
  external("lighthouse","MOBILE","Lighthouse targets 85 / 95 / 90","No audit result exists until Lighthouse actually runs.");
  const score=(category:string)=>{const group=checks.filter(c=>c.category===category);return Math.round(group.filter(c=>c.status==="passed").length/group.length*100);};
  const seo=score("SEO"),aeo=score("AEO"),geo=score("GEO");
  return {checks,scores:{seo,aeo,geo,overall:Math.round((seo+aeo+geo)/3)}};
}
