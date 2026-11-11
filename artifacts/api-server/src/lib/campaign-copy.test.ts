import {test} from "node:test";
import assert from "node:assert/strict";
import {assertCustomerCopy,writeCampaignCopy} from "./campaign-copy";
import {brand,product} from "./render-regression/fixtures";
import type {Run} from "./domain";
import {z} from "zod";
const copy={headline:"Your everyday carry, considered",subheading:"A woven bag with adjustable straps.",story:"Take the woven Field Bag with you, with adjustable straps for your everyday carry.",benefits:[]};
test("actual cleanser failure text and section titles cannot reach a storefront",()=>{
  for(const text of ["A calm facial cleanser landing page with clear value","The campaign should help shoppers understand","The copy can position the cleanser","What the product page makes clear","The page immediately establishes identity","landing-page, clear text"]){
    assert.throws(()=>assertCustomerCopy({...copy,headline:text}),/design instructions/);
    assert.throws(()=>assertCustomerCopy(copy,[text]),/design instructions/);
  }
  assert.doesNotThrow(()=>assertCustomerCopy(copy,["Made for your everyday"]));
});
test("copywriter has no rejected-layout context and repairs only copy",async()=>{
  const run={id:"copy-test",product,brand,aiCost:0} as Run;
  let calls=0;
  const result=await writeCampaignCopy(run,0,async<T>(prompt:string,schema:z.ZodType<T>)=>{
    calls++;assert.ok(!prompt.includes("Saved page structures"));
    assert.ok(!prompt.includes("previous proposal"));
    return {value:schema.parse(calls===1?{...copy,headline:"A landing page for a bag"}:copy),estimatedCost:.01};
  });
  assert.equal(calls,2);assert.equal(result.headline,copy.headline);assert.equal(run.aiCost,.02);
});
