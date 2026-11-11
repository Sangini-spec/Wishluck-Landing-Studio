import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {db,publishingJobsTable,publicationsTable,designsTable,runsTable} from "@workspace/db";
import {eq,inArray} from "drizzle-orm";
import {createJob,getJob,saveJob,startDurableJob,withJobLock} from "./durable-jobs";
import {contentHash,recoveredTheme,reportInterruptedUpload,type DurableJob} from "./job-recovery";
import {uploadCliTheme,recoverCliUpload,type UploadServices} from "./shopify-cli";
import {getDesign,getPublication,saveRun,saveDesign,savePublication} from "./store";
import {recoverAudit} from "./audit";
import {deleteRuns} from "./deletion";
import {AppError,type Run,type Design} from "./domain";
import {brand,product,content} from "./render-regression/fixtures";
import {GetPublishingJobsResponse} from "@workspace/api-zod";

const shop="interruption-fixture.myshopify.com";
const ids:string[]=[];
async function receipt(overrides:Partial<DurableJob>={}){
  const id=randomUUID();
  const {job}=await createJob({kind:"upload",designId:id,runId:id,shop,contentHash:"fixture",
    identity:`local-interruption:${id}`,...overrides});
  Object.assign(job,overrides);await saveJob(job);
  ids.push(job.id);return job;
}
async function settled(id:string){
  for(let n=0;n<150;n++){
    const job=await getJob(id);
    if(job&&!["queued","running"].includes(job.status)){
      let unlocked=false;
      await withJobLock(id,async()=>{unlocked=true;});
      if(unlocked)return job;
    }
    await delay(20);
  }
  throw new Error(`Fixture job did not finish: ${id}`);
}
after(async()=>{
  if(ids.length)await db.delete(publishingJobsTable).where(inArray(publishingJobsTable.id,ids));
  await db.$client.end();
});

function fixtureJob(overrides:Partial<DurableJob>={}):DurableJob{
  return {id:"local-job",identity:"local",kind:"upload",designId:"local-design",runId:"local-run",shop,
    contentHash:"hash",phase:"creating",status:"running",createdAt:"2026-01-01",updatedAt:"2026-01-01",
    themeName:"Wishluck exact-job-uuid",beforeThemeIds:["1","2"],...overrides};
}
test("content identity is stable across key order but changes with generated files or destination",()=>{
  assert.equal(contentHash({b:2,a:1}),contentHash({a:1,b:2}));
  assert.notEqual(contentHash({"theme.liquid":"original"}),contentHash({"theme.liquid":"edited"}));
  assert.notEqual(contentHash({shop:"a",hash:"same"}),contentHash({shop:"b",hash:"same"}));
});
test("uncertain creation recovers only a unique exact-name theme outside the pre-upload inventory",async()=>{
  const job=fixtureJob();
  const existing=[{id:"1",name:job.themeName!,role:"main"},{id:"2",name:"Merchant edited theme",role:"unpublished"}];
  const created={id:"3",name:job.themeName!,role:"unpublished"};
  assert.equal(recoveredTheme(job,existing),undefined);
  assert.equal(recoveredTheme(job,[...existing,created])?.id,"3");
  assert.equal(recoveredTheme(job,[...existing,created,{...created,id:"4"}]),undefined);
  assert.equal(recoveredTheme(job,[...existing,{...created,name:job.themeName+" extra"}]),undefined);
  assert.equal(recoveredTheme({...job,beforeThemeIds:undefined},[created]),undefined);
  const result=await reportInterruptedUpload({...job,themeId:"3"},async()=>[{...created,role:"main",name:"Merchant renamed"}]);
  assert.equal(result.theme?.role,"main");
  assert.match(result.message,/No files or product fields were rewritten/);
});
test("database uniqueness returns the same durable receipt to concurrent retried requests",async()=>{
  const identity=`local-interruption:${randomUUID()}`;
  const input={kind:"upload" as const,designId:"local-only",runId:"local-only",shop,contentHash:"same-files",identity};
  const results=await Promise.all(Array.from({length:12},()=>createJob(input)));
  const id=results[0]!.job.id;ids.push(id);
  assert.equal(new Set(results.map(r=>r.job.id)).size,1);
  assert.equal(results.filter(r=>r.created).length,1);
  assert.equal((await getJob(id))?.contentHash,"same-files");
  const other=await createJob({...input,shop:"other-fixture.myshopify.com",identity:identity+":other"});
  ids.push(other.job.id);assert.notEqual(other.job.id,id);
});
test("separate workers cannot execute one receipt concurrently",async()=>{
  const job=await receipt();let calls=0,release!:()=>void,entered!:()=>void;
  const gate=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
  const work=async(j:DurableJob)=>{calls++;entered();await gate;j.status="completed";await saveJob(j);};
  startDurableJob(job.id,work);await started;
  startDurableJob(job.id,work);
  let recovered=false;
  await withJobLock(job.id,async()=>{recovered=true;});
  assert.equal(recovered,false);
  release();await settled(job.id);assert.equal(calls,1);
});

