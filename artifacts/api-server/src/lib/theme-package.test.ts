import {test} from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {Liquid} from "liquidjs";
import {runInNewContext} from "node:vm";
import {compile,zipDesign} from "./compiler";
import {standaloneTheme,validateThemePackage} from "./theme-package";
import {brand,design,fixtures} from "./render-regression/fixtures";

const fixture=fixtures[0]!;
const compiled=()=>compile(design,fixture.c,{...fixture.p,images:[]},brand);
const engine=new Liquid({strictFilters:false});
// Shopify-only block tags are normalised for a local syntax check; this is not
// represented as Shopify's actual import validator or storefront execution.
const normalise=(source:string)=>source
  .replace(/{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/g,"")
  .replace(/{%-?\s*(?:form|paginate)\b[\s\S]*?-?%}/g,"{% if true %}")
  .replace(/{%-?\s*(?:endform|endpaginate)\s*-?%}/g,"{% endif %}")
  .replace(/{%-?\s*layout\b.*?-?%}/g,"")
  .replace(/{%-?\s*style\s*-?%}/g,"<style>").replace(/{%-?\s*endstyle\s*-?%}/g,"</style>");

test("download ZIP is standalone and resolves every design's JSON and Liquid references",async()=>{
  for(const candidate of fixtures){
    const thin=compile(design,candidate.c,{...candidate.p,images:[]},brand);
    const original=JSON.stringify(thin);
    const theme=standaloneTheme(thin);
    assert.equal(JSON.stringify(thin),original,"Export must not mutate the additive API bundle");
    assert.ok(!thin["layout/theme.liquid"]&&!thin["config/settings_data.json"]);
    validateThemePackage(theme);
    assert.deepEqual(JSON.parse(theme["templates/product.json"]),JSON.parse(Object.entries(thin).find(([name])=>name.startsWith("templates/product."))![1]));
    for(const [name,source]of Object.entries(theme)){
      if(name.endsWith(".liquid")){
        assert.doesNotThrow(()=>engine.parse(normalise(source)),`${candidate.id}: ${name}`);
        const schema=/{% schema %}([\s\S]*?){% endschema %}/.exec(source);
        if(schema)assert.doesNotThrow(()=>JSON.parse(schema[1]),name);
      }
    }
    const css=Object.keys(thin).find(name=>name.endsWith(".css"))!;
    assert.equal(theme[css],thin[css],"Keep the exact shared generated design CSS");
  }
  const zip=await JSZip.loadAsync(await zipDesign(compiled()));
  for(const required of ["config/settings_schema.json","config/settings_data.json","layout/theme.liquid","templates/index.json","templates/product.json","templates/password.liquid","assets/wishluck-shell.css"]){
    assert.ok(zip.file(required),`Missing ${required} at the ZIP root`);
  }
  assert.ok(!zip.file("UPLOAD-INSTRUCTIONS.txt"));
});

test("all six reported missing/invalid settings failures are rejected before download",()=>{
  const files=standaloneTheme(compiled());
  for(const required of ["config/settings_schema.json","config/settings_data.json"]){
    const broken={...files};delete broken[required];
    assert.throws(()=>validateThemePackage(broken),/missing/i);
    assert.throws(()=>validateThemePackage({...files,[required]:"not JSON"}));
  }
  assert.throws(()=>validateThemePackage({...files,"config/settings_schema.json":"[]"}),/metadata/);
  for(const key of ["theme_name","theme_version","theme_author","theme_documentation_url","theme_support_url"]){
    const schema=JSON.parse(files["config/settings_schema.json"]);delete schema[0][key];
    assert.throws(()=>validateThemePackage({...files,"config/settings_schema.json":JSON.stringify(schema)}),/metadata/);
  }
  assert.throws(()=>validateThemePackage({...files,"config/settings_data.json":JSON.stringify({current:{},presets:{}})}),/preset/);
  assert.throws(()=>validateThemePackage({...files,"config/settings_data.json":JSON.stringify({current:[],presets:{Wishluck:{}}})}),/current/);
  assert.throws(()=>validateThemePackage({...files,"templates/product.json":JSON.stringify({sections:{bad:{type:"missing"}},order:["bad"]})}),/Unresolved section/);
  assert.throws(()=>validateThemePackage({...files,"../escape.txt":"unsafe"}),/Unsafe theme path/);
});

test("home preview requires an explicitly selected product and never imports source imagery",async()=>{
  const files=standaloneTheme(compiled());
  const hero=Object.keys(files).find(name=>name.startsWith("sections/wl-")&&name.endsWith("-hero.liquid"))!;
  assert.ok(files[hero].includes("assign product = settings.preview_product"));
  assert.ok(!files[hero].includes(fixture.p.images[0]??"https://source.example.invalid"));
  const output=await engine.parseAndRender(normalise(files[hero]),{request:{page_type:"index"},settings:{preview_product:null}});
  assert.equal(output.trim(),"","Do not render a false product or working buy button without a selected product");
  const help=await engine.parseAndRender(normalise(files["sections/wl-preview-help.liquid"]),{settings:{preview_product:null},routes:{all_products_collection_url:"/collections/all"}});
  assert.match(help,/Your landing-page theme is ready/);
  const selected=await engine.parseAndRender(normalise(files["sections/wl-preview-help.liquid"]),{settings:{preview_product:{title:"Assigned store product"}}});
  assert.equal(selected.trim(),"");
});

test("standalone Ajax cart routes preserve Shopify's locale and trailing slash",()=>{
  const layout=standaloneTheme(compiled())["layout/theme.liquid"];
  const script=/<script>([\s\S]*?)<\/script>/.exec(layout)![1];
  for(const [root,existing,expected]of [["/",undefined,"/"],["/fr",undefined,"/fr/"],["/fr/",undefined,"/fr/"],["/","/de/","/de/"]] as const){
    const window:any={Shopify:{routes:{root:existing}}};
    runInNewContext(script.replace("{{ routes.root_url | json }}",JSON.stringify(root)),{window});
    assert.equal(window.Shopify.routes.root,expected);
  }
});
