import {test} from "node:test";
import assert from "node:assert/strict";
import {groupByLane,laneOf,lighthouseMetrics,lighthouseState,readinessLabel,sortChecks,tally} from "../src/lib/evidence";
import type {Check} from "@workspace/api-client-react";

const ck=(key:string,category:string,status:Check["status"]):Check=>({key,category,label:key,status,detail:""});

test("Categories map to separate evidence lanes",()=>{
  assert.equal(laneOf("SEO"),"internal");assert.equal(laneOf("aeo"),"internal");assert.equal(laneOf("GEO"),"internal");
  assert.equal(laneOf("EXTERNAL"),"external");assert.equal(laneOf("CONTENT"),"content");assert.equal(laneOf("misc"),"other");
  const g=groupByLane([ck("a","EXTERNAL","unverified"),ck("b","SEO","passed")]);
  assert.equal(g.external.length,1);assert.equal(g.internal.length,1);
});
test("Pending stays pending and failed sorts first",()=>{
  const cs=[ck("p","EXTERNAL","passed"),ck("u","EXTERNAL","unverified"),ck("f","CONTENT","failed")];
  assert.deepEqual(sortChecks(cs).map(c=>c.key),["f","u","p"]);
  assert.deepEqual(tally(cs),{passed:1,failed:1,unverified:1,total:3});
});
test("Lighthouse numbers are never inferred",()=>{
  assert.equal(lighthouseState(undefined),"none");
  assert.equal(lighthouseState({status:"running"}),"running");
  assert.equal(lighthouseState({status:"failed",error:"x",performance:99}),"failed");
  assert.ok(lighthouseMetrics({status:"failed",error:"x",performance:99}).every(m=>m.value===null&&m.meets===null));
  const m=lighthouseMetrics({status:"completed",performance:84,seo:95,accessibility:91});
  assert.deepEqual(m.map(x=>x.meets),[false,true,true]);
  assert.deepEqual(m.map(x=>x.target),[85,95,90]);
});
test("Gallery labels scores as content readiness",()=>{
  assert.equal(readinessLabel(72.4),"Content readiness 72/100");
});