async function uploadFixture(failure:"none"|"after-create"|"before-result"|"verification"="none"){
  const runId=randomUUID(),designId=randomUUID(),category="Local interruption fixture";
  const design={id:designId,runId,name:"Local upload fixture",status:"approved",version:1,checks:[]} as unknown as Design;
  const run={id:runId,url:product.sourceUrl,status:"ready",product:structuredClone(product),brand:structuredClone(brand),
    designs:[],events:[],learnings:[],competitors:[]} as unknown as Run;
  await saveRun(run);await saveDesign(design,content(),category);
  const themes=[{id:"1",name:"Existing live merchant theme",role:"main"},{id:"2",name:"Existing merchant draft",role:"unpublished"}];
  let pushes=0,verifications=0,createdName="",merchantFile="generated";
  const services:UploadServices={
    currentStore:expected=>{assert.equal(expected,shop);return shop;},
    getDesign,
    readAssignment:async(expected)=>{assert.equal(expected,shop);return "merchant-edited-suffix";},
    cliThemes:async expected=>{assert.equal(expected,shop);return structuredClone(themes);},
    runThemeCli:async(expected,args)=>{
      assert.equal(expected,shop);assert.equal(args[0],"push");
      assert.ok(args.includes("--unpublished"));assert.ok(args.includes("--nodelete"));
      assert.ok(!args.includes("--publish"));assert.ok(!args.includes("--allow-live"));
      pushes++;createdName=args[args.indexOf("--theme")+1]!;
      if(failure==="before-result")throw new AppError(502,"Fixture connection dropped before a result");
      const theme={id:"3",name:createdName,role:"unpublished",storeDomain:shop,
        editorUrl:`https://${shop}/admin/themes/3/editor`,previewUrl:`https://${shop}/?preview_theme_id=3`};
      themes.push(theme);
      if(failure==="after-create")throw new AppError(502,"Fixture connection dropped after creation");
      return {theme};
    },
    verifyCliFiles:async()=>{verifications++;if(failure==="verification"){merchantFile="merchant edit";throw new AppError(502,"Fixture readback differs");}},
  };
  return {runId,designId,services,themes,get pushes(){return pushes;},get verifications(){return verifications;},
    get merchantFile(){return merchantFile;},
    addLateTheme(){themes.push({id:"3",name:createdName,role:"unpublished"});},
    async cleanup(){
      await db.delete(publicationsTable).where(eq(publicationsTable.designId,designId));
      await db.delete(designsTable).where(eq(designsTable.id,designId));
      await db.delete(runsTable).where(eq(runsTable.id,runId));
    }};
}
for(const phase of ["creating","verifying","assigning"] as const){
  test(`restart in ${phase} reports the existing theme and never replays writes`,async()=>{
    const fixture=await uploadFixture();
    const job=await receipt({designId:fixture.designId,runId:fixture.runId,phase,status:"running",
      themeName:`Wishluck ${randomUUID()}`,beforeThemeIds:["1","2"]});
    fixture.themes.push({id:"3",name:job.themeName!,role:"unpublished"});
    await savePublication({id:job.id,jobId:job.id,designId:fixture.designId,title:"Restart fixture",
      shop,status:"uploading",method:"theme-access-cli",createdAt:job.createdAt,
      ...(phase==="creating"?{}:{themeId:"3"}),
      ...(phase==="assigning"?{productId:"gid://shopify/Product/fixture",templateSuffix:"wl-before",templateAssigned:false}:{})});
    if(phase!=="creating")fixture.themes[2]!.name="Merchant renamed this theme";
    try{
      // Fresh state is read exclusively from persistence, as after a restart.
      await recoverCliUpload((await getJob(job.id))!,undefined,fixture.services);
      const recovered=(await getPublication(job.id))!;
      assert.equal(recovered.themeId,"3");
      assert.equal((await getJob(job.id))?.status,"attention");
      assert.equal(fixture.pushes,0);assert.equal(fixture.verifications,0);
      if(phase==="assigning"){
        assert.equal(recovered.templateAssigned,false);
        assert.equal((await getJob(job.id))?.templateAssigned,false);
      }
    }finally{await fixture.cleanup();}
  });
}
for(const failure of ["none","after-create","before-result","verification"] as const){
  test(`upload ${failure}: lost responses and retries never issue a second push`,async()=>{
    const fixture=await uploadFixture(failure);
    const options={designId:fixture.designId,expectedShop:shop,confirmUnpublishedUpload:true,productMode:"none" as const};
    let jobId="";
    try{
      const initial=await uploadCliTheme(fixture.designId,shop,options,fixture.services);
      jobId=initial.jobId!;ids.push(jobId);
      assert.equal(initial.status,"uploading");
      await settled(jobId);
      if(failure==="before-result")fixture.addLateTheme();
      const retry=await uploadCliTheme(fixture.designId,shop,options,fixture.services);
      assert.equal(retry.jobId,jobId);
      assert.equal(fixture.pushes,1);
      assert.equal(retry.themeId,"3");
      assert.equal(retry.verified,failure==="none");
      if(failure==="none"){
        const changedOptions=await uploadCliTheme(fixture.designId,shop,{...options,productMode:"existing",productId:"gid://shopify/Product/999999",confirmTemplateAssignment:true},fixture.services);
        assert.equal(changedOptions.jobId,jobId,"Changing destination options must return the same upload receipt");
        assert.equal(fixture.pushes,1,"Changing options must not create a second theme");
      }
      if(failure==="verification"){assert.equal(fixture.merchantFile,"merchant edit");assert.equal(fixture.verifications,1);}
      assert.deepEqual(fixture.themes.slice(0,2),[{id:"1",name:"Existing live merchant theme",role:"main"},{id:"2",name:"Existing merchant draft",role:"unpublished"}]);
      // Simulate a fresh recovery process using only the database record.
      const persisted=(await getJob(jobId))!;
      if(failure!=="none")await recoverCliUpload(persisted,undefined,fixture.services);
      assert.equal((await getPublication(jobId))?.themeId,"3");
      assert.equal(fixture.pushes,1);
      assert.equal((await getJob(jobId))?.shop,shop);
      await deleteRuns(fixture.runId);
      // History deletion must not remove the idempotency receipt.
      assert.ok(await getJob(jobId));
    }finally{await fixture.cleanup();}
  });
}
test("Lighthouse recovery marks only its own interrupted attempt and retains completed scores",async()=>{
  const fixture=await uploadFixture();
  const job=await receipt({kind:"lighthouse",runId:fixture.runId,designId:fixture.designId,phase:"auditing",status:"running"});
  try{
    const saved=await getDesign(fixture.designId);
    saved.design.lighthouse={status:"running",jobId:job.id};
    await saveDesign(saved.design,saved.content,saved.category);
    await assert.rejects(deleteRuns(fixture.runId),/saved publishing or Lighthouse/);
    await recoverAudit(job);
    const interrupted=(await getDesign(fixture.designId)).design.lighthouse!;
    assert.equal(interrupted.status,"failed");assert.equal(interrupted.performance,undefined);
    saved.design.lighthouse={status:"completed",jobId:job.id,performance:91,seo:97,accessibility:95};
    await saveDesign(saved.design,saved.content,saved.category);
    job.status="running";await saveJob(job);await recoverAudit(job);
    assert.equal((await getJob(job.id))?.status,"completed");
    assert.equal((await getDesign(fixture.designId)).design.lighthouse?.performance,91);
  }finally{await fixture.cleanup();}
});
test("progress response exposes no private recovery inventory or source data",()=>{
  const response=GetPublishingJobsResponse.parse([{...fixtureJob(),beforeThemeIds:["private"],identity:"private",sourceHash:"private",credential:"fixture-not-a-real-secret"}]);
  assert.ok(!("identity" in response[0]!));
  assert.ok(!("beforeThemeIds" in response[0]!));
  assert.ok(!("credential" in response[0]!));
});
