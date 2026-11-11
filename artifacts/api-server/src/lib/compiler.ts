import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import JSZip from "jszip";
import type { Brand, Design, DesignContent, Product } from "./domain";
import {cleanProductSpecs,isProductFact} from "./facts";
import { trustFacts } from "./facts";
import { ctaFor, headingFor, headingSizeFor, heroImageWant, pad2, palette, planSections, resolvePlan, spacingFor, toneFor, flipFor, type Tone } from "./render-plan";
import { designFamilies } from "./design-plan";
import {standaloneTheme} from "./theme-package";

export const rootDir = existsSync(path.resolve(process.cwd(),"shopify")) ? process.cwd() : path.resolve(process.cwd(),"../..");
export const escapeHtml=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
export function contrastText(hex:string){
  const rgb=hex.replace("#","");
  if(!/^[0-9a-f]{6}$/i.test(rgb))return "#ffffff";
  const channels=[0,2,4].map(i=>{const s=parseInt(rgb.slice(i,i+2),16)/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);});
  return channels[0]!*.2126+channels[1]!*.7152+channels[2]!*.0722>.179?"#171717":"#ffffff";
}
/** Ordered native stylesheets. Preview inlines the same list, so both renderers share one visual system. */
export const STYLESHEETS=["wishluck-base.css","wishluck-hero.css","wishluck-sections.css","wishluck-families.css","wishluck-axes.css"];
const safeText=(v:string)=>v.replace(/\{%|\{\{/g,"").replace(/\u0000/g,"");
const rich=(v:string)=>v.split(/\n+/).filter(Boolean).map(x=>`<p>${escapeHtml(safeText(x))}</p>`).join("")||"<p></p>";
const read=(name:string)=>readFileSync(path.join(rootDir,"shopify",name),"utf8");
const opts=(vals:readonly string[])=>vals.map(v=>({value:v,label:v[0]!.toUpperCase()+v.slice(1)}));

function commonSettings(){
  return [
    {type:"checkbox",id:"show_section",label:"Show section",default:true},
    {type:"header",content:"Art direction"},
    {type:"select",id:"family",label:"Design family",options:opts(designFamilies),default:"atelier"},
    {type:"select",id:"image_treatment",label:"Image treatment",options:opts(["cutout","framed","fullbleed","collage"]),default:"cutout"},
    {type:"select",id:"hero_scale",label:"Scale",options:opts(["monumental","balanced","compact"]),default:"balanced"},
    {type:"select",id:"color_strategy",label:"Colour strategy",options:opts(["light","ink","brand","contrast"]),default:"light"},
    {type:"select",id:"rhythm",label:"Content rhythm",options:opts(["spacious","dense","alternating"]),default:"spacious"},
    {type:"select",id:"typography",label:"Typography voice",options:opts(["display","editorial","technical"]),default:"display"},
    {type:"select",id:"detail_layout",label:"Detail layout",options:opts(["tiles","timeline","bento","split","columns"]),default:"split"},
    {type:"select",id:"alignment",label:"Alignment",options:opts(["start","center"]),default:"start"},
    {type:"select",id:"accent_placement",label:"Accent placement",options:opts(["edge","panel","rule"]),default:"rule"},
    {type:"checkbox",id:"flip",label:"Mirror media side",default:false},
    {type:"header",content:"Colour"},
    {type:"color",id:"background",label:"Background",default:"#f4f1ea"},
    {type:"color",id:"text_color",label:"Text",default:"#1c1c1a"},
    {type:"color",id:"primary",label:"Accent",default:"#222222"},
    {type:"color",id:"on_primary",label:"Text on accent",default:"#f4f1ea"},
    {type:"color",id:"secondary",label:"Surface",default:"#e6e2d9"},
    {type:"color",id:"stage",label:"Image stage",default:"#e6e2d9"},
    {type:"color",id:"button_color",label:"Button",default:"#222222"},
    {type:"color",id:"button_text",label:"Button text",default:"#f4f1ea"},
    {type:"header",content:"Type and spacing"},
    {type:"font_picker",id:"heading_font",label:"Heading font",default:"assistant_n4"},
    {type:"font_picker",id:"body_font",label:"Body font",default:"assistant_n4"},
    {type:"range",id:"heading_weight",label:"Heading weight",min:100,max:900,step:100,default:400},
    {type:"range",id:"body_weight",label:"Body weight",min:100,max:900,step:100,default:400},
    {type:"range",id:"heading_size",label:"Heading size",min:30,max:80,step:1,unit:"px",default:64},
    {type:"range",id:"body_size",label:"Body size",min:12,max:24,step:1,unit:"px",default:16},
    {type:"range",id:"radius",label:"Corner radius",min:0,max:40,step:1,unit:"px",default:0},
    {type:"range",id:"spacing",label:"Vertical spacing",min:12,max:100,step:2,unit:"px",default:72},
    {type:"header",content:"Content"},
    {type:"text",id:"heading",label:"Heading"},
    {type:"image_picker",id:"image",label:"Image (optional override)"},
    {type:"range",id:"image_index",label:"Product image number used when no image is picked",min:0,max:10,step:1,default:1,info:"0 hides the image"},
    {type:"text",id:"image_alt",label:"Image description"},
  ];
}
const toneValues=(t:Tone)=>({...t});

export function compile(design:Design,c:DesignContent,p:Product,b:Brand):Record<string,string>{
  c={...c,specs:cleanProductSpecs(c.specs),benefits:c.benefits.filter(item=>isProductFact(item.title,item.text))};
  const suffix=`wl-${design.id.slice(0,8)}`;
  const heroName=`${suffix}-hero`,contentName=`${suffix}-content`;
  const cssName=`${suffix}.css`,jsName=`${suffix}.js`;
  const plan=resolvePlan(c), pal=palette(plan,b);
  const heroSchema={name:"Wishluck product",tag:"section",settings:[
    ...commonSettings(),
    {type:"range",id:"image_count",label:"Product images in hero",min:1,max:4,step:1,default:1},
    {type:"text",id:"brand_name",label:"Brand name"},
    {type:"richtext",id:"description",label:"Description"},
    {type:"text",id:"variant_label",label:"Variant label",default:"Variant"},
    {type:"text",id:"quantity_label",label:"Quantity label",default:"Qty"},
    {type:"text",id:"button_label",label:"Cart button label",default:"Add to cart"},
    {type:"text",id:"link_label",label:"Secondary link label",default:"Explore the collection"},
    {type:"url",id:"button_link",label:"Secondary link"},
    {type:"checkbox",id:"show_sticky",label:"Show mobile sticky cart",default:true},
    {type:"checkbox",id:"show_trust",label:"Show verified trust content",default:true},
    {type:"richtext",id:"trust_text",label:"Verified trust facts"},
  ],presets:[{name:"Wishluck product"}]};
  const contentSchema={name:"Wishluck content",tag:"section",settings:[
    ...commonSettings(),
    {type:"text",id:"label",label:"Section number or label"},
    {type:"richtext",id:"body",label:"Body text"},
    {type:"select",id:"mode",label:"Content type",options:[{value:"story",label:"Story"},{value:"cards",label:"Details"},{value:"specs",label:"Specifications"},{value:"faq",label:"FAQ"},{value:"reviews",label:"Reviews"},{value:"gallery",label:"Gallery"},{value:"purchase",label:"Repeat buy band"}],default:"cards"},
    {type:"text",id:"button_label",label:"Buy band button label",default:"Choose your variant"},
  ],blocks:[
    {type:"item",name:"Item",settings:[{type:"text",id:"title",label:"Heading, question or author"},{type:"richtext",id:"body",label:"Text or answer"}]},
    {type:"image",name:"Gallery image",settings:[{type:"image_picker",id:"image",label:"Image"},{type:"range",id:"image_index",label:"Product image number used when no image is picked",min:1,max:10,step:1,default:1},{type:"text",id:"caption",label:"Caption"}]},
  ],max_blocks:30,presets:[{name:"Wishluck content"}]};
  const rating=p.rating&&p.reviewCount?`,"aggregateRating":${JSON.stringify({"@type":"AggregateRating",ratingValue:p.rating,reviewCount:p.reviewCount})}`:"";
  const hero=read("sections/wishluck-hero.liquid").replaceAll("WL_CSS",cssName).replaceAll("WL_JS",jsName).replace("WL_RATING",rating).replace("WL_SCHEMA",JSON.stringify(heroSchema));
  const content=read("sections/wishluck-content.liquid").replace("WL_SCHEMA",JSON.stringify(contentSchema));
  const clamp=(v:string,min:number,max:number,f:number)=>Math.max(min,Math.min(max,parseInt(v)||f));
  // Note: image_picker values are never set; images resolve natively from product.images at render time.
  const base=(flip:boolean)=>({show_section:true,family:plan.family,image_treatment:plan.imageTreatment,hero_scale:plan.heroScale,color_strategy:plan.colorStrategy,rhythm:plan.contentRhythm,
    typography:plan.typography,detail_layout:plan.detailLayout,alignment:plan.alignment,accent_placement:plan.accentPlacement,flip,
    heading_font:b.shopifyHeadingFont||"assistant_n4",body_font:b.shopifyBodyFont||"assistant_n4",
    heading_weight:Math.round(clamp(b.headingWeight,100,900,400)/100)*100,body_weight:Math.round(clamp(b.bodyWeight,100,900,400)/100)*100,
    heading_size:headingSizeFor(plan),body_size:clamp(b.bodySize,12,24,16),radius:clamp(b.radius,0,40,0),spacing:spacingFor(plan)});
  const keys=planSections(plan,c).filter(k=>!(k==="reviews"&&!(p.reviews??[]).length));
  const facts=trustFacts(p);
  const sections:Record<string,unknown>={
    hero:{type:heroName,settings:{...base(false),...toneValues(toneFor(plan,pal,"hero",0)),image_index:1,image_count:heroImageWant(plan),image_alt:safeText(p.title),
      brand_name:safeText(p.brand),heading:safeText(c.headline),description:rich(c.subheading),
      variant_label:"Variant",quantity_label:"Qty",button_label:"Add to cart",link_label:"Explore the collection",...(p.collectionUrl?{button_link:p.collectionUrl}:{}),
      show_sticky:true,show_trust:facts.length>0,trust_text:facts.length?rich(facts.join(" · ")):""}},
  };
  const itemBlocks=(items:{title:string;text:string}[])=>Object.fromEntries(items.map((item,i)=>[`item${i}`,{type:"item",settings:{title:safeText(item.title),body:rich(item.text)}}]));
  keys.forEach((key,i)=>{
    if(key==="hero")return;
    const items=key==="benefits"?c.benefits:key==="specs"?Object.entries(c.specs).map(([title,text])=>({title,text})):key==="faq"?c.faqs.map(f=>({title:f.question,text:f.answer})):key==="reviews"?(p.reviews??[]).map(r=>({title:r.author,text:`${r.rating?`${r.rating} / 5 - `:""}${r.text}`})):[];
    const blocks=key==="gallery"?Object.fromEntries([1,2,3,4].map(n=>[`image${n}`,{type:"image",settings:{image_index:n,caption:""}}])):itemBlocks(items);
    sections[key]={type:contentName,settings:{...base(flipFor(plan,i)),...toneValues(toneFor(plan,pal,key,i)),label:pad2(i+1),heading:headingFor(plan,key),
      body:key==="story"?rich(c.story):"",mode:key==="benefits"?"cards":key,image_index:key==="story"?2:0,image_alt:safeText(p.title),button_label:ctaFor(plan)},
      blocks,block_order:Object.keys(blocks)};
  });
  return {
    [`sections/${heroName}.liquid`]:hero,[`sections/${contentName}.liquid`]:content,
    [`assets/${cssName}`]:STYLESHEETS.map(n=>read(`assets/${n}`)).join("\n"),
    [`assets/${jsName}`]:read("assets/wishluck-cart.js")+"\n"+read("assets/wishluck-motion.js"),
    [`templates/product.${suffix}.json`]:JSON.stringify({sections,order:keys},null,2),
  };
}
export async function zipDesign(files:Record<string,string>){
  const zip=new JSZip();
  for(const[name,content]of Object.entries(standaloneTheme(files)))zip.file(name,content);
  return zip.generateAsync({type:"nodebuffer"});
}
