import {load} from "cheerio";
import type {Brand,Check,Design,DesignContent,Product} from "./domain";
import {campaignBrief,plainText} from "./campaign-brief";
import {factValue} from "./facts";
import {preview} from "./preview";

/** Local evidence only: never a search ranking or external schema certification. */
export function checkDesign(design:Design,c:DesignContent,p:Product,brand:Brand|undefined=c.brandSnapshot){
  const checks:Check[]=[],brief=campaignBrief(p,brand);
  const check=(key:string,category:string,label:string,ok:boolean,detail:string)=>
    checks.push({key,category,label,status:ok?"passed":"failed",detail});
  const pending=(key:string,category:string,label:string,detail:string)=>
    checks.push({key,category,label,status:"unverified",detail});
  const normal=(value:string)=>plainText(value).toLowerCase().replace(/\s+/g," ").trim();
  let $:ReturnType<typeof load>|undefined;
  let schemas:Record<string,any>[]=[],jsonValid=true;
  try{
    if(brand){
      const document=load(preview(design,c,p,brand));$=document;
      document("script[type='application/ld+json']").each((_,element)=>{
        try{schemas.push(JSON.parse(document(element).text()));}catch{jsonValid=false;}
      });
    }
  }catch{jsonValid=false;}
  const rendered=(key:string,category:string,label:string,ok:boolean,detail:string)=>{
    if(!$)pending(key,category,label,"Local preview could not be inspected. "+detail);
    else check(key,category,label,ok,detail);
  };
  const body=$?.("body").clone();body?.find("script,style,noscript").remove();
  const text=body?normal(body.text()):"";
  const visibleFaq=$?$(".wl-q").toArray().map(element=>({
    question:normal($(element).find("summary").clone().find(".wl-item-n").remove().end().text()),
    answer:normal($(element).find(".wl-a p").toArray().map(paragraph=>$(paragraph).text()).join(" ")),
  })):[];
  const product=schemas.find(item=>item["@type"]==="Product"),faq=schemas.find(item=>item["@type"]==="FAQPage");
  rendered("h1","SEO","One non-empty H1 in local HTML",!!$&&$("h1").length===1&&!!$("h1").text().trim(),"Inspected generated preview HTML; final Shopify theme still needs its own audit.");
  let previous=0,ordered=true;
  $?.("h1,h2,h3,h4,h5,h6").each((_,element)=>{
    const level=Number(element.tagName.slice(1));if(previous&&level>previous+1)ordered=false;previous=level;
  });
  rendered("headings","SEO","Sequential heading hierarchy",ordered,"Local headings must not skip levels.");
  rendered("meta","SEO","Non-empty page title and description",!!$&&!!$("title").text().trim()&&!!$("meta[name='description']").attr("content")?.trim(),"Checked actual local head tags, not just source product fields.");
  rendered("alt","SEO","Product images have descriptive alt text",!!$&&$("img").length>0&&$("img").toArray().every(element=>!!$(element).attr("alt")?.trim()),"Every image in the local page must have a non-empty description.");
  rendered("canonical","SEO","Canonical points to the source product",!!$&&$("link[rel='canonical']").attr("href")===p.sourceUrl&&/^https:\/\//.test(p.sourceUrl),"Local preview identity only; destination-store canonical and metadata remain an external check.");
  rendered("collection","SEO","Related collection link is present",!!$&&!!p.collectionUrl&&$("a").toArray().some(element=>$(element).attr("href")===p.collectionUrl),"Add a verified collection URL in Product details. Destination-store links must be checked after upload.");
  rendered("product-schema","SEO","Product JSON-LD matches local product and price",jsonValid&&!!product&&product.name===p.title&&
    Number.isFinite(p.price)&&p.currency!=="XXX"&&Number(product?.offers?.price)===p.price&&product?.offers?.priceCurrency===p.currency,
    "Local JSON and source-value consistency only. Google Rich Results validation is separate.");
  rendered("faq","AEO","Useful FAQ answers are actually rendered",visibleFaq.length>=2&&visibleFaq.every(item=>!!item.question&&!!item.answer),
    "At least two real product questions with visible, non-empty answers; add verified product facts when information is missing.");
  rendered("faq-direct","AEO","Answers are concise and stand alone",visibleFaq.length>0&&visibleFaq.every(item=>item.answer.length<=700&&!/not (?:provided|verified|available) in (?:the )?source|cannot verify|refer to (?:the )?description/i.test(item.answer)),
    "Do not replace a useful answer with a source-data disclaimer or a pointer to another paragraph.");
  rendered("faq-schema","AEO","FAQ markup agrees with visible questions and answers",jsonValid&&!!faq&&Array.isArray(faq.mainEntity)&&faq.mainEntity.length===c.faqs.length&&
    visibleFaq.length===c.faqs.length&&faq.mainEntity.every((item:any,index:number)=>normal(item.name??"")===visibleFaq[index]?.question&&normal(item.acceptedAnswer?.text??"")===visibleFaq[index]?.answer),
    "Compared local JSON-LD with the FAQ content that was actually rendered. This is not external validation.");
  const grounded=c.faqs.length>0&&c.faqs.every(item=>brief.questions.some(source=>normal(source.answer)===normal(item.answer)));
  if(grounded)check("faq-evidence","AEO","FAQ answers trace to source or merchant facts",true,"Answers match the current design's saved factual product snapshot.");
  else pending("faq-evidence","AEO","FAQ answer grounding needs review","Legacy or paraphrased answers are not certified factual by their presence. Review the Product facts and regenerate to use source-backed answers.");
  const specEntries=Object.entries(brief.verifiedSpecs);
  rendered("specs","GEO","Verified specification table is visible",!!$&&$(".wl-sec-specs dl").length>0&&specEntries.length>0&&specEntries.every(([key,value])=>$(".wl-sec-specs dt").toArray().some(element=>normal($(element).text())===normal(key))&&text.includes(normal(value))),
    "Save verified product specifications, then regenerate; a hidden or omitted table does not count.");
  rendered("brand","GEO","Brand name agrees with Product markup",!!p.brand&&!!product&&product.brand?.name===p.brand&&text.includes(normal(p.brand)),"Brand must appear consistently in local content and structured data.");
  for(const [key,label]of [["material","Materials"],["dimension","Dimensions or capacity"],["contents","Package contents"],["audience","Intended audience"]] as const){
    const value=factValue(brief.verifiedSpecs,key);
    const sourceEntries=Object.entries(brief.verifiedSpecs).filter(([name])=>factValue({[name]:brief.verifiedSpecs[name]!},key));
    rendered(key,"GEO",`${label} are source-backed and visible`,!!value&&sourceEntries.every(([,v])=>text.includes(normal(v))),
      value?"The verified facts must appear in the page, not only in saved product data.":`Add verified ${label.toLowerCase()} in Product details; no facts were invented to raise this score.`);
  }
  const sections=c.visualPlan?.composition?.sections.map(section=>section.kind)??c.sections;
  check("campaign","CONTENT","Complete product campaign, not only a product description",brief.requiredSections.every(kind=>sections.includes(kind))&&sections.filter(kind=>["story","benefits","specs","gallery","reviews"].includes(kind)).length>=2&&!!c.story.trim()&&!!c.subheading.trim(),
    `Required for these facts: ${brief.requiredSections.join(", ")}. Each must contribute useful content and an obvious purchase journey.`);
  check("variants","CONTENT","Verified source price and variant identifiers",p.variants.length>0&&p.variants.every(v=>/^\d+$/.test(v.id))&&p.currency!=="XXX",
    "Source identifiers are needed for source-store cart tests. Importing into another store binds its own identifiers; real cart behaviour is verified separately.");
  pending("copy-grounding","CONTENT","Review narrative and benefit claims against source facts",
    "The campaign brief constrains the model, but automatic checks do not certify every paraphrased marketing claim. Review the story and benefits before approval; source-backed FAQ answers are checked separately.");
  pending("product-rich-results","EXTERNAL","Google Product Rich Results validation","Not externally validated. Valid local JSON does not certify Google's Rich Results Test.");
  pending("faq-rich-results","EXTERNAL","External FAQ structured-data validation","Not externally validated. Valid markup does not guarantee search-result eligibility.");
  pending("destination-seo","EXTERNAL","Destination-store canonical, metadata and internal links","Check the actual uploaded product URL; a source-store preview is not destination-store evidence.");
  pending("cart","EXTERNAL","Real Shopify cart on every variant","Must be tested on the actual store, on mobile and desktop. Local HTML inspection cannot submit a real Shopify cart.");
  pending("responsive","EXTERNAL","Actual theme at 360 / 768 / 1440 pixels","Local render regressions are development evidence, not a per-design Shopify browser acceptance test.");
  const lh=design.lighthouse;
  if(lh?.status==="completed"&&[lh.performance,lh.seo,lh.accessibility].every(Number.isFinite))
    check("lighthouse","EXTERNAL","Measured Lighthouse targets",lh.performance!>=85&&lh.seo!>=95&&lh.accessibility!>=90,
      `Measured mobile results: performance ${lh.performance}/85, SEO ${lh.seo}/95, accessibility ${lh.accessibility}/90. Tested ${lh.testedAt??"at an unrecorded time"}.`);
  else pending("lighthouse","EXTERNAL","Measured Lighthouse targets","No complete current result. Targets: performance 85+, SEO 95+, accessibility 90+. "+(lh?.error??""));
  const score=(category:string)=>{
    const group=checks.filter(item=>item.category===category);
    return group.length?Math.round(group.filter(item=>item.status==="passed").length/group.length*100):0;
  };
  const seo=score("SEO"),aeo=score("AEO"),geo=score("GEO");
  const local=checks.filter(item=>["SEO","AEO","GEO","CONTENT"].includes(item.category));
  return {checks,scores:{seo,aeo,geo,overall:Math.round(local.filter(item=>item.status==="passed").length/local.length*100)}};
}
