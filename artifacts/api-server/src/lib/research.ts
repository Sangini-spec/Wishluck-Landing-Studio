import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, learningsTable } from "@workspace/db";
import { crawl } from "./crawler";
import { askJson, aiReady } from "./ai";
import { event } from "./store";
import { AppError, type Run, type Competitor } from "./domain";
import { search } from "./search";
export async function research(run: Run) {
  if (!run.product) throw new AppError(409,"Analyse a product first.");
  const p = run.product;
  run.status = "researching";
  await event(run,"finding_competitors",`Searching for ${p.category} competitors, with preference for Indian D2C brands.`);
  const ownHost = new URL(run.url).hostname;
  const results = [];
  for(const query of [
    `${p.category} ${p.title.split(" ").slice(0,5).join(" ")} buy India D2C product`,
    `${p.category} Indian D2C brand product buy -site:${ownHost}`,
    `${p.category} product landing page buy online -site:${ownHost}`,
  ]){
    results.push(...await search(query));
    await new Promise(r=>setTimeout(r,1100));
  }
  const hosts = new Set<string>();
  const candidates = results.filter(r => {
    try {
      const u = new URL(r.url);
      if (u.protocol !== "https:" || u.hostname === ownHost || hosts.has(u.hostname) || /(amazon\.|flipkart\.|youtube\.|instagram\.|pinterest\.|facebook\.)/.test(u.hostname)) return false;
      hosts.add(u.hostname); return true;
    } catch { return false; }
  }).slice(0,24);
  let selected = candidates.map(r => ({url:r.url,title:r.title,reason:`Search relevance to ${p.category} and ${p.title}; Indian commercial-intent query. Relevance requires evidence review.`}));
  if (aiReady() && candidates.length) {
    try {
      const ranking = await askJson(`Select up to 20 relevant actual product or landing pages from these exact search results for ${JSON.stringify({title:p.title,category:p.category,description:p.description.slice(0,2000)})}. Prefer Indian D2C brands where relevant, not unrelated marketplace/category articles. Return JSON {pages:[{url,reason}]}. Do not invent any URLs. Results:${JSON.stringify(candidates)}`,z.object({pages:z.array(z.object({url:z.string(),reason:z.string()}))}));
      selected = ranking.value.pages.filter(v => candidates.some(c => c.url === v.url)).map(v => ({...v,title:candidates.find(c => c.url === v.url)!.title}));
      run.aiCost = (run.aiCost ?? 0) + ranking.estimatedCost;
    } catch { run.warnings.push("AI relevance ranking unavailable; search ranking used and relevance needs review."); }
  }
  run.competitors = [];
  for (const r of selected) {
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
  const successful = run.competitors.filter(c => c.status==="crawled");
  run.learnings = [];
  for (const [key,label] of [["reviews","mention reviews or ratings"],["faq","include FAQ language"],["atc","include an add-to-cart call to action"],["urgency","use detectable urgency language"],["videos","include video markup"]] as const) {
    const sources = successful.filter(c => c.analysis?.[key] === true).map(c => c.url);
    if (sources.length) run.learnings.push({id:randomUUID(),category:p.category,text:`${sources.length} of ${successful.length} successfully crawled pages ${label}. Detection is based on captured HTML/text, not a performance claim.`,sources});
  }
  for (const l of run.learnings) await db.insert(learningsTable).values({id:l.id,runId:run.id,category:p.category,data:l});
  if (successful.length < 8) run.warnings.push(`Research coverage: ${successful.length} of the target 8 competitor pages could be captured. Review blocked sources before using these findings.`);
  run.status = "researched";
  await event(run,"review",`Research saved: ${successful.length} successful sources and ${run.learnings.length} linked observations.`);
}
