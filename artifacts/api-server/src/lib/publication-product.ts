import {AppError,type DesignContent,type Product} from "./domain";
import type {CliUploadInput,PublishingContext} from "@workspace/api-zod";
import {importDraft,mappedProduct,productFields,sourceIdentity,type ShopifyAdmin} from "./shopify-products";

export function destinationContent(source:Product,target:Product,content:DesignContent,sameSource:boolean,foreign:boolean):DesignContent{
  const result=structuredClone(content);
  if(!sameSource){
    Object.assign(result,{headline:target.title,subheading:target.description.slice(0,260),story:target.description,benefits:[],specs:{},
      faqs:[{question:`What is ${target.title}?`,answer:target.description||`${target.title} is offered by ${target.brand}.`}],
      sections:result.sections.filter(key=>!["benefits","specs","reviews"].includes(key))});
  }
  if(foreign){
    const policy=/return|refund|shipping|delivery|\bcod\b|guarantee/i;
    result.specs=Object.fromEntries(Object.entries(result.specs).filter(([key,value])=>!policy.test(`${key} ${value}`)));
    result.benefits=result.benefits.filter(item=>!policy.test(`${item.title} ${item.text}`));
    result.faqs=result.faqs.filter(f=>!policy.test(`${f.question} ${f.answer}`));
    result.sections=result.sections.filter(key=>key!=="reviews");
  }
  result.productSnapshot=target;
  return result;
}
export function validateDestination(options:CliUploadInput,context:PublishingContext){
  const mode=options.productMode??"none";
  if(mode==="source"&&!context.sameStore)throw new AppError(409,"The source is from a different store. Select a store product or explicitly import a draft copy.");
  if(mode==="existing"&&!options.productId)throw new AppError(400,"Choose a product in your connected store.");
  if(mode==="import"&&(!options.confirmProductImport||!context.canImport))throw new AppError(400,"Confirm your rights to import this product. The installed app must have write_products.");
  if(mode==="import"&&context.sourceCurrency!==context.currency&&!options.confirmCurrencyMismatch)throw new AppError(409,"Confirm keeping numeric prices in the destination currency; no conversion is performed.");
  if(mode==="none"&&options.confirmTemplateAssignment)throw new AppError(400,"Select a product before requesting template assignment.");
}
export async function preparePublicationProduct(admin:ShopifyAdmin,source:Product,content:DesignContent,runId:string,context:PublishingContext,options:CliUploadInput){
  validateDestination(options,context);
  const mode=options.productMode??"none";
  if(mode==="none")return null;
  let native:any,createdId:string|undefined;
  if(mode==="existing")native=(await admin(`query($id:ID!){product(id:$id){${productFields} templateSuffix}}`,{id:options.productId})).product;
  if(mode==="source")native=(await admin(`query($q:String!){products(first:3,query:$q){nodes{${productFields} templateSuffix}}}`,{q:`handle:${source.handle}`})).products.nodes.find((p:any)=>p.handle===source.handle);
  if(mode==="import")native=await importDraft(admin,source,runId,context.currency,!!options.confirmCurrencyMismatch,async p=>{createdId=p.id;});
  if(!native)throw new AppError(404,"The selected product no longer exists in the connected store.");
  const sameSource=(context.sameStore&&native.handle===source.handle)||native.metafield?.value===sourceIdentity(source.sourceUrl);
  const foreign=!context.sameStore&&sameSource;
  const product=mappedProduct(source,native,context.primaryDomain,context.currency,foreign);
  if(context.sameStore&&sameSource)Object.assign(product,{specs:source.specs,rating:source.rating,reviewCount:source.reviewCount,reviews:source.reviews});
  return {native,product,content:destinationContent(source,product,content,sameSource,foreign),createdId,imported:mode==="import"};
}
