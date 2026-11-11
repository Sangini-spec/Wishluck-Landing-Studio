import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db,runsTable,designsTable,learningsTable,feedbackTable,publicationsTable,preferencesTable} from "@workspace/db";
import {eq} from "drizzle-orm";
import {deleteRuns,deleteMemory,deletePublications} from "./deletion";
import {categoryContext,listRuns} from "./store";
import {withRunLock} from "./jobs";

after(async()=>{await db.$client.end();});
test("deletions are scoped, transactional and preserve runs when only memory or history is removed",async t=>{
  const id=randomUUID(),designId=randomUUID(),publicationId=randomUUID(),category=`Deletion check ${id}`;
  const source=(await listRuns()).find(r=>r.product&&r.designs.length&&r.learnings.length);
  if(!source)return t.skip("Development integration check requires one complete source run.");
  const learning={...source.learnings[0]!,id:randomUUID(),category};
  const run={...structuredClone(source),id,product:{...source.product!,title:"Deletion verification fixture",category},designs:[],learnings:[learning]};
  const design={...source.designs[0]!,id:designId,runId:id,name:"Deletion verification fixture",status:"draft"};
  await db.insert(runsTable).values({id,url:run.url,category,status:"ready",data:run});
  try{
    await db.insert(designsTable).values({id:designId,runId:id,category,status:"draft",data:design,content:{}});
    await db.insert(learningsTable).values({id:learning.id,runId:id,category,data:learning});
    await db.insert(feedbackTable).values({id:randomUUID(),designId,category,action:"approve"});
    await db.insert(publicationsTable).values({id:publicationId,designId,status:"failed",data:{id:publicationId,designId,title:"Deletion verification fixture",status:"failed",createdAt:new Date().toISOString()}});
    assert.equal((await categoryContext(category)).designs.length,1);
    await withRunLock(id,async()=>{await assert.rejects(deleteRuns(id),/Wait for processing/);});
    assert.equal((await deletePublications(publicationId)).deleted,1);
    assert.equal((await db.select().from(designsTable).where(eq(designsTable.id,designId))).length,1);
    await deleteMemory(category);
    const memory=await categoryContext(category);
    assert.equal(memory.designs.length,0);assert.equal(memory.learnings.length,0);assert.equal(memory.feedback.length,0);
    const [run]=await db.select().from(runsTable).where(eq(runsTable.id,id));
    assert.ok(run);assert.deepEqual(run.data.learnings,[]);
    assert.equal((await db.select().from(designsTable).where(eq(designsTable.id,designId))).length,1);
    assert.equal((await deleteRuns(id)).deleted,1);
    assert.equal((await db.select().from(designsTable).where(eq(designsTable.id,designId))).length,0);
    await assert.rejects(deleteRuns(id),/Run not found/);
  }finally{
    await deleteRuns(id).catch(()=>{});
    await db.delete(preferencesTable).where(eq(preferencesTable.key,`memory:${category}`));
  }
});
