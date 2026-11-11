import type { Product } from "./domain";

export function isProductFact(label:string,value:string){
  return !/^(identifiers|financial information|commercial information)$/i.test(label.trim())&&!/personal information|privacy policy|cookie identifiers|cookie preferences|ccpa|gdpr|psychographic inferences|payment information.*credit card|inferences drawn from|geolocation data|electronic network activity information/i.test(`${label} ${value}`);
}
export const cleanProductSpecs=(specs:Record<string,string>)=>Object.fromEntries(Object.entries(specs).filter(([label,value])=>isProductFact(label,value)));
export const isKnownFact=(value:string)=>!!value.trim()&&!/^(?:unknown|unverified|not (?:provided|specified|disclosed)|tbd|n\/a)(?:[.\s:]|$)|^[-—]+$/i.test(value.trim());

export const factFields=[
  {id:"material",label:"Materials",pattern:/material|fabric|composition/i,question:"What is it made from?"},
  {id:"dimension",label:"Dimensions",pattern:/dimension|measurement|size chart|width|height|depth|capacity/i,question:"What are its dimensions or capacity?"},
  {id:"contents",label:"Package contents",pattern:/package contents|box contents|what.?s included|included items|in the box|pack contents/i,question:"What is included?"},
  {id:"audience",label:"Intended audience",pattern:/intended audience|intended use|suitable for|designed for/i,question:"Who or what is it designed for?"},
  {id:"care",label:"Care instructions",pattern:/care|washing|cleaning/i,question:"How should I care for it?"},
  {id:"delivery",label:"Delivery estimate",pattern:/delivery estimate|delivery timeline|shipping time/i,question:"What is the delivery estimate?"},
  {id:"returns",label:"Return policy",pattern:/return policy|returns/i,question:"What is the return policy?"},
  {id:"cod",label:"COD availability",pattern:/cod availability|cod available|cash on delivery/i,question:"Is cash on delivery available?"},
] as const;
export function factValue(specs:Record<string,string>,id:typeof factFields[number]["id"]){
  const definition=factFields.find(field=>field.id===id)!;
  return Object.entries(cleanProductSpecs(specs)).filter(([key,value])=>definition.pattern.test(key)&&isKnownFact(value))
    .map(([key,value])=>`${key}: ${value.trim()}`).join("; ");
}

export function trustFacts(p:Product){
  const facts:string[]=[];
  if(p.rating&&p.reviewCount)facts.push(`${p.rating} / 5 from ${p.reviewCount} source reviews`);
  for(const[label,value]of Object.entries(p.specs)){
    if(/^(delivery estimate|delivery timeline|cod availability|cod available|return policy|returns|guarantee)$/i.test(label)&&value.trim())facts.push(`${label}: ${value}`);
  }
  return facts;
}
export function missingFacts(p:Product){
  return factFields.filter(field=>field.id!=="care"&&!factValue(p.specs,field.id)).map(field=>field.label);
}
