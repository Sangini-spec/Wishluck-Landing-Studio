import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, learningsTable } from "@workspace/db";
import { crawl } from "./crawler";
import { askJson, aiReady } from "./ai";
import { event } from "./store";
import { AppError, type Run, type Competitor } from "./domain";
import { search } from "./search";
import {createHash} from "node:crypto";
import {researchQueue,reusableCaptures,isCommerceReference} from "./research-queue";
export async function research(run: Run) {
  if (!run.product) throw new AppError(409,"Analyse a product first.");
  const p = run.product;
  const inputKey=createHash("sha256").update(JSON.stringify({product:run.product,brand:run.brand})).digest("hex");
  const previous=reusableCaptures(run.competitors,run.researchKey===inputKey);
  run.status = "researching";
  await event(run,"finding_competitors",`Searching for ${p.category} competitors, with preference for Indian D2C brands.`);
  const ownHost = new URL(run.url).hostname;
  let queries=[
    `${p.category} Indian D2C brands official product buy -site:${ownHost}`,
    `${p.category} independent brand product India -${p.brand}`,
    `${p.category} product official brand online -site:${ownHost} -${p.brand}`,
  ];
  if(aiReady()){
    try{
      const planned=await askJson(`Create exactly three commercial-intent web search queries for competing actual products, preferably Indian D2C, for category ${JSON.stringify(p.category)}. Source product context:${JSON.stringify({title:p.title,brand:p.brand,description:p.description.slice(0,1800)})}. Each query must target the specific generic product TYPE (for example facial cleanser, not broad beauty brands), use buy/price/official intent and avoid directories, blogs and lists of brands. Search by generic product type and factual attributes, NOT the exact source SKU or source brand: resellers of the same product are not competitors. Exclude marketplaces and the source brand. Return JSON {queries:[string,string,string]}. No URLs or invented competitor names.`,z.object({queries:z.array(z.string().min(8).max(220)).length(3)}));
      queries=planned.value.queries;run.aiCost=(run.aiCost??0)+planned.estimatedCost;
    }catch{/* The category queries remain genuine provider searches. */}
  }
  queries.push(`${p.title} ${p.category} buy official price -blog -directory -manufacturer -site:${ownHost}`);
  const results = [];
  for(const query of queries){
    results.push(...await search(query));
    await new Promise(r=>setTimeout(r,1100));
  }
  const hosts = new Set<string>();
  const candidates = results.filter(r => {
    try {
      const u = new URL(r.url);
      const sourceBrand=p.brand.toLowerCase().replace(/[^a-z0-9]/g,"");
      if (u.protocol !== "https:" || !isCommerceReference(r.url) || u.hostname === ownHost || hosts.has(u.hostname) || (sourceBrand.length>=4&&u.hostname.replace(/[^a-z0-9]/g,"").includes(sourceBrand)) || /(amazon\.|flipkart\.|ebay\.|shopee\.|samsclub\.|govx\.|zalando\.|namshi\.|youtube\.|instagram\.|pinterest\.|facebook\.)/.test(u.hostname)) return false;
      hosts.add(u.hostname); return true;
    } catch { return false; }
  }).slice(0,24);
  const fallback = candidates.map(r => ({url:r.url,title:r.title,reason:`Search relevance to ${p.category} and ${p.title}; Indian commercial-intent query. Relevance requires evidence review.`}));
  let selected = fallback;
  if (aiReady() && candidates.length) {
    try {
      const ranking = await askJson(`Select up to 20 relevant actual product or landing pages from these exact search results for ${JSON.stringify({title:p.title,category:p.category,description:p.description.slice(0,2000)})}. Prefer Indian D2C brands where relevant, not unrelated marketplace/category articles. Return JSON {pages:[{url,reason}]}. Do not invent any URLs. Results:${JSON.stringify(candidates)}`,z.object({pages:z.array(z.object({url:z.string(),reason:z.string()}))}));
      selected = ranking.value.pages.filter(v => candidates.some(c => c.url === v.url)).map(v => ({...v,title:candidates.find(c => c.url === v.url)!.title}));
      run.aiCost = (run.aiCost ?? 0) + ranking.estimatedCost;
    } catch { run.warnings.push("AI relevance ranking unavailable; search ranking used and relevance needs review."); }
  }
  // Explicit research still obtains fresh evidence. Partial retries reuse good
  // captures; a failed refresh cannot erase an already usable research set.
  run.competitors = previous.length<8?[...previous]:[];
  for (const r of researchQueue(selected,fallback,run.competitors)) {
    if (run.competitors.filter(c => c.status === "crawled").length >= 8) break;
    const c: Competitor = {id:randomUUID(),...r,status:"crawling",sections:[]};
    run.competitors.push(c);
    await event(run,"crawling_competitors",`Crawling ${new URL(c.url).hostname}; ${run.competitors.filter(v => v.status === "crawled").length} successful sources so far.`);
    try {
      const captured = await crawl(c.url,run.id);
      Object.assign(c,{status:"crawled",screenshot:captured.screenshot,mobileScreenshot:captured.mobileScreenshot,htmlUrl:captured.htmlUrl,sections:captured.sections});
      const text = captured.text.toLowerCase();
      c.analysis = {
        headlineStyle:captured.sections[0] ?? "Not detected",
        reviews:/review|rating/.test(text), faq:/frequently asked|faq/.test(text),
        guarantee:/guarantee/.test(text), urgency:/limited time|ends in|only \d+ left/.test(text),
        pricing:/₹|rs\.|inr|\$\d/.test(text), videos:/<video|youtube|vimeo/i.test(captured.html),
        atc:/add to (cart|bag)/i.test(text), detectionMethod:"HTML/text heuristics; positional interpretation needs visual review",
      };
      if (aiReady()) {
        try {
          const breakdown = await askJson(`Analyse this actual competitor screenshot and headings/excerpt. Learn conversion patterns only, do not quote creative copy. Return JSON object with {hero,headlineStyle,offerDisplay,trust,atcPlacement,faq,media,urgency,unusual,sectionOrder}; values short factual strings except sectionOrder array of strings. If not visible/detected, say not observed. Headings: ${JSON.stringify(captured.sections)}. Excerpt: ${captured.text.slice(0,10000)}`,z.record(z.string(),z.unknown()),captured.screenshotBytes);
          c.analysis = {...c.analysis,...breakdown.value};
          run.aiCost = (run.aiCost ?? 0) + breakdown.estimatedCost;
        } catch { run.warnings.push(`Vision breakdown unavailable for ${new URL(c.url).hostname}; text detection retained.`); }
      }
    } catch (e) { c.status="blocked";c.error=e instanceof Error ? e.message : "Crawl failed"; }
    await event(run,"extracting_patterns",`${new URL(c.url).hostname}: ${c.status}`);
  }
  for(const old of previous){
    if(run.competitors.filter(c=>c.status==="crawled").length>=8)break;
    if(!run.competitors.some(c=>c.status==="crawled"&&new URL(c.url).hostname===new URL(old.url).hostname)){
      run.competitors=run.competitors.filter(c=>c.url!==old.url);
      run.competitors.push(old);
    }
  }
  const successful = run.competitors.filter(c => c.status==="crawled");
  run.learnings = [];
  for (const [key,label] of [["reviews","mention reviews or ratings"],["faq","include FAQ language"],["atc","include an add-to-cart call to action"],["urgency","use detectable urgency language"],["videos","include video markup"]] as const) {
    const sources = successful.filter(c => c.analysis?.[key] === true).map(c => c.url);
    if (sources.length) run.learnings.push({id:randomUUID(),category:p.category,text:`${sources.length} of ${successful.length} successfully crawled pages ${label}. Detection is based on captured HTML/text, not a performance claim.`,sources});
  }
  for(const c of successful){
    for(const key of ["hero","atcPlacement","offerDisplay","media","sectionOrder"]){
      const observed=c.analysis?.[key];
      const text=Array.isArray(observed)?observed.join(" → "):typeof observed==="string"?observed:"";
      if(text&& !/not observed|not detected|unavailable/i.test(text))run.learnings.push({id:randomUUID(),category:p.category,text:`Observed ${key}: ${text.slice(0,500)}. Adapt the design pattern, never the competitor's product claims or assets.`,sources:[c.url]});
    }
  }
  for (const l of run.learnings) await db.insert(learningsTable).values({id:l.id,runId:run.id,category:p.category,data:l});
  if (successful.length < 8) run.warnings.push(`Research coverage: ${successful.length} of the target 8 competitor pages could be captured. Review blocked sources before using these findings.`);
  run.status = "researched";
  run.researchKey=createHash("sha256").update(JSON.stringify({product:run.product,brand:run.brand})).digest("hex");
  run.researchedAt=new Date().toISOString();
  await event(run,"review",`Research saved: ${successful.length} successful sources and ${run.learnings.length} linked observations.`);
}
