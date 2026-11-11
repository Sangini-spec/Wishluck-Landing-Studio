import {test} from "node:test";
import assert from "node:assert/strict";
import {discoverProducts,productLink} from "./product-discovery";

const root="https://fixture-shop.example/";
function services(fetcher:(url:string)=>Promise<Response>){
  return {validate:async(raw:string)=>new URL(raw),permit:async(_raw:string)=>{},fetch:fetcher,
    shop:()=>"",admin:async()=>{throw new Error("External stores must never use connected-store credentials.");}};
}
test("Store homepages discover real catalogue titles without choosing a product",async()=>{
  const calls:string[]=[];
  const result=await discoverProducts(root,services(async url=>{
    calls.push(url);return url.includes("products.json")?Response.json({products:[{handle:"alpha",title:"Real Alpha"},{handle:"beta",title:"Real Beta"}]}):
      new Response('<a href="/products/alpha?variant=7">Shop</a><a href="https://foreign.example/products/no">Not this store</a>');
  }));
  assert.deepEqual(result.products,[{url:root+"products/alpha",title:"Real Alpha"},{url:root+"products/beta",title:"Real Beta"}]);
  assert.equal(calls.length,2);assert.match(result.message,/Choose a product/);
});
test("Collection URLs use the matching catalogue and normalize collection product links",async()=>{
  const calls:string[]=[];
  const result=await discoverProducts(root+"collections/shoes",services(async url=>{
    calls.push(url);return url.includes("products.json")?Response.json({products:[]}):
      new Response('<a href="/collections/shoes/products/runner?variant=9">Runner</a><a href="/collections/shoes/products/runner">Runner</a>');
  }));
  assert.equal(result.products.length,1);assert.equal(result.products[0].url,root+"products/runner");
  assert.equal(calls[1],root+"collections/shoes/products.json?limit=24");
});
test("Only the connected store uses authorised catalogue access",async()=>{
  let fetched=false,adminReads=0;
  const dep=services(async()=>{fetched=true;throw new Error("Protected storefront");});
  const result=await discoverProducts(root,{...dep,shop:()=>"fixture-shop.example",admin:async()=>{adminReads++;return {products:{nodes:[{handle:"own",title:"Own product"}]}};}});
  assert.equal(adminReads,1);assert.equal(fetched,false);assert.equal(result.products[0].url,root+"products/own");
});
test("Password protection is explicit, never replaced with fabricated products",async()=>{
  let requests=0;
  await assert.rejects(()=>discoverProducts(root,services(async()=>{requests++;return new Response('<form action="/password"><input name="password"></form>');})),/password protected/);
  assert.equal(requests,1);
});
test("Disallowed crawling never issues a page or catalogue request",async()=>{
  let fetched=false;
  const dep=services(async()=>{fetched=true;return new Response("");});
  await assert.rejects(()=>discoverProducts(root,{...dep,permit:async()=>{throw new Error("Crawling is disallowed by robots.txt.");}}),/disallowed by robots/);
  assert.equal(fetched,false);
});
test("Validation happens before fetching or using store credentials",async()=>{
  let fetched=false;
  const dep=services(async()=>{fetched=true;return new Response("");});
  await assert.rejects(()=>discoverProducts("https://127.0.0.1/",{...dep,validate:async()=>{throw new Error("Private addresses are not allowed.");}}),/Private/);
  assert.equal(fetched,false);
});
test("Discovery deduplicates and bounds the catalogue; unsafe links are rejected",async()=>{
  assert.equal(productLink("http://fixture-shop.example/products/a",root),null);
  assert.equal(productLink("https://other.example/products/a",root),null);
  assert.equal(productLink("/products/a.js",root),null);
  assert.equal(productLink("/en/collections/shoes/products/runner?variant=1",root),root+"en/products/runner");
  const result=await discoverProducts(root,services(async url=>url.includes("products.json")?
    Response.json({products:Array.from({length:40},(_,i)=>({handle:`p-${i}`,title:`Product ${i}`}))}):new Response("Store")));
  assert.equal(result.products.length,24);
});
