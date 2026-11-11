import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { search, searchReady, searchProvider } from "./search";

const originalFetch=globalThis.fetch;
const originals={TAVILY_API_KEY:process.env.TAVILY_API_KEY,SEARCH_API_KEY:process.env.SEARCH_API_KEY,SEARCH_PROVIDER:process.env.SEARCH_PROVIDER};
afterEach(()=>{
  globalThis.fetch=originalFetch;
  for(const[key,value]of Object.entries(originals)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
function configured(){
  process.env.SEARCH_PROVIDER="tavily";
  process.env.TAVILY_API_KEY="unit-test-placeholder";
  delete process.env.SEARCH_API_KEY;
}
test("Tavily is the default and a missing credential makes no network request",async()=>{
  delete process.env.SEARCH_PROVIDER;delete process.env.TAVILY_API_KEY;delete process.env.SEARCH_API_KEY;
  assert.equal(searchProvider(),"tavily");assert.equal(searchReady(),false);
  globalThis.fetch=async()=>{throw new Error("Unexpected network request");};
  await assert.rejects(search("Indian footwear"),/not connected/);
});
test("basic search disables automatic upgrades and normalises actual result fields",async()=>{
  configured();
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,"https://api.tavily.com/search");
    assert.equal(init?.method,"POST");
    const body=JSON.parse(String(init?.body));
    assert.equal(body.search_depth,"basic");assert.equal(body.auto_parameters,false);
    assert.equal(body.include_answer,false);assert.equal(body.include_raw_content,false);
    return Response.json({results:[{url:"https://example.com/products/shoe",title:"Shoe",content:"Source snippet"},{url:"http://example.com/ignored",title:"Not HTTPS"}]});
  };
  assert.deepEqual(await search("Indian footwear"),[{url:"https://example.com/products/shoe",title:"Shoe",description:"Source snippet"}]);
});
test("usage limits stop search without retrying or switching paid providers",async()=>{
  configured();let requests=0;
  globalThis.fetch=async()=>{requests++;return new Response("Provider usage limit",{status:432});};
  await assert.rejects(search("Indian footwear"),/usage limit/);assert.equal(requests,1);
});
test("authentication errors never echo the provider response body",async()=>{
  configured();
  globalThis.fetch=async()=>new Response("sensitive upstream details",{status:401});
  await assert.rejects(search("Indian footwear"),error=>{
    assert.match((error as Error).message,/authentication failed/);
    assert.doesNotMatch((error as Error).message,/sensitive upstream/);return true;
  });
});
test("an invalid response does not become fabricated competitors",async()=>{
  configured();globalThis.fetch=async()=>Response.json({unexpected:[]});
  await assert.rejects(search("Indian footwear"),/invalid response/);
});
test("legacy paid providers are not called",async()=>{
  configured();process.env.SEARCH_PROVIDER="brave";
  globalThis.fetch=async()=>{throw new Error("Unexpected network request");};
  assert.equal(searchReady(),false);
  await assert.rejects(search("Indian footwear"),/no longer supported/);
});
