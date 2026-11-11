import {test} from "node:test";
import assert from "node:assert/strict";
import {destinationContent,preparePublicationProduct,validateDestination} from "./publication-product";
import type {Product,DesignContent} from "./domain";
import type {CliUploadInput,PublishingContext} from "@workspace/api-zod";

const source={title:"Source shoe",handle:"shoe",sourceUrl:"https://source.example/products/shoe",description:"A wool shoe",brand:"Source",category:"Shoes",
  currency:"USD",price:80,specs:{Material:"Wool",Shipping:"Next day"},reviews:[],rating:null,reviewCount:null,images:["https://source.example/shoe.jpg"],
  variants:[{id:"foreign-id",title:"Small",price:80,available:true}],missingFacts:[]} as Product;
const content={headline:"Source promise",subheading:"Source subheading",story:"Source story",benefits:[{title:"Shipping",text:"Next day delivery"},{title:"Material",text:"Wool"}],
  faqs:[{question:"Delivery?",answer:"Next day"},{question:"Material?",answer:"Wool"}],specs:source.specs,sections:["hero","benefits","reviews","specs","faq"],composition:"editorial",imagePosition:"left",colorUse:"neutral",ctaPlacement:"hero",learningIds:[],generationMode:"source-only"} as DesignContent;
const context={shop:"target.myshopify.com",name:"Target",primaryDomain:"https://target.myshopify.com",currency:"USD",sourceHost:"source.example",sourceCurrency:"USD",sameStore:false,products:[],canImport:true} as PublishingContext;
const options={designId:"fixture",expectedShop:context.shop,confirmUnpublishedUpload:true,productMode:"existing",productId:"gid://shopify/Product/321"} as CliUploadInput;
test("unrelated selected products never retain source claims, images or variant IDs",async()=>{
  const native={id:options.productId,title:"Actual snowboard",handle:"board",vendor:"Actual",productType:"Snowboards",status:"ACTIVE",description:"Actual board description",
    images:{nodes:[{url:"https://target.myshopify.com/board.jpg"}]},variants:{nodes:[{id:"gid://shopify/ProductVariant/987",title:"Standard",price:"900",availableForSale:true}]},templateSuffix:""};
  let calls=0;
  const result=await preparePublicationProduct(async query=>{assert.ok(query.startsWith("query"));calls++;return {product:native};},source,content,"run",context,options);
  assert.equal(calls,1);assert.equal(result!.content.headline,native.title);
  assert.equal(result!.product.variants[0].id,"987");
  assert.deepEqual(result!.product.images,["https://target.myshopify.com/board.jpg"]);
  assert.deepEqual(result!.content.benefits,[]);assert.ok(!result!.content.sections.includes("reviews"));
  assert.equal(content.headline,"Source promise","generation evidence must not be overwritten");
});
test("foreign source imports exclude policies and retain genuine product facts",()=>{
  const result=destinationContent(source,source,content,true,true);
  assert.equal(result.specs.Material,"Wool");assert.equal(result.specs.Shipping,undefined);
  assert.ok(!result.benefits.some(item=>/shipping/i.test(item.title)));
  assert.ok(!result.faqs.some(item=>/delivery/i.test(item.question)));
  assert.ok(!result.sections.includes("reviews"));
});
test("draft import and global assignment require the correct explicit destination consent",()=>{
  assert.throws(()=>validateDestination({...options,productMode:"source"},context),/different store/);
  assert.throws(()=>validateDestination({...options,productMode:"import",confirmProductImport:false},context),/Confirm/);
  assert.throws(()=>validateDestination({...options,productMode:"none",confirmTemplateAssignment:true},context),/Select a product/);
  assert.throws(()=>validateDestination({...options,productMode:"import",confirmProductImport:true},{...context,currency:"INR"}),/numeric prices/);
});
