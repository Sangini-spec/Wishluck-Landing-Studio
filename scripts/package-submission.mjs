/**
 * Reproducible, read-only submission evidence export.
 * No Shopify writes, carts, checkout actions or fabricated audit results.
 * Run: node scripts/package-submission.mjs --origin https://your-preview-host
 */
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import path from "node:path";
const require=createRequire(path.resolve("artifacts/api-server/package.json"));
const {chromium}=require("playwright");
const {load}=require("cheerio");
const origin=process.argv[process.argv.indexOf("--origin")+1];
if(!origin||!/^https?:\/\//.test(origin))throw new Error("Supply --origin with the running dashboard origin.");
const root="docs/results";
const reportsOnly=process.argv.includes("--reports-only");
await mkdir(root,{recursive:true});
const sensitive=/^(authorization|cookie|cookies|set-cookie|headers|requestHeaders|responseHeaders|password|secret|accessToken|access_token|preview_key|token)$/i;
function safeUrl(value){
  try{
    const u=new URL(value);if(!/^https?:$/.test(u.protocol))return value;
    u.username="";u.password="";
    // Draft-preview hostnames can themselves be capability-bearing identifiers.
    if(u.hostname.endsWith(".shopifypreview.com"))u.hostname="redacted-shopify-preview.invalid";
    for(const key of [...u.searchParams.keys()])if(!["preview_theme_id","variant","width","height","format","v"].includes(key))u.searchParams.delete(key);
    return u.href;
  }catch{return value;}
}
function scrub(value){
  if(Array.isArray(value))return value.map(scrub);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sensitive.test(k)?"[REDACTED]":scrub(v)]));
  if(typeof value==="string")return value.replace(/https?:\/\/[^\s"'<>\\]+/g,safeUrl);
  return value;
}
async function json(file,value){await writeFile(file,JSON.stringify(scrub(value),null,2)+"\n");}
async function get(url){const r=await fetch(url.startsWith("http")?url:origin+url);if(!r.ok)throw new Error(`Evidence request failed (${r.status})`);return r;}
const runs=await(await get("/api/runs")).json();
const selected=runs.filter(r=>r.product&&r.designs.length>=3).slice(0,5);
if(selected.length!==5||new Set(selected.map(r=>r.product.category)).size<2)throw new Error("Five actual products across two categories are required.");
const dashboard=await(await get("/api/dashboard")).json();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||"/repl/tools/bin/chromium",args:["--no-sandbox","--disable-dev-shm-usage"]});
const results=[];
try{
  for(const run of selected){
    const slug=run.product.handle||new URL(run.url).pathname.split("/").filter(Boolean).at(-1);
    const dir=path.join(root,slug);await mkdir(dir,{recursive:true});
    const designs=run.designs.slice(0,4);
    const captures=reportsOnly?JSON.parse(await readFile(path.join(dir,"responsive-results.json"),"utf8")):[];
    await json(path.join(dir,"brand-analysis.json"),{product:run.product.title,category:run.product.category,sourceUrl:run.url,brand:run.brand,aiCostEstimateUSD:run.aiCost,warnings:run.warnings});
    await json(path.join(dir,"research.json"),{researchedAt:run.researchedAt,competitors:run.competitors.map(({title,url,status,reason,sections,analysis,error})=>({title,url,status,reason,sections,analysis,error})),learnings:run.learnings});
    await json(path.join(dir,"design-fingerprints.json"),run.designs.map(({id,name,version,createdAt,direction,uniqueness,comparedCount,closestDesign,fingerprint,scores,checks,researchInfluences})=>({id,name,version,createdAt,direction,structuralDifferencePercent:uniqueness,comparedCount,closestDesign,fingerprint,localCheckCoverage:scores,checks,researchInfluences})));
    const schemaResults=[];
    for(const [index,design]of designs.entries()){
      const html=await(await get(`/api/designs/${design.id}/preview`)).text();
      const $=load(html);const graphs=[];const parseErrors=[];
      $('script[type="application/ld+json"]').each((i,el)=>{try{graphs.push(JSON.parse($(el).text()));}catch{parseErrors.push(`JSON-LD script ${i+1} is invalid JSON`);}});
      const nodes=graphs.flatMap(g=>Array.isArray(g)?g:g["@graph"]??[g]);
      const product=nodes.find(n=>n["@type"]==="Product"),faq=nodes.find(n=>n["@type"]==="FAQPage");
      const checks={jsonParses:parseErrors.length===0,productPresent:!!product,productNamePresent:!!product?.name,
        offerCurrency:/^[A-Z]{3}$/.test(product?.offers?.priceCurrency??""),
        offerPrice:product?.offers?.price!=null&&Number.isFinite(Number(product.offers.price)),
        faqPresent:!!faq,faqAnswersPresent:!!faq?.mainEntity?.length&&faq.mainEntity.every(q=>q.name&&q.acceptedAnswer?.text),
        singleH1:$("h1").length===1};
      schemaResults.push({designId:design.id,scope:"Dashboard HTML preview: local JSON-LD parsing, shape and H1 checks",checks,parseErrors,jsonLd:graphs});
      if(reportsOnly)continue;
      const page=await browser.newPage();
      await page.route("**/*",r=>["GET","HEAD"].includes(r.request().method())?r.continue():r.abort());
      for(const width of [360,768,1440]){
        await page.setViewportSize({width,height:1000});
        await page.goto(origin+`/api/designs/${design.id}/preview`,{waitUntil:"networkidle",timeout:60000});
        await page.evaluate(()=>document.fonts.ready);
        await page.locator("img").evaluateAll(images=>images.forEach(i=>{i.loading="eager";}));
        await page.locator("img").evaluateAll(images=>Promise.all(images.map(i=>i.complete?Promise.resolve():new Promise(resolve=>{i.onload=i.onerror=resolve;setTimeout(resolve,4000);}))));
        const geometry=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,
          h1Count:document.querySelectorAll("h1").length,images:[...document.images].map(i=>({loaded:i.complete&&i.naturalWidth>0,alt:i.alt})),
          cartWasSubmitted:false}));
        const file=`design-${index+1}-${width}.jpg`;
        await page.screenshot({path:path.join(dir,file),fullPage:true,type:"jpeg",quality:65});
        captures.push({designId:design.id,designName:design.name,width,file,scope:"Read-only dashboard HTML preview",...geometry});
      }
      await page.close();
    }
    await json(path.join(dir,"schema-results.json"),schemaResults);
    await json(path.join(dir,"responsive-results.json"),captures);
    if(!reportsOnly){
      const page=await browser.newPage({viewport:{width:1440,height:1000}});
      await page.route("**/*",r=>["GET","HEAD"].includes(r.request().method())?r.continue():r.abort());
      await page.goto(origin+`/designs/${designs[0].id}`,{waitUntil:"networkidle",timeout:60000});
      await page.locator('[data-testid="panel-scores"]').screenshot({path:path.join(dir,"design-scores.jpg"),type:"jpeg",quality:85});
      await page.close();
    }
    const auditDesigns=run.designs.filter(d=>d.lighthouse?.status==="completed");
    const audits=[];
    for(const [i,design]of auditDesigns.entries()){
      const raw=await(await get(design.lighthouse.url)).text();
      const marker=raw.indexOf("window.__LIGHTHOUSE_JSON__");
      if(marker<0)throw new Error("Lighthouse JSON was not found in its actual stored report.");
      const start=raw.indexOf("{",marker);let depth=0,quoted=false,escaped=false,end=-1;
      for(let p=start;p<raw.length;p++){
        const c=raw[p];
        if(quoted){if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c==='"')quoted=false;}
        else if(c==='"')quoted=true;else if(c==="{")depth++;else if(c==="}"&&--depth===0){end=p+1;break;}
      }
      if(end<0)throw new Error("Stored Lighthouse JSON is incomplete.");
      const report=scrub(JSON.parse(raw.slice(start,end)));
      const file=`lighthouse-${i+1}.html`;
      await writeFile(path.join(dir,file),raw.slice(0,start)+JSON.stringify(report).replace(/</g,"\\u003c")+raw.slice(end));
      await json(path.join(dir,`lighthouse-${i+1}-summary.json`),{
        designId:design.id,testedAt:design.lighthouse.testedAt,scope:"Actual archived Shopify mobile Lighthouse audit",
        scores:Object.fromEntries(Object.entries(report.categories??{}).map(([k,v])=>[k,Math.round(v.score*100)])),
        failedAudits:Object.values(report.audits??{}).filter(a=>a.score!==null&&a.score<1).map(a=>({id:a.id,title:a.title,score:a.score,displayValue:a.displayValue})),
        targets:{performance:85,seo:95,accessibility:90},requestedUrl:report.requestedUrl,finalDisplayedUrl:report.finalDisplayedUrl
      });
      const page=await browser.newPage({viewport:{width:1440,height:1050}});
      await page.route("https://submission-evidence.invalid/**",r=>r.fulfill({status:200,contentType:"text/html",body:raw.slice(0,start)+JSON.stringify(report).replace(/</g,"\\u003c")+raw.slice(end)}));
      await page.goto("https://submission-evidence.invalid/report",{waitUntil:"networkidle"});
      await page.screenshot({path:path.join(dir,`lighthouse-${i+1}.jpg`),type:"jpeg",quality:75});
      await page.close();
      audits.push({designId:design.id,file,screenshot:`lighthouse-${i+1}.jpg`,...design.lighthouse,url:undefined});
    }
    const publicationRecords=dashboard.publications.filter(p=>run.designs.some(d=>d.id===p.designId));
    await json(path.join(dir,"shopify-results.json"),publicationRecords.map(({title,status,shop,themeId,remoteRole,checkedAt,editorUrl,uploadedAt,publishedAt,timeline})=>({title,status,shop,themeId,remoteRole,checkedAt,previewUrl:shop&&themeId?`https://${shop}/?preview_theme_id=${themeId}`:undefined,editorUrl,uploadedAt,publishedAt,timeline})));
    const row={slug,title:run.product.title,category:run.product.category,sourceUrl:run.url,runId:run.id,
      totalDesigns:run.designs.length,capturedDesigns:designs.length,competitors:run.competitors.filter(c=>c.status==="crawled").length,
      captures:captures.length,horizontalOverflowCaptures:captures.filter(c=>c.horizontalOverflow).length,unloadedImageCaptures:captures.filter(c=>c.images.some(i=>!i.loaded)).length,
      audits,generatedAt:new Date().toISOString()};
    results.push(row);
    console.log(JSON.stringify({product:slug,screenshots:captures.length,audits:audits.length,overflow:row.horizontalOverflowCaptures,unloadedImages:row.unloadedImageCaptures}));
  }
}finally{await browser.close();}
await json(path.join(root,"manifest.json"),{generatedAt:new Date().toISOString(),repository:"https://github.com/Sangini-spec/Wishluck-Landing-Studio",scope:"Five saved product runs: dashboard previews, sourced research, per-design local checks and archived Shopify audits.",products:results});
console.log("Five-product evidence export finished.");
