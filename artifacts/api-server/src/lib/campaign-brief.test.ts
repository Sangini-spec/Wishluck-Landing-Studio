import {test} from "node:test";
import assert from "node:assert/strict";
import {campaignBrief} from "./campaign-brief";
import {missingFacts} from "./facts";
import {product,brand,content,design} from "./render-regression/fixtures";
import {checkDesign} from "./quality";
import {resolvePlan} from "./render-plan";

test("campaign brief uses verified facts and omits answers to unknown policies",()=>{
  const p={...product,specs:{Fabric:"100% cotton","Box contents":"One garment",Capacity:"350 ml","Suitable for":"Everyday use"}};
  const brief=campaignBrief(p,brand);
  assert.ok(brief.requiredSections.includes("specs"));
  assert.ok(brief.requiredSections.includes("purchase"));
  assert.ok(brief.questions.some(question=>question.answer==="Fabric: 100% cotton"));
  assert.ok(!brief.questions.some(question=>question.factKey==="returns"||question.factKey==="delivery"));
  assert.ok(!missingFacts(p).includes("Materials"));
  assert.ok(!missingFacts(p).includes("Package contents"));
  assert.ok(!missingFacts(p).includes("Dimensions"));
  assert.ok(!missingFacts(p).includes("Intended audience"));
});
test("placeholder facts cannot raise readiness or become factual FAQ answers",()=>{
  const p={...product,specs:{Materials:"Unknown",Dimensions:"Not provided by manufacturer","Return policy":"TBD"}};
  const brief=campaignBrief(p,brand);
  assert.deepEqual(brief.verifiedSpecs,{});
  assert.ok(!brief.questions.some(question=>["material","dimension","returns"].includes(question.factKey)));
  assert.ok(missingFacts(p).includes("Materials"));
});
test("local content scores do not count unrun external tests as content failures",()=>{
  const c=content(),brief=campaignBrief(product,brand);
  c.faqs=brief.questions.map(({question,answer})=>({question,answer}));
  const result=checkDesign(design,c,product,brand);
  assert.equal(result.checks.find(check=>check.key==="faq-evidence")?.status,"passed");
  assert.equal(result.checks.find(check=>check.key==="product-rich-results")?.category,"EXTERNAL");
  assert.equal(result.checks.find(check=>check.key==="product-rich-results")?.status,"unverified");
  const aeo=result.checks.filter(check=>check.category==="AEO");
  assert.equal(result.scores.aeo,Math.round(aeo.filter(check=>check.status==="passed").length/aeo.length*100));
});
test("hidden specifications and omitted FAQs cannot earn presence-only readiness points",()=>{
  const c=content();c.visualPlan={...resolvePlan(c),sections:["hero","story"]};c.sections=["hero","story"];
  const result=checkDesign(design,c,product,brand);
  assert.equal(result.checks.find(check=>check.key==="faq")?.status,"failed");
  assert.equal(result.checks.find(check=>check.key==="specs")?.status,"failed");
});
test("a failed or incomplete Lighthouse run never becomes a passing local or external score",()=>{
  for(const lighthouse of [{status:"failed",performance:99,seo:100,accessibility:100},{status:"completed",performance:99,seo:100}]){
    const d={...design,lighthouse} as typeof design;
    const result=checkDesign(d,content(),product,brand);
    assert.equal(result.checks.find(check=>check.key==="lighthouse")?.status,"unverified");
    assert.equal(result.checks.find(check=>check.key==="lighthouse")?.category,"EXTERNAL");
  }
  const d={...design,lighthouse:{status:"completed",performance:99,seo:69,accessibility:99}} as typeof design;
  assert.equal(checkDesign(d,content(),product,brand).checks.find(check=>check.key==="lighthouse")?.status,"failed");
});
test("repeat purchase imagery keeps descriptive alt text rather than an empty description",()=>{
  const c=content();c.visualPlan={...resolvePlan(c),sections:["hero","story","faq","purchase"]};
  c.sections=["hero","story","faq","purchase"];
  const result=checkDesign(design,c,product,brand);
  assert.equal(result.checks.find(check=>check.key==="alt")?.status,"passed");
});
test("identity and price FAQs plus basic markup cannot earn perfect answer or search readiness",()=>{
  const p={...product,specs:{},reviews:[]},brief=campaignBrief(p,brand);
  const c={...content(),specs:{},faqs:brief.questions.map(({question,answer})=>({question,answer})),productSnapshot:p};
  const result=checkDesign(design,c,p,brand);
  assert.equal(result.checks.find(check=>check.key==="faq-depth")?.status,"failed");
  assert.equal(result.checks.find(check=>check.key==="product-depth")?.status,"failed");
  assert.ok(result.scores.aeo<100);
  assert.ok(result.scores.seo<100);
});
