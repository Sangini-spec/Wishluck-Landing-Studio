import {test} from "node:test";
import assert from "node:assert/strict";
import {storefrontAccess,storefrontPasswordKey} from "./storefront-access";
const shop="fixture.myshopify.com",url=`https://${shop}/products/test`;
test("storefront password is store scoped and never forwarded in a redirected body",async()=>{
  assert.equal(storefrontPasswordKey(shop),"SHOPIFY_STOREFRONT_PASSWORD_FIXTURE");
  const calls:{url:string;init:RequestInit}[]=[];
  const fake=(async(target:any,init:RequestInit={})=>{
    calls.push({url:String(target),init});
    if(String(target).endsWith("/password"))return new Response(null,{status:302,headers:{"Set-Cookie":"storefront_digest=fixture-cookie; Path=/; HttpOnly; Secure",Location:"/"}});
    return new Response("<form action='/cart/add'></form>",{status:200});
  }) as typeof fetch;
  const access=await storefrontAccess(shop,url,{SHOPIFY_STOREFRONT_PASSWORD_FIXTURE:"fixture-password",SHOPIFY_CLI_THEME_TOKEN_FIXTURE:"not-a-storefront-password"},fake);
  assert.equal(calls.length,1);assert.equal(calls[0].init.redirect,"manual");
  assert.equal(String(calls[0].init.body).includes("fixture-password"),true);
  await access.request(url);
  assert.equal(new Headers(calls[1].init.headers).get("Cookie"),"storefront_digest=fixture-cookie");
  assert.equal(calls[1].init.body,undefined);
  assert.equal(access.cookies()[0].domain,shop);
  await assert.rejects(access.request("https://unrelated.example/products/test"),/different origin/);
  assert.equal(calls.length,2);
});
test("another store's password never unlocks a different store",async()=>{
  let calls=0;
  const fake=(async()=>{calls++;return new Response("protected");}) as typeof fetch;
  const access=await storefrontAccess(shop,url,{SHOPIFY_STOREFRONT_PASSWORD_OTHER:"fixture-password"},fake);
  assert.equal(calls,0);assert.deepEqual(access.cookies(),[]);
});
test("cross-origin redirects cannot receive storefront cookies",async()=>{
  const fake=(async()=>new Response(null,{status:302,headers:{Location:"https://unrelated.example/"}})) as typeof fetch;
  const access=await storefrontAccess(shop,url,{},fake);
  await assert.rejects(access.request(url),/different origin/);
});
