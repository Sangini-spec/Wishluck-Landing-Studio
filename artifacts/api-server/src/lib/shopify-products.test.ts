import {test} from "node:test";
import assert from "node:assert/strict";
import {importDraft,mappedProduct} from "./shopify-products";
import type {Product} from "./domain";

const source:Product={title:"Source shoe",brand:"Source brand",handle:"source-shoe",category:"Shoes",description:"A <script>source</script> description.",
  currency:"USD",price:70,images:["https://example.com/shoe.png"],sourceUrl:"https://example.com/products/source-shoe?utm=test",
  variants:[{id:"external-1",title:"Size 8",price:70,available:true},{id:"external-2",title:"Size 9",price:75,available:false}],
  specs:{"Materials":"Cotton","Return policy":"Source-store returns"},missingFacts:[]};
const target={id:"gid://shopify/Product/200",title:source.title,handle:"wl-source-shoe-runid123",vendor:source.brand,productType:"Shoes",
  status:"DRAFT",description:"Actual store description",images:{nodes:[{url:"https://cdn.shopify.com/target.png"}]},
  variants:{nodes:source.variants.map((v,i)=>({id:`gid://shopify/ProductVariant/${300+i}`,title:v.title,price:String(v.price),compareAtPrice:null,availableForSale:false}))}};
test("currency mismatch is rejected before creating products or making API calls",async()=>{
  let calls=0;
  await assert.rejects(importDraft(async()=>{calls++;},source,"runid123","INR",false,async()=>{}),/No exchange-rate conversion/i);
  assert.equal(calls,0);
});
test("explicit import creates only a draft and receives real new variant IDs",async()=>{
  const calls:{query:string;variables:any}[]=[];let recorded=false;
  const admin=async(query:string,variables?:Record<string,unknown>)=>{
    calls.push({query,variables});
    if(query.includes("products(first:3"))return {products:{nodes:[]}};
    if(query.includes("productCreate("))return {productCreate:{product:{id:target.id,handle:target.handle,status:"DRAFT"},userErrors:[]}};
    if(query.includes("productVariantsBulkCreate("))return {productVariantsBulkCreate:{productVariants:target.variants.nodes,userErrors:[]}};
    return {product:target};
  };
  const imported=await importDraft(admin,source,"runid123","USD",false,async p=>{assert.equal(p.status,"DRAFT");recorded=true;});
  assert.equal(recorded,true);assert.equal(imported.id,target.id);
  const create=calls.find(c=>c.query.includes("productCreate("))!;
  assert.equal(create.variables.product.status,"DRAFT");
  assert.match(create.variables.product.descriptionHtml,/&lt;script&gt;/);
  const variants=calls.find(c=>c.query.includes("productVariantsBulkCreate("))!.variables.variants;
  assert.equal(variants[0].price,"70.00");assert.equal(variants[0].id,undefined);
  assert.equal(calls.some(c=>c.query.includes("publishablePublish")),false);
});
test("mapped draft uses store IDs and never copies foreign policies or ratings",()=>{
  const mapped=mappedProduct({...source,rating:5,reviewCount:99},target,"https://merchant.myshopify.com","USD",true);
  assert.equal(mapped.variants[0]!.id,"300");assert.equal(mapped.rating,null);
  assert.equal(mapped.specs.Materials,"Cotton");assert.equal(mapped.specs["Return policy"],undefined);
  assert.equal(new URL(mapped.sourceUrl).hostname,"merchant.myshopify.com");
});
