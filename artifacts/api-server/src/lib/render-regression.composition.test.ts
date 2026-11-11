import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {mkdir} from "node:fs/promises";
import path from "node:path";
import {chromium,type Browser,type Page} from "playwright";
import {load} from "cheerio";
import {preview} from "./preview";
import {compile,rootDir} from "./compiler";
import {composedVisualPlan} from "./design-plan";
import {compositionSchema} from "./composition-plan";
import {nativeHtml} from "./render-regression/native";
import {layoutProblems} from "./render-regression/layout";
import {brand,product,content,design,imageShapes} from "./render-regression/fixtures";
import {creativePlanFixture} from "./render-regression/composition-fixtures";

let browser:Browser,page:Page;
const unexpected:string[]=[];
const evidence=path.join(rootDir,"generated-artifacts/composition-regression");
before(async()=>{
  await mkdir(evidence,{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync("/repl/tools/bin/chromium")?"/repl/tools/bin/chromium":undefined),args:["--no-sandbox","--disable-dev-shm-usage"]});
  const context=await browser.newContext({reducedMotion:"reduce",serviceWorkers:"block"});
  await context.route("**/*",async route=>{
    const request=route.request(),index=product.images.indexOf(request.url());
    if(request.method()==="GET"&&index>=0&&request.resourceType()==="image"){
      const [w,h]=imageShapes[index]!;
      await route.fulfill({contentType:"image/svg+xml",body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="1" y="1" width="${w-2}" height="${h-2}" fill="#bb9568" stroke="#202521"/><path d="M0 0L${w} ${h}" stroke="#202521"/></svg>`});
    }else{unexpected.push(`${request.method()} ${request.url()}`);await route.abort();}
  });
  page=await context.newPage();
});
after(async()=>{await browser?.close();});

const layouts=compositionSchema.shape.hero.shape.layout.options;
const sectionLayouts=["stack","split","grid","feature","alternating","band"] as const;
for(const [index,layout] of layouts.entries()){
  test(`composed ${layout}: editable native contract and geometry at 360/768/1440`,async()=>{
    const creative=creativePlanFixture(),c=content();
    creative.typography=(["display","editorial","technical"] as const)[index%3]!;
    creative.imageTreatment=(["cutout","framed","collage","fullbleed"] as const)[index%4]!;
    creative.composition.hero={...creative.composition.hero,layout,mediaSide:index%2?"right":"left",imageCount:index%4+1,imageRatio:(["square","portrait","landscape"] as const)[index%3]!,surface:(["paper","ink","brand","muted"] as const)[index%4]!};
    creative.composition.sections=creative.composition.sections.map((s,i)=>({...s,layout:sectionLayouts[(index+i)%6]!,columns:(index+i)%4+1,headingPlacement:(["above","beside","center"] as const)[(index+i)%3]!,width:(["full","contained","narrow"] as const)[(index+i)%3]!,surface:(["paper","ink","brand","muted"] as const)[(index+i)%4]!}));
    creative.composition.sections.push(
      {...creative.composition.sections[0]!,kind:"gallery",layout:sectionLayouts[(index+3)%6]!,title:"Product views"},
      {...creative.composition.sections[1]!,kind:"specs",layout:sectionLayouts[(index+4)%6]!,title:"Product specifications"},
      {...creative.composition.sections[2]!,kind:"purchase",layout:sectionLayouts[(index+5)%6]!,title:"Choose your options"},
    );
    const plan=composedVisualPlan(creative);c.visualPlan=plan;c.sections=plan.sections;c.composition="composed";
    const files=compile(design,c,{...product,images:[]},brand);
    const template=JSON.parse(Object.entries(files).find(([name])=>name.startsWith("templates/"))![1]);
    assert.deepEqual(template.order,plan.sections);
    const definitions=new Map<string,any>();
    for(const [name,body]of Object.entries(files).filter(([name])=>name.startsWith("sections/"))){
      const schema=JSON.parse(body.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/)![1]!);
      assert.ok(schema.settings.length<=50,`${name}: too many native settings`);
      assert.equal(new Set(schema.settings.filter((s:any)=>s.id).map((s:any)=>s.id)).size,schema.settings.filter((s:any)=>s.id).length);
      definitions.set(name.slice("sections/".length,-".liquid".length),new Map(schema.settings.filter((s:any)=>s.id).map((s:any)=>[s.id,s])));
    }
    for(const section of Object.values(template.sections) as any[]){
      const schema=definitions.get(section.type)!;
      for(const [id,value]of Object.entries(section.settings)){
        const definition=schema.get(id);assert.ok(definition,`Undefined setting ${id}`);
        if(definition.options)assert.ok(definition.options.some((option:any)=>option.value===value),`Invalid ${id}: ${value}`);
        if(definition.type==="range"){
          assert.ok(Number(value)>=definition.min&&Number(value)<=definition.max,`Range ${id}`);
          assert.equal((Number(value)-definition.min)%definition.step,0,`Step ${id}`);
        }
      }
    }
    assert.equal(template.sections.hero.settings.layout,layout);
    assert.equal(template.sections.hero.settings.media_share,creative.composition.hero.mediaShare);
    const html=preview(design,c,product,brand),native=await nativeHtml(c,{...product,images:[]},product,brand);
    const p=load(html),n=load(native);
    const classes=($:ReturnType<typeof load>)=>$("section.wl").map((_,el)=>($(el).attr("class")??"").split(/\s+/).sort().join(" ")).get();
    assert.deepEqual(classes(p),classes(n),"Preview/native structural classes differ");
    assert.equal(p(".wl-f-atelier").length,0,"New composition must not inherit a finished family");
    assert.ok(p(`.wl-hx-${layout}`).length);
    for(const width of [360,768,1440]){
      for(const [renderer,markup]of [["preview",html],["native",native]] as const){
        await page.setViewportSize({width,height:900});
        await page.setContent(markup,{waitUntil:"load"});
        await page.evaluate(async()=>{
          document.querySelectorAll("img").forEach(image=>image.loading="eager");
          await Promise.all([...document.images].map(image=>image.decode()));
          document.querySelectorAll("details").forEach(element=>element.open=true);
          await document.fonts.ready;
        });
        const problems=await layoutProblems(page);
        if(problems.length)await page.screenshot({path:path.join(evidence,`${layout}-${renderer}-${width}.jpg`),type:"jpeg",quality:70,fullPage:true});
        assert.deepEqual(problems,[],`${layout}/${renderer}/${width}`);
        const controls=await page.locator(".wl-form select,.wl-form input,.wl-form button").count();assert.equal(controls,3);
      }
    }
  });
}
test("stack with real-length copy exposes meaningful product imagery in the first desktop screen",async()=>{
  const creative=creativePlanFixture(),c=content();
  creative.composition.hero={...creative.composition.hero,layout:"stack",surface:"ink",contentWidth:"compact",imageCount:3,imageRatio:"portrait"};
  c.headline="Thoughtfully made for the quiet everyday ritual";
  c.subheading="A considered product with clear source-backed details, current pricing and straightforward purchase controls. Explore the photographs and the factual answers below before choosing the right option for your everyday use.";
  c.visualPlan=composedVisualPlan(creative);c.sections=c.visualPlan.sections;
  const variants=[["preview",preview(design,c,product,brand)],["native",await nativeHtml(c,{...product,images:[]},product,brand)]] as const;
  for(const [renderer,html]of variants){
    await page.setViewportSize({width:1440,height:900});await page.setContent(html,{waitUntil:"load"});
    await page.evaluate(async()=>{await Promise.all([...document.images].map(image=>image.decode()));await document.fonts.ready;});
    const position=await page.locator(".wl-media .wl-fig-1").boundingBox();
    assert.ok(position,renderer);
    assert.ok(position.y<780,`${renderer}: product imagery is below the first screen (${position.y})`);
    assert.ok(Math.min(position.y+position.height,900)-Math.max(position.y,0)>=120,`${renderer}: too little of product image visible`);
    assert.deepEqual(await layoutProblems(page),[],renderer);
  }
});
test("composed regression never contacted Shopify or another external source",()=>{
  assert.deepEqual(unexpected,[]);
});
