import {test} from "node:test";
import assert from "node:assert/strict";
import {generate} from "./generation";
import {brand,product,content,design} from "./render-regression/fixtures";
import type {Run} from "./domain";
test("partial batches resume at the next design, while completed batches can start afresh",async()=>{
  const t="2026-11-11T12:00:00Z",c={...content(),productSnapshot:product,brandSnapshot:brand};
  const run={id:"resume",product,brand,events:[{stage:"retrieving_memory",at:t,message:"Reading memory"}],designs:[{...design,id:"saved",createdAt:t}],status:"failed"} as unknown as Run;
  const indices:number[]=[];
  const services={getDesign:async()=>({content:c}) as Awaited<ReturnType<typeof import("./store").getDesign>>,generateOne:async(_r:Run,n:number)=>{indices.push(n);return design;},event:async(r:Run,stage:string,message:string)=>{r.events.push({stage,message,at:"2026-11-11T12:01:00Z"});}};
  await generate(run,services);assert.deepEqual(indices,[1,2,3]);assert.equal(run.status,"ready");
  indices.length=0;await generate(run,services);assert.deepEqual(indices,[0,1,2,3]);
});
test("old strategy text never counts toward completing a batch",async()=>{
  const t="2026-11-11T12:00:00Z";
  const run={id:"bad-copy",product,brand,events:[{stage:"retrieving_memory",at:t,message:"Memory"}],designs:[{...design,createdAt:t}]} as unknown as Run;
  const indices:number[]=[];
  await generate(run,{getDesign:async()=>({content:{...content(),headline:"A facial cleanser landing page",productSnapshot:product,brandSnapshot:brand}}) as Awaited<ReturnType<typeof import("./store").getDesign>>,generateOne:async(_r,n)=>{indices.push(n);return design;},event:async()=>{}});
  assert.deepEqual(indices,[0,1,2,3]);
});
