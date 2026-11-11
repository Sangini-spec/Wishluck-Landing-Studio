import {test} from "node:test";
import assert from "node:assert/strict";
import {fingerprint,similarity,compare} from "./fingerprints";
import type {Brand,DesignContent} from "./domain";
import {planChoice} from "./design-plan";

const brand={shopifyHeadingFont:"assistant_n4",shopifyBodyFont:"assistant_n4"} as Brand;
const content={sections:["hero","gallery","story","benefits","faq"],composition:"atelier",imagePosition:"left",colorUse:"light",ctaPlacement:"hero-and-sticky",visualPlan:{
  family:"atelier",name:"Example",rationale:"Source-based",heroScale:"monumental",imageTreatment:"framed",colorStrategy:"light",
  contentRhythm:"spacious",typography:"editorial",detailLayout:"columns",alignment:"start",accentPlacement:"edge",sections:["hero","gallery","story","benefits","faq"],
}} as DesignContent;
test("identical render plans compare as identical, not novel",()=>{
  const a=fingerprint(content,brand);assert.equal(similarity(a,a),1);
  assert.equal(compare(a,[{id:"previous",fingerprint:a}]).uniqueness,0);
});
test("a new marketing name or rationale cannot inflate visual difference",()=>{
  const a=fingerprint(content,brand),b=fingerprint({...content,visualPlan:{...content.visualPlan!,name:"A different name",rationale:"Changed copy only"}},brand);
  assert.equal(similarity(a,b),1);
});
test("rendered typography treatment participates even when brand fonts stay fixed",()=>{
  const a=fingerprint(content,brand),b=fingerprint({...content,visualPlan:{...content.visualPlan!,typography:"technical"}},brand);
  assert.ok(similarity(a,b)<1);assert.equal(Math.round((1-similarity(a,b))*100),8);
});
test("changing family plus other rendered axes produces substantial measured difference",()=>{
  const a=fingerprint(content,brand),b=fingerprint({...content,composition:"mosaic",visualPlan:{...content.visualPlan!,family:"mosaic",heroScale:"compact",detailLayout:"bento",imageTreatment:"collage"}},brand);
  assert.ok(similarity(a,b)<.62);
});
test("novelty search samples all four remaining families, not one correlated index",()=>{
  const values=["kinetic","dossier","panorama","mosaic"];
  const sampled=new Set(Array.from({length:128},(_,j)=>planChoice(values,"stable-regression-seed",j,0)));
  assert.equal(sampled.size,4);
  assert.throws(()=>planChoice([],"seed",0,0),/No distinct/);
});
test("older fingerprints are compared using the layout they now actually render",()=>{
  const legacy={heroType:"editorial",colourUsage:"neutral",sectionOrder:content.sections};
  const journal={...content,visualPlan:{...content.visualPlan!,family:"journal",heroScale:"balanced",imageTreatment:"cutout",colorStrategy:"light",contentRhythm:"spacious",typography:"editorial",detailLayout:"columns",alignment:"start",accentPlacement:"rule"}} as DesignContent;
  assert.equal(similarity(fingerprint(journal,brand),legacy),1);
});
