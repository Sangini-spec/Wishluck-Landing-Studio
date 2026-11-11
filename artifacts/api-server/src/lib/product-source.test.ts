import {test} from "node:test";
import assert from "node:assert/strict";
import {normaliseProductJson,productFromHtml} from "./product-source";
const source={name:"Yellow Ceramic Treat Bowl",brand:{name:"Paw & Clay"},description:"A ceramic treat bowl.",offers:{price:"25.00",priceCurrency:"USD"},image:["https://example.com/bowl.jpg"]};
const html=(id:string,disabled="")=>`<main><h1>Yellow Ceramic Treat Bowl</h1><form action="/api/cart" method="post"><input name="merchandiseId" value="${id}"><button type="submit" ${disabled}>Add to cart</button></form></main>`;
test("Hydrogen purchase forms expose real GraphQL variant identifiers without an Ajax product endpoint",()=>{
  const data=productFromHtml(html("gid://shopify/ProductVariant/25934"),"yellow-bowl",source);
  assert.equal(data.headless,true);
  assert.deepEqual(data.raw.variants,[{id:"gid://shopify/ProductVariant/25934",title:"Selected option",price:2500,available:true}]);
  assert.equal(data.raw.currency,"USD");
});
test("form parsing never substitutes SKUs, scripts, unrelated forms or guesses for variant IDs",()=>{
  assert.equal(productFromHtml(html("SKU-YELLOW"),"yellow-bowl",source).raw,undefined);
  assert.equal(productFromHtml(html("gid://shopify/ProductVariant/25934").replace("/api/cart","/newsletter"),"yellow-bowl",source).raw,undefined);
  assert.equal(productFromHtml(html("gid://shopify/ProductVariant/25934"),"yellow-bowl",{...source,offers:{}}).raw,undefined);
  assert.equal(productFromHtml(html("gid://shopify/ProductVariant/25934","disabled"),"yellow-bowl",source).raw.variants[0].available,false);
});
test("classic Ajax cents, public JSON decimal prices and embedded Storefront money stay consistent",()=>{
  assert.equal(normaliseProductJson({title:"Bowl",variants:[{id:123,price:2500,available:true}]}).variants[0].price,2500);
  assert.equal(normaliseProductJson({product:{title:"Bowl",variants:[{id:123,price:"25.00"}]}},true).variants[0].price,2500);
  const h=`<script type="application/json">${JSON.stringify({product:{handle:"yellow-bowl",title:"Bowl",variants:{nodes:[{id:"gid://shopify/ProductVariant/123",price:{amount:"25.00",currencyCode:"USD"},availableForSale:true}]}}})}</script>`;
  assert.equal(productFromHtml(h,"yellow-bowl",source).raw.variants[0].price,2500);
});
test("missing, blank or invalid prices never become invented zero-price products",()=>{
  for(const price of [null,""," ",true,-1]){
    assert.equal(productFromHtml(html("gid://shopify/ProductVariant/25934"),"yellow-bowl",{...source,offers:{price,priceCurrency:"USD"}}).raw,undefined);
    assert.equal(normaliseProductJson({title:"Bowl",variants:[{id:123,price}]}).variants.length,0);
  }
  assert.equal(productFromHtml(html("gid://shopify/ProductVariant/25934"),"yellow-bowl",{...source,offers:{price:0,priceCurrency:"USD"}}).raw.variants[0].price,0);
});
