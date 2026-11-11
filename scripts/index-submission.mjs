import {readFile,writeFile} from "node:fs/promises";
const root="docs/results";
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,"utf8"));
const percent=n=>`${Math.max(0,Math.min(100,Math.round(Number(n))))}%`;
let text=`# Five-product showcase\n\nA collection of five analysed products, original landing-page designs and research-backed results. Snapshot: ${manifest.generatedAt} (UTC).\n\n![Wishluck dashboard](dashboard-overview.jpg)\n\n## Saved design scores\n\nAll five products completed analysis and design generation. Percentages below are the **latest saved design's local page-check coverage**, matching the dashboard's Overall/SEO/AEO/GEO circles. Each product page includes the individual scores for four captured designs.\n\n| Product | Category | Saved designs | Research sources | Captures | Overall | SEO | AEO | GEO |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n`;
const lighthouseRows=[];
for(const p of manifest.products){
  const brand=JSON.parse(await readFile(`${root}/${p.slug}/brand-analysis.json`,"utf8"));
  const research=JSON.parse(await readFile(`${root}/${p.slug}/research.json`,"utf8"));
  const designs=JSON.parse(await readFile(`${root}/${p.slug}/design-fingerprints.json`,"utf8"));
  const s=designs[0].localCheckCoverage;
  text+=`| [${p.title}](${p.slug}/README.md) | ${p.category} | ${p.totalDesigns} | ${research.competitors.length} | ${p.captures} | ${percent(s.overall)} | ${percent(s.seo)} | ${percent(s.aeo)} | ${percent(s.geo)} |\n`;
  let detail=`# ${p.title}\n\n- Category: ${p.category}\n- [Public product source](${p.sourceUrl})\n- **${p.totalDesigns} saved designs** and **${p.captures} responsive captures**.\n- ${research.competitors.length} linked research sources.\n- Recorded cumulative AI estimate: **$${Number(brand.aiCostEstimateUSD??0).toFixed(4)}** across this run's recorded work.\n\n## Design scores and responsive previews\n\nOverall/SEO/AEO/GEO values are saved **local page-check coverage** percentages. These dashboard HTML previews show four directions at each required width.\n\n| Design | Overall | SEO | AEO | GEO | Mobile 360px | Tablet 768px | Desktop 1440px |\n|---|---:|---:|---:|---:|---|---|---|\n`;
  for(let i=0;i<4;i++){
    const d=designs[i],s=d.localCheckCoverage;
    detail+=`| ${d.name} | ${percent(s.overall)} | ${percent(s.seo)} | ${percent(s.aeo)} | ${percent(s.geo)} | [Preview](design-${i+1}-360.jpg) | [Preview](design-${i+1}-768.jpg) | [Preview](design-${i+1}-1440.jpg) |\n`;
  }
  detail+=`\n![Saved Overall, SEO, AEO and GEO percentages](design-scores.jpg)\n\n## Research and design data\n\n- [Brand analysis and recorded cost](brand-analysis.json)\n- [Research sources, observations and linked learnings](research.json)\n- [All design fingerprints and saved checks](design-fingerprints.json)\n- [Responsive capture measurements](responsive-results.json)\n- [Structured-data JSON and local validation results](schema-results.json)\n- [Tracked Shopify records and unsigned links](shopify-results.json)\n`;
  if(p.audits.length){
    detail+=`\n## Measured Shopify Lighthouse reports\n\nLighthouse measures storefront performance, SEO and accessibility separately from the local design scores above. Report links preserve the recorded scores and timestamps with private access details sanitized.\n\n`;
    for(let i=0;i<p.audits.length;i++){
      const a=p.audits[i],summary=JSON.parse(await readFile(`${root}/${p.slug}/lighthouse-${i+1}-summary.json`,"utf8"));
      const destination=summary.requestedUrl?.includes("the-inventory-not-tracked-snowboard")?"Development-store snowboard destination":p.title;
      detail+=`### ${destination} — report ${i+1}\n\n**${a.performance} performance / ${a.seo} SEO / ${a.accessibility} accessibility**, recorded ${a.testedAt}.\n\n[Score screenshot](lighthouse-${i+1}.jpg) · [Interactive report](lighthouse-${i+1}.html) · [Measurement data](lighthouse-${i+1}-summary.json)\n\n`;
      if(i===0)lighthouseRows.push(`| [${p.title}](${p.slug}/README.md) | ${a.performance} | ${a.seo} | ${a.accessibility} | [Report](${p.slug}/lighthouse-${i+1}.html) · [Screenshot](${p.slug}/lighthouse-${i+1}.jpg) |`);
    }
  }
  await writeFile(`${root}/${p.slug}/README.md`,detail);
}
text+=`\n## Measured Shopify Lighthouse reports\n\nThese archived storefront measurements are presented separately from the five-product local design scores above.\n\n| Product | Performance | SEO | Accessibility | Evidence |\n|---|---:|---:|---:|---|\n${lighthouseRows.join("\n")}\n\n## Showcase contents\n\n- **60 responsive screenshots:** four design directions × five products × three viewport widths.\n- Product and brand analysis, source-linked competitor research and category learnings.\n- Complete saved layout fingerprints and per-design local scores.\n- Structured-data JSON and local parsing/shape checks for the captured designs.\n- Recorded Shopify measurements, screenshots and interactive reports.\n- [Development-store access](../REVIEWER_ACCESS.md) and [test verification](verification.json).\n\n## Reproduce the showcase\n\n\`\`\`sh\nnode scripts/package-submission.mjs --origin https://YOUR_RUNNING_PREVIEW\nnode scripts/index-submission.mjs\n\`\`\`\n\nThe exporter reads saved product runs and existing reports. Capture measurements and timestamps are included in the product data files.\n`;
await writeFile(`${root}/README.md`,text);
console.log("Indexed five generated products with their saved Overall/SEO/AEO/GEO percentages.");
