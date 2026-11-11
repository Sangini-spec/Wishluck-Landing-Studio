import {test} from "node:test";
import assert from "node:assert/strict";
import {researchQueue,reusableCaptures,isCommerceReference} from "./research-queue";
import type {Competitor} from "./domain";
const page=(n:number)=>({url:`https://brand${n}.example/products/cleanser`,title:"Cleanser",reason:"Relevant search result"});
test("blocked ranked choices do not remove provider fallback candidates",()=>{
  const candidates=Array.from({length:15},(_,n)=>page(n));
  assert.equal(researchQueue(candidates.slice(0,10),candidates,[]).length,15);
});
test("directories and editorial brand lists are not competitor storefront evidence",()=>{
  assert.equal(isCommerceReference("https://example.com/blogs/news/best-face-cleansers"),false);
  assert.equal(isCommerceReference("https://example.com/category/skin-care"),false);
  assert.equal(isCommerceReference(page(1).url),true);
});
test("seven prior captures survive retries and are not crawled again",()=>{
  const old:Competitor[]=Array.from({length:7},(_,n)=>({...page(n),id:`capture-${n}`,status:"crawled",analysis:{hero:"Product purchase area"},sections:[]}));
  assert.equal(reusableCaptures(old,true).length,7);
  assert.equal(reusableCaptures(old,false).length,0);
  assert.deepEqual(researchQueue([page(0),page(7)],[page(8)],old).map(p=>p.url),[page(7).url,page(8).url]);
});
