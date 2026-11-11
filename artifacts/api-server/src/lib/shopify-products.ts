import { AppError, type Product } from "./domain";

export type ShopifyAdmin=(query:string,variables?:Record<string,unknown>)=>Promise<any>;
export const productFields=`id title handle status vendor productType description descriptionHtml onlineStorePreviewUrl tags
  metafield(namespace:"wishluck",key:"source_url"){value}
  images(first:30){nodes{url altText}}
  variants(first:100){nodes{id title price compareAtPrice availableForSale}}`;
const esc=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);
export const sourceIdentity=(url:string)=>{const u=new URL(url);return `${u.origin}${u.pathname}`;};

export function mappedProduct(source:Product,target:any,shopUrl:string,currency:string,imported:boolean):Product{
  const specs=imported?Object.fromEntries(Object.entries(source.specs).filter(([key])=>!/deliver|return|refund|cod|guarantee|shipping/i.test(key))):{};
  return {...source,title:target.title,handle:target.handle,brand:target.vendor||source.brand,
    description:target.description||source.description,category:target.productType||source.category,
    sourceUrl:`${shopUrl}/products/${target.handle}`,currency,specs,
    price:Number(target.variants.nodes[0]?.price??0),
    compareAtPrice:target.variants.nodes[0]?.compareAtPrice?Number(target.variants.nodes[0].compareAtPrice):null,
    images:target.images.nodes.map((image:any)=>image.url),
    variants:target.variants.nodes.map((v:any)=>({id:v.id.split("/").pop(),title:v.title,price:Number(v.price),compareAtPrice:v.compareAtPrice?Number(v.compareAtPrice):null,available:v.availableForSale})),
    rating:null,reviewCount:null,reviews:[],collectionUrl:undefined};
}

export async function importDraft(admin:ShopifyAdmin,source:Product,runId:string,currency:string,confirmCurrency:boolean,onCreated:(product:any)=>Promise<void>){
  if(source.currency!==currency&&!confirmCurrency)throw new AppError(409,`Source prices are ${source.currency}, but your store uses ${currency}. Explicitly confirm keeping the numeric amounts; no exchange-rate conversion is performed.`);
  if(!source.variants.length&&source.price===undefined)throw new AppError(422,"Confirm a product price or genuine source variant prices before importing.");
  const variants=source.variants.length?source.variants:[{id:"source-default",title:"Default",price:source.price!,available:false}];
  if(variants.length>100)throw new AppError(422,"This import supports up to 100 source variants. Import larger catalogs in Shopify first.");
  if(variants.some(v=>!Number.isFinite(v.price)||v.price<0))throw new AppError(422,"Confirm valid source variant prices before importing.");
  const handle=`wl-${source.handle.toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,150)}-${runId.slice(0,8)}`;
  const existing=await admin(`query($q:String!){products(first:3,query:$q){nodes{${productFields}}}}`,{q:`handle:${handle}`});
  const found=existing.products.nodes.find((p:any)=>p.handle===handle&&p.metafield?.value===sourceIdentity(source.sourceUrl));
  if(found){
    if(found.variants.nodes.length!==variants.length)throw new AppError(409,`A previous draft import has incomplete variants. Review product ${found.id.split("/").pop()} in Shopify before retrying; no duplicate was created.`);
    return found;
  }
  const titles=variants.map((v,i)=>v.title.trim()||`Variant ${i+1}`);
  if(new Set(titles).size!==titles.length)throw new AppError(422,"Source variant titles are duplicated; correct them before importing.");
  const created=await admin(`mutation($product:ProductCreateInput!,$media:[CreateMediaInput!]){
    productCreate(product:$product,media:$media){product{id handle status} userErrors{field message}}
  }`,{product:{title:source.title,descriptionHtml:`<p>${esc(source.description).replace(/\n/g,"</p><p>")}</p>`,
    vendor:source.brand,productType:source.category,handle,status:"DRAFT",tags:["wishluck-import",`wishluck-run-${runId.slice(0,8)}`],
    productOptions:[{name:"Variant",values:titles.map(name=>({name}))}],
    metafields:[{namespace:"wishluck",key:"source_url",type:"url",value:sourceIdentity(source.sourceUrl)}]},
    media:source.images.slice(0,12).map(originalSource=>({originalSource,mediaContentType:"IMAGE",alt:source.title}))});
  const product=created.productCreate.product;
  if(product)await onCreated(product);
  if(created.productCreate.userErrors?.length)throw new AppError(422,created.productCreate.userErrors.map((e:any)=>e.message).join("; "));
  if(!product)throw new AppError(502,"Shopify did not return a created draft product.");
  const added=await admin(`mutation($productId:ID!,$variants:[ProductVariantsBulkInput!]!){
    productVariantsBulkCreate(productId:$productId,variants:$variants,strategy:REMOVE_STANDALONE_VARIANT){
      productVariants{id title price} userErrors{field message}
    }
  }`,{productId:product.id,variants:variants.map((v,i)=>({optionValues:[{optionName:"Variant",name:titles[i]}],
    price:v.price.toFixed(2),...(v.compareAtPrice&&v.compareAtPrice>v.price?{compareAtPrice:v.compareAtPrice.toFixed(2)}:{}),
    inventoryItem:{tracked:false},inventoryPolicy:"DENY"}))});
  if(added.productVariantsBulkCreate.userErrors?.length)throw new AppError(422,added.productVariantsBulkCreate.userErrors.map((e:any)=>e.message).join("; "));
  const fetched=await admin(`query($id:ID!){product(id:$id){${productFields}}}`,{id:product.id});
  if(fetched.product?.variants.nodes.length!==variants.length)throw new AppError(502,"Imported variant count could not be verified. The product remains a draft.");
  return fetched.product;
}
