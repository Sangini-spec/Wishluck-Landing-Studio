import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import JSZip from "jszip";
import type { Brand, Design, DesignContent, Product } from "./domain";
import { trustFacts } from "./facts";

export const rootDir = existsSync(path.resolve(process.cwd(),"shopify")) ? process.cwd() : path.resolve(process.cwd(),"../..");
export const escapeHtml=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
export function contrastText(hex:string){
  const rgb=hex.replace("#","");
  if(!/^[0-9a-f]{6}$/i.test(rgb))return "#ffffff";
  const channels=[0,2,4].map(i=>{const s=parseInt(rgb.slice(i,i+2),16)/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);});
  return channels[0]!*.2126+channels[1]!*.7152+channels[2]!*.0722>.179?"#171717":"#ffffff";
}
const safeText=(v:string)=>v.replace(/\{%|\{\{/g,"").replace(/\u0000/g,"");
const rich=(v:string)=>`<p>${escapeHtml(safeText(v)).replace(/\n/g,"</p><p>")}</p>`;
const read=(name:string)=>readFileSync(path.join(rootDir,"shopify",name),"utf8");
function commonSettings() {
  return [
    {type:"checkbox",id:"show_section",label:"Show section",default:true},
    {type:"color",id:"primary",label:"Primary colour",default:"#174a36"},
    {type:"color",id:"secondary",label:"Secondary colour",default:"#e8eee8"},
    {type:"color",id:"background",label:"Background",default:"#ffffff"},
    {type:"color",id:"text_color",label:"Text colour",default:"#222222"},
    {type:"font_picker",id:"heading_font",label:"Heading font",default:"assistant_n4"},
    {type:"font_picker",id:"body_font",label:"Body font",default:"assistant_n4"},
    {type:"range",id:"heading_weight",label:"Heading weight",min:100,max:900,step:100,default:600},
    {type:"range",id:"body_weight",label:"Body weight",min:100,max:900,step:100,default:400},
    {type:"image_picker",id:"image",label:"Image"},
    {type:"text",id:"image_alt",label:"Image description"},
    {type:"text",id:"heading",label:"Heading"},
    {type:"range",id:"radius",label:"Corner radius",min:0,max:40,step:1,unit:"px",default:0},
    {type:"range",id:"spacing",label:"Vertical spacing",min:12,max:100,step:2,unit:"px",default:36},
    {type:"select",id:"color_use",label:"Colour usage",options:[{value:"neutral",label:"Neutral"},{value:"brand-hero",label:"Brand background"},{value:"brand-details",label:"Subtle brand"}],default:"neutral"},
  ];
}
function commonValues(b:Brand) {
  const hex=(s:string,fallback:string)=>/^#[0-9a-f]{6}$/i.test(s)?s:fallback;
  return {show_section:true,primary:hex(b.primary,"#222222"),secondary:hex(b.secondary,"#eeeeee"),background:hex(b.background,"#ffffff"),text_color:hex(b.text,"#222222"),
    heading_font:b.shopifyHeadingFont||"assistant_n4",body_font:b.shopifyBodyFont||"assistant_n4",
    radius:Math.min(40,Math.max(0,parseInt(b.radius)||0)),spacing:Math.round(Math.min(100,Math.max(12,parseInt(b.spacing)||36))/2)*2,
    heading_weight:Math.round(Math.max(100,Math.min(900,parseInt(b.headingWeight)||600))/100)*100,body_weight:Math.round(Math.max(100,Math.min(900,parseInt(b.bodyWeight)||400))/100)*100};
}
export function compile(design:Design,c:DesignContent,p:Product,b:Brand):Record<string,string>{
  const suffix=`wl-${design.id.slice(0,8)}`;
  const heroName=`${suffix}-hero`,contentName=`${suffix}-content`;
  const cssName=`${suffix}.css`,jsName=`${suffix}.js`;
  const heroSchema={name:"Wishluck product",tag:"section",settings:[
    ...commonSettings(),
    {type:"text",id:"brand_name",label:"Brand name"},
    {type:"richtext",id:"description",label:"Description"},
    {type:"color",id:"button_color",label:"Button colour",default:"#174a36"},
    {type:"color",id:"button_text",label:"Button text colour",default:"#ffffff"},
    {type:"color",id:"on_primary",label:"Text on brand background",default:"#ffffff"},
    {type:"range",id:"heading_size",label:"Heading size",min:30,max:80,step:1,unit:"px",default:56},
    {type:"range",id:"body_size",label:"Body size",min:12,max:24,step:1,unit:"px",default:16},
    {type:"text",id:"variant_label",label:"Variant label",default:"Variant"},
    {type:"text",id:"quantity_label",label:"Quantity label",default:"Qty"},
    {type:"text",id:"button_label",label:"Cart button label",default:"Add to cart"},
    {type:"text",id:"link_label",label:"Secondary link label",default:"Explore the collection"},
    {type:"url",id:"button_link",label:"Secondary link"},
    {type:"checkbox",id:"show_sticky",label:"Show mobile sticky cart",default:true},
    {type:"checkbox",id:"show_trust",label:"Show verified trust content",default:true},
    {type:"richtext",id:"trust_text",label:"Verified trust facts"},
    {type:"select",id:"composition",label:"Hero layout",options:["split","editorial","grid","purchase","reversed","framed","compact","panorama","inset","catalogue","feature","asymmetric"].map(v=>({value:v,label:v})),default:"split"},
    {type:"select",id:"image_position",label:"Image position",options:[{value:"left",label:"Left"},{value:"right",label:"Right"}],default:"left"},
  ],presets:[{name:"Wishluck product"}]};
  const contentSchema={name:"Wishluck content",tag:"section",settings:[
    ...commonSettings(),{type:"richtext",id:"body",label:"Body text"},
    {type:"select",id:"mode",label:"Content layout",options:[{value:"cards",label:"Cards"},{value:"faq",label:"FAQ"},{value:"specs",label:"Specifications"}],default:"cards"},
    {type:"checkbox",id:"show_button",label:"Show button",default:false},{type:"text",id:"button_label",label:"Button label",default:"Explore collection"},{type:"url",id:"button_link",label:"Button link"},
    {type:"color",id:"button_color",label:"Button colour",default:"#174a36"},{type:"color",id:"button_text",label:"Button text colour",default:"#ffffff"},
    {type:"select",id:"benefits_style",label:"Benefits presentation",options:[{value:"cards",label:"Grid"},{value:"stack",label:"Stacked"},{value:"editorial",label:"Editorial"}],default:"cards"},
  ],blocks:[{type:"item",name:"Editable item",settings:[{type:"text",id:"title",label:"Heading or question"},{type:"richtext",id:"body",label:"Text or answer"},{type:"image_picker",id:"image",label:"Image"}]}],max_blocks:30,presets:[{name:"Wishluck content"}]};
  const rating=p.rating&&p.reviewCount?`,"aggregateRating":${JSON.stringify({"@type":"AggregateRating",ratingValue:p.rating,reviewCount:p.reviewCount})}`:"";
  const hero=read("sections/wishluck-hero.liquid").replaceAll("WL_CSS",cssName).replaceAll("WL_JS",jsName).replace("WL_RATING",rating).replace("WL_SCHEMA",JSON.stringify(heroSchema));
  const content=read("sections/wishluck-content.liquid").replace("WL_SCHEMA",JSON.stringify(contentSchema));
  const base=commonValues(b);
  const productImage=p.images[0];
  const shopifyImage=productImage?.match(/\/files\/([^?]+)/)?.[1];
  const sections:Record<string,unknown>={
    hero:{type:heroName,settings:{...base,brand_name:safeText(p.brand),heading:safeText(c.headline),description:rich(c.subheading),button_color:b.button,button_text:contrastText(b.button),on_primary:contrastText(b.primary),image_alt:p.title,
      ...(shopifyImage?{image:`shopify://shop_images/${decodeURIComponent(shopifyImage)}`}:{ }),
      heading_size:Math.max(30,Math.min(80,parseInt(b.headingSize)||56)),body_size:Math.max(12,Math.min(24,parseInt(b.bodySize)||16)),
      variant_label:"Variant",quantity_label:"Qty",button_label:"Add to cart",link_label:"Explore the collection",...(p.collectionUrl?{button_link:p.collectionUrl}:{}),
      show_sticky:true,show_trust:trustFacts(p).length>0,trust_text:trustFacts(p).length?rich(trustFacts(p).join(" · ")):"",
      composition:c.composition==="grid"?"grid":c.composition,color_use:c.colorUse,image_position:c.imagePosition}},
  };
  const itemBlocks=(items:{title:string;text:string}[])=>Object.fromEntries(items.map((item,i)=>[`item${i}`,{type:"item",settings:{title:safeText(item.title),body:rich(item.text)}}]));
  for(const key of c.sections.filter(s=>s!=="hero")){
    const items=key==="benefits"?c.benefits:key==="specs"?Object.entries(c.specs).map(([title,text])=>({title,text})):key==="faq"?c.faqs.map(f=>({title:f.question,text:f.answer})):key==="reviews"?(p.reviews??[]).map(r=>({title:r.author,text:`${r.rating?`${r.rating} / 5 — `:""}${r.text}`})):[];
    sections[key]={type:contentName,settings:{...base,heading:({story:"The story",benefits:"Product details",specs:"Specifications",faq:"Questions, answered",reviews:"From our customers"} as Record<string,string>)[key]||key,
      body:key==="story"?rich(c.story):"",mode:key==="faq"?"faq":key==="specs"?"specs":"cards",color_use:c.colorUse,
      show_button:c.ctaPlacement==="hero-repeat-sticky"&&key==="benefits",button_label:"Choose your variant",button_link:"#wl-product-purchase",
      button_color:b.button,button_text:contrastText(b.button),benefits_style:c.composition.includes("grid")?"cards":c.composition.includes("editorial")?"editorial":"stack"},blocks:itemBlocks(items),block_order:items.map((_v,i)=>`item${i}`)};
  }
  return {
    [`sections/${heroName}.liquid`]:hero,[`sections/${contentName}.liquid`]:content,
    [`assets/${cssName}`]:read("assets/wishluck.css")+read("assets/wishluck-extra.css"),
    [`assets/${jsName}`]:read("assets/wishluck-cart.js"),
    [`templates/product.${suffix}.json`]:JSON.stringify({sections,order:c.sections},null,2),
  };
}
export async function zipDesign(files:Record<string,string>){
  const zip=new JSZip();
  for(const[name,content]of Object.entries(files))zip.file(name,content);
  zip.file("UPLOAD-INSTRUCTIONS.txt","Upload assets/, sections/, templates/ to a DUPLICATED or UNPUBLISHED Dawn theme. Assign this product template only after checking live-theme consequences. Source images from a different store must first be uploaded to your own Shopify files and selected in the native editor. Preview HTML is not Liquid execution. Verify cart, schema and Lighthouse on Shopify before use.");
  return zip.generateAsync({type:"nodebuffer"});
}
