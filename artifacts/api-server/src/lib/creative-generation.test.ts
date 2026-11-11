import {test} from "node:test";
import assert from "node:assert/strict";
import {z} from "zod";
import {planResearchDesign} from "./creative-generation";
import {creativePlanFixture as planFixture} from "./render-regression/composition-fixtures";
import {brand,product,content,design} from "./render-regression/fixtures";
import type {Run} from "./domain";
import {fingerprint} from "./fingerprints";
import {composedVisualPlan} from "./design-plan";

function runFixture(){
  return {id:"creative-fixture",brand,product:structuredClone(product),learnings:[],aiCost:0,
    competitors:Array.from({length:8},(_,i)=>({status:"crawled",url:`https://reference${i}.example/product`,analysis:{hero:"Generous product inspection",media:"Large image before a compact purchase panel"},sections:["hero","story","faq"]}))} as unknown as Run;
}
function response(run:Run){
  const c=content();
  return {headline:"An honest object",subheading:c.subheading,story:c.story,benefits:c.benefits,faqs:c.faqs,
    visualPlan:planFixture(),researchInfluences:[0,1].map(i=>({sourceUrl:run.competitors[i]!.url,observation:"A restrained purchase panel beside large product imagery.",application:"Split the hero into media and a concise purchase column.",planFields:["composition"]}))};
}
const emptyContext={designs:[],learnings:[],feedback:[]};
test("AI planning consumes every captured reference and persists their applied decisions",async()=>{
  const run=runFixture(),copy=response(run);let calls=0;
  const ask=async<T>(prompt:string,schema:z.ZodType<T>)=>{
    calls++;
    for(const source of run.competitors)assert.ok(prompt.includes(source.url));
    assert.match(prompt,/NO finished page families/);
    return {value:schema.parse(copy),estimatedCost:.01};
  };
  const result=await planResearchDesign(run,0,content(),emptyContext,ask);
  assert.equal(calls,1);assert.equal(result.content.composition,"composed");
  assert.equal(result.content.visualPlan?.composition?.sections.length,3);
  assert.equal(result.influences.length,2);assert.equal(run.aiCost,.01);
});
test("invented references are rejected, never replaced with a preset",async()=>{
  const run=runFixture(),copy=response(run);copy.researchInfluences[0]!.sourceUrl="https://invented.example/product";
  let calls=0;
  const ask=async<T>(_prompt:string,schema:z.ZodType<T>)=>{calls++;return {value:schema.parse(copy),estimatedCost:0};};
  await assert.rejects(planResearchDesign(run,0,content(),emptyContext,ask),/No new|unchanged|saved designs are unchanged/);
  assert.equal(calls,3);
});
test("repetitive composed pages are rejected after bounded, research-led repair attempts",async()=>{
  const run=runFixture(),copy=response(run);
  const first=await planResearchDesign(run,0,content(),emptyContext,async<T>(_prompt:string,schema:z.ZodType<T>)=>({value:schema.parse(copy),estimatedCost:0}));
  const previous={...emptyContext,designs:[{...design,id:"saved",fingerprint:fingerprint(first.content,brand)}]};
  let calls=0;
  const ask=async<T>(prompt:string,schema:z.ZodType<T>)=>{calls++;if(calls>1)assert.match(prompt,/previous proposal was rejected/);return {value:schema.parse(copy),estimatedCost:0};};
  await assert.rejects(planResearchDesign(run,1,content(),previous,ask),/too similar|unchanged/);
  assert.equal(calls,3);
});
test("unavailable galleries or source reviews cannot become fabricated content sections",async()=>{
  const run=runFixture(),copy=response(run);
  copy.visualPlan.composition.sections[0]!.kind="reviews";
  run.product!.reviews=[];
  const ask=async<T>(_prompt:string,schema:z.ZodType<T>)=>({value:schema.parse(copy),estimatedCost:0});
  await assert.rejects(planResearchDesign(run,0,content(),emptyContext,ask),/unchanged/);
});
test("repair feedback identifies the exact nearest rendered structure",async()=>{
  const run=runFixture(),copy=response(run),previous=content();
  previous.visualPlan=composedVisualPlan({...copy.visualPlan,composition:{
    ...copy.visualPlan.composition,hero:{...copy.visualPlan.composition.hero,layout:"stack"},
  }});
  const context={...emptyContext,designs:[{...design,id:"nearest",fingerprint:fingerprint(previous,brand)}]};
  let calls=0;
  const ask=async<T>(prompt:string,schema:z.ZodType<T>)=>{
    calls++;
    if(calls>1)assert.match(prompt,/Closest rendered design:.*"layout":"stack"/);
    return {value:schema.parse(copy),estimatedCost:0};
  };
  await assert.rejects(planResearchDesign(run,1,content(),context,ask),/too similar/);
  assert.equal(calls,3);
});
