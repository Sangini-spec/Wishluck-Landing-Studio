import {test} from "node:test";
import assert from "node:assert/strict";
import {customAdmin} from "./shopify-auth";

test("store tokens stay scoped to their verified domain and failures do not expose provider responses",async()=>{
  // Fixture values are private to this test process, never workspace settings.
  process.env.SHOPIFY_CLIENT_ID="fixture-client";
  process.env.SHOPIFY_CLIENT_SECRET="fixture-secret";
  process.env.SHOPIFY_SHOP_DOMAIN="fixture-a.myshopify.com";
  const original=globalThis.fetch,authCalls=new Map<string,number>();
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));
    if(url.hostname==="fixture-denied.myshopify.com")return new Response("do not echo this response",{status:401});
    if(url.pathname.endsWith("/access_token")){
      authCalls.set(url.hostname,(authCalls.get(url.hostname)??0)+1);
      return Response.json({access_token:`fixture:${url.hostname}`,expires_in:3600});
    }
    assert.equal((init?.headers as Record<string,string>)["X-Shopify-Access-Token"],`fixture:${url.hostname}`);
    return Response.json({data:{shop:{myshopifyDomain:url.hostname}}});
  };
  try{
    await Promise.all([customAdmin("query{}",{},0,"fixture-a.myshopify.com"),customAdmin("query{}",{},0,"fixture-a.myshopify.com"),customAdmin("query{}",{},0,"fixture-b.myshopify.com")]);
    await customAdmin("query{}",{},0,"fixture-a.myshopify.com");
    assert.equal(authCalls.get("fixture-a.myshopify.com"),1);assert.equal(authCalls.get("fixture-b.myshopify.com"),1);
    await assert.rejects(customAdmin("query{}",{},0,"fixture-denied.myshopify.com"),error=>error instanceof Error&&/authentication failed/.test(error.message)&&!error.message.includes("echo this"));
    await assert.rejects(customAdmin("query{}",{},0,"external.example"),/valid myshopify/);
  }finally{globalThis.fetch=original;}
});
