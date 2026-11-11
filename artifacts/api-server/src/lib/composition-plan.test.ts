import {test} from "node:test";
import assert from "node:assert/strict";
import {creativePlanSchema} from "./composition-plan";
import {composedVisualPlan} from "./design-plan";
import {composedFingerprint,compositionSimilarity} from "./composition-fingerprint";
import {fingerprint,compare} from "./fingerprints";
import {brand,content} from "./render-regression/fixtures";
import {creativePlanFixture as planFixture} from "./render-regression/composition-fixtures";
test("composed plans validate independent geometry and remain legacy-compatible",()=>{
  const creative=creativePlanSchema.parse(planFixture()),p=composedVisualPlan(creative);
  assert.deepEqual(p.sections,["hero","story","benefits","faq"]);
  assert.deepEqual(p.composition,creative.composition);
  assert.equal(p.family,"atelier","Compatibility field is not a chosen finished template");
  assert.throws(()=>creativePlanSchema.parse({...creative,composition:{...creative.composition,hero:{...creative.composition.hero,mediaShare:98}}}));
});
test("composition novelty excludes creative text and legacy family labels",()=>{
  const creative=planFixture(),a=composedVisualPlan(creative);
  const b={...a,name:"Different marketing name",rationale:"Renamed",family:"mosaic" as const,
    composition:{...a.composition!,sections:a.composition!.sections.map(s=>({...s,title:"Renamed section"}))}};
  assert.equal(compositionSimilarity(composedFingerprint(a),composedFingerprint(b)),1);
  assert.equal(fingerprint({...content(),visualPlan:a},brand).schemaVersion,3);
  assert.equal(compare(composedFingerprint(a),[{id:"saved",fingerprint:composedFingerprint(b)}]).uniqueness,0);
});
test("a mirror or a numeric adjustment alone cannot pass the novelty threshold",()=>{
  const a=composedVisualPlan(planFixture());
  const b=structuredClone(a);b.composition!.hero.mediaSide="right";b.headingSize=64;
  assert.ok(compositionSimilarity(composedFingerprint(a),composedFingerprint(b))>.9);
});
test("independent hero and section architecture creates substantial novelty, symmetrically",()=>{
  const a=composedVisualPlan(planFixture()),b=structuredClone(a);
  b.composition!.hero={...b.composition!.hero,layout:"rail",surface:"ink",imageRatio:"portrait",imageCount:3,mediaShare:70,contentWidth:"compact",alignment:"center"};
  b.composition!.sections=b.composition!.sections.reverse().map(s=>({...s,layout:"band",surface:"brand",headingPlacement:"center",columns:4,width:"full",spacing:96}));
  const left=composedFingerprint(a),right=composedFingerprint(b);
  assert.ok(compositionSimilarity(left,right)<.62);
  assert.equal(compositionSimilarity(left,right),compositionSimilarity(right,left));
  assert.ok(compositionSimilarity(left,right)>=0);
});
