import {test} from "node:test";
import assert from "node:assert/strict";
import {refreshMissingVariants} from "./source-refresh";
import {researchKey} from "./generation-workflow";
import {brand,product} from "./render-regression/fixtures";
import type {Run} from "./domain";
const p={...product,title:"Ceramic bowl",handle:"bowl",price:25,variants:[]};
const html=`<main><h1>Ceramic bowl</h1><form action="/api/cart"><input name="merchandiseId" value="gid://shopify/ProductVariant/25934"><button type="submit">Add to cart</button></form></main><script type="application/ld+json">{"@type":"Product","name":"Ceramic bowl","offers":{"price":"25","priceCurrency":"USD"}}</script>`;
const fixture=(price=25):Run=>({id:"refresh",url:p.sourceUrl,status:"failed",stage:"failed",createdAt:new Date().toISOString(),
  events:[],competitors:[],designs:[],learnings:[],product:{...structuredClone(p),price},brand,warnings:[]});
test("legacy IDs refresh without discarding reviewed copy or same-product research",async()=>{
  const run=fixture();run.warnings=["Product JSON unavailable: 404","Variant IDs could not be verified.","An unrelated warning"];
  run.researchKey=researchKey(run);
  assert.equal(await refreshMissingVariants(run,async()=>html),true);
  assert.equal(run.product!.variants[0]!.id,"gid://shopify/ProductVariant/25934");
  assert.equal(run.product!.description,p.description);
  assert.equal(run.researchKey,researchKey(run));
  assert.deepEqual(run.warnings,["An unrelated warning"]);
});
test("enrichment never replaces merchant price changes or guesses when the source cannot be read",async()=>{
  const run=fixture(30);
  assert.equal(await refreshMissingVariants(run,async()=>html),false);
  assert.equal(run.product!.price,30);
  assert.equal(await refreshMissingVariants(run,async()=>{throw new Error("Blocked");}),false);
  assert.equal(run.product!.variants.length,0);
});
