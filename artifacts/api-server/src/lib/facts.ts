import type { Product } from "./domain";

export function trustFacts(p:Product){
  const facts:string[]=[];
  if(p.rating&&p.reviewCount)facts.push(`${p.rating} / 5 from ${p.reviewCount} source reviews`);
  for(const[label,value]of Object.entries(p.specs)){
    if(/^(delivery estimate|delivery timeline|cod availability|cod available|return policy|returns|guarantee)$/i.test(label)&&value.trim())facts.push(`${label}: ${value}`);
  }
  return facts;
}
export function missingFacts(p:Product){
  return ["Delivery estimate","COD availability","Return policy","Package contents","Materials","Dimensions","Intended audience"].filter(label=>{
    const pattern=label==="Materials"?/material/i:label==="Dimensions"?/dimension|width|height|depth/i:new RegExp(`^${label}$`,"i");
    return !Object.entries(p.specs).some(([key,value])=>pattern.test(key)&&value.trim());
  });
}
