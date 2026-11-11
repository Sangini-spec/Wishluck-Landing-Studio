import {test} from "node:test";
import assert from "node:assert/strict";
import {researchThenGenerate,researchIsCurrent,researchKey} from "./generation-workflow";
import {validateInfluences} from "./research-evidence";
import {publicationState,recordPublicationState,designUploadState} from "./publication-status";
import {themeFileHash} from "./shopify-cli";
import {similarity} from "./fingerprints";
import type {Run,Publication,Design} from "./domain";

function fixture(count=0){
  return {id:"workflow-fixture",product:{title:"Ceramic cup"},brand:{headingFont:"Georgia"},competitors:Array.from({length:count},(_,i)=>({status:"crawled",url:`https://reference${i}.example/cup`,analysis:{hero:"Large image with concise purchase panel"},sections:["hero","benefits","faq"]})),events:[]} as unknown as Run;
}
test("confirmation researches before generation and passes captured evidence",async()=>{
  const run=fixture(),calls:string[]=[];
  await researchThenGenerate(run,false,{searchReady:()=>true,research:async r=>{calls.push("research");r.competitors=fixture(8).competitors;},generate:async r=>{calls.push("generate");assert.equal(r.competitors.length,8);}});
  assert.deepEqual(calls,["research","generate"]);
});
test("current research is reused, but corrections and explicit refresh trigger fresh research",async()=>{
  const run=fixture(8);run.researchKey=researchKey(run);
  let researches=0,generations=0;
  const services={searchReady:()=>true,research:async(r:Run)=>{researches++;r.researchKey=researchKey(r);},generate:async()=>{generations++;}};
  assert.ok(researchIsCurrent(run));
  await researchThenGenerate(run,false,services);assert.equal(researches,0);
  run.product!.title="New product";
  assert.equal(researchIsCurrent(run),false);
  await researchThenGenerate(run,false,services);
  await researchThenGenerate(run,true,services);
  assert.equal(researches,2);assert.equal(generations,3);
});
test("research identity survives JSON storage property reordering",()=>{
  const run=fixture(8);run.product!.specs={Materials:"Ceramic",Capacity:"200 ml"};
  run.researchKey=researchKey(run);
  run.product=Object.fromEntries(Object.entries(run.product!).reverse()) as typeof run.product;
  run.product!.specs={Capacity:"200 ml",Materials:"Ceramic"};
  assert.equal(researchIsCurrent(run),true);
  run.product!.specs.Capacity="300 ml";
  assert.equal(researchIsCurrent(run),false);
});
test("insufficient captures or missing search never generate a fallback",async()=>{
  const run=fixture();let generated=false;
  const services={searchReady:()=>true,research:async(r:Run)=>{r.competitors=fixture(7).competitors;},generate:async()=>{generated=true;}};
  await assert.rejects(researchThenGenerate(run,false,services),/7 of the required 8/);
  await assert.rejects(researchThenGenerate(run,false,{...services,searchReady:()=>false}),/required before design generation/);
  assert.equal(generated,false);
});
test("research application rejects invented references and one-source boilerplate",()=>{
  const run=fixture(8);
  const influence={sourceUrl:run.competitors[0]!.url,observation:"A compact purchase panel",application:"Use a compact left-aligned hero",planFields:["heroScale"] as ["heroScale"]};
  assert.throws(()=>validateInfluences(run,[influence,influence]),/at least two/);
  assert.throws(()=>validateInfluences(run,[influence,{...influence,sourceUrl:"https://invented.example"}]),/actually captured/);
  assert.doesNotThrow(()=>validateInfluences(run,[influence,{...influence,sourceUrl:run.competitors[1]!.url}]));
});
test("successful upload is not live publication; native role and detected edits drive timestamped states",()=>{
  const p={id:"p",designId:"d",title:"Cup",status:"published",verified:true,createdAt:"2026-01-01T00:00:00Z",uploadedAt:"2026-01-01T00:01:00Z"} as Publication;
  recordPublicationState(p);assert.equal(publicationState(p),"uploaded");
  assert.equal(p.timeline![0]!.at,p.uploadedAt);
  p.edited=true;recordPublicationState(p,"2026-01-01T00:02:00Z");
  assert.equal(p.lifecycleStatus,"edited");assert.equal(p.editedAt,"2026-01-01T00:02:00Z");
  recordPublicationState(p,"2026-01-01T00:03:00Z");assert.equal(p.timeline!.length,2);
  p.livePublished=true;recordPublicationState(p,"2026-01-01T00:04:00Z");
  assert.equal(p.lifecycleStatus,"published");assert.equal(p.publishedAt,"2026-01-01T00:04:00Z");
  p.livePublished=false;recordPublicationState(p,"2026-01-01T00:05:00Z");assert.equal(p.lifecycleStatus,"edited");
  assert.equal(designUploadState({id:"d",status:"approved"} as Design,[p]).status,"edited");
  assert.equal(designUploadState({id:"old",status:"published"} as Design,[]).status,"uploaded");
});
test("theme edit fingerprints ignore Shopify serialization, but detect real settings and section edits",()=>{
  assert.equal(themeFileHash("templates/index.json",'{"sections":{"hero":{"type":"hero","blocks":{},"block_order":[]}},"order":["hero"]}'),themeFileHash("templates/index.json",'/* Shopify header */\n{"order":["hero"],"sections":{"hero":{"type":"hero"}}}'));
  assert.notEqual(themeFileHash("config/settings_data.json",'{"current":{"heading_size":40}}'),themeFileHash("config/settings_data.json",'{"current":{"heading_size":48}}'));
});
test("a real visual axis change contributes to novelty while identical plans remain identical",()=>{
  const fp={schemaVersion:2,designFamily:"atelier",heroScale:"balanced",imageTreatment:"cutout",colorStrategy:"light",contentRhythm:"spacious",typeTreatment:"display",detailLayout:"tiles",alignment:"start",accentPlacement:"edge",sectionOrder:["hero","story","faq"]};
  assert.equal(similarity(fp,fp),1);
  assert.ok(similarity(fp,{...fp,imageTreatment:"collage"})<1);
});
