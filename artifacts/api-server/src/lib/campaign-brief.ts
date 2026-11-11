import {load} from "cheerio";
import type {Brand,Product} from "./domain";
import {cleanProductSpecs,factFields,factValue,trustFacts,isKnownFact} from "./facts";

export const plainText=(value:string)=>{
  const $=load(value);$("script,style,noscript").remove();
  return $.root().text().replace(/\s+/g," ").trim();
};
export function campaignBrief(product:Product,brand?:Brand){
  const description=plainText(product.description);
  const specs:Record<string,string>=Object.fromEntries(Object.entries(cleanProductSpecs(product.specs))
    .map(([key,value])=>[plainText(key),plainText(value)]).filter(([key,value])=>key&&isKnownFact(value!)));
  const facts=factFields.map(field=>({...field,value:factValue(specs,field.id)}));
  const questions:{factKey:string;question:string;answer:string}[]=[];
  if(description)questions.push({factKey:"description",question:`What is ${product.title}?`,answer:description.length>650?`${description.slice(0,647).replace(/\s+\S*$/,"")}…`:description});
  for(const field of facts.filter(field=>field.value)){
    // Keep the answer wholly in merchant/source facts, not competitor claims.
    const answer=field.value.length<=700?field.value:field.value.slice(0,697).replace(/\s+\S*$/,"")+"…";
    questions.push({factKey:field.id,question:field.question,answer});
  }
  if(Number.isFinite(product.price)&&product.currency!=="XXX"){
    questions.push({factKey:"price",question:`How much does ${product.title} cost?`,answer:`The listed price is ${product.currency} ${Number(product.price).toFixed(2)}.`});
  }
  const requiredSections=["story","faq","purchase",...(Object.keys(specs).length?["specs"]:[])];
  return {
    objective:"A complete product campaign landing page that explains the value, answers factual purchase questions and earns an add-to-cart—not a short catalogue description.",
    product:{title:product.title,brand:product.brand,category:product.category,description,
      price:product.price,currency:product.currency,sourceUrl:product.sourceUrl,images:product.images},
    voice:brand?.tone??"Use the source brand's tone without inventing product claims.",
    verifiedSpecs:specs,
    verifiedTrust:trustFacts({...product,specs}),
    missingFacts:facts.filter(field=>!field.value).map(field=>field.label),
    questions:questions.slice(0,8),
    requiredSections,
    minimumExplanatorySections:2,
    supportedSections:[...requiredSections,"benefits",...(product.images.length>=2?["gallery"]:[]),...(product.reviews?.length?["reviews"]:[])],
    searchIntent:"Help a shopper understand what this product is, its actual characteristics, what is included and the verified purchase terms.",
    contentRules:[
      "Write a product-specific value proposition, not an explanation of the design or its data sources.",
      "Use an explanatory narrative and distinct factual benefits; avoid filler, unsupported comparisons and invented urgency.",
      "Present all verified specifications in an editable specification section.",
      "The source-backed FAQ answers below are inserted verbatim by the system; never fill missing policies with invented answers.",
      "Use only verified trust near purchase actions. A missing review or policy is not permission to invent one.",
      "Follow a coherent selling strategy grounded in research, with a repeat purchase action after substantive content.",
    ],
  };
}
