import {db,runsTable,designsTable,feedbackTable,learningsTable,artifactsTable,publicationsTable,preferencesTable} from "@workspace/db";
import {eq,inArray,and,sql} from "drizzle-orm";
import {AppError} from "./domain";
import {withRunLocks} from "./jobs";

export async function deleteRuns(id?:string){
  const rows=await db.select({id:runsTable.id}).from(runsTable).where(id?eq(runsTable.id,id):undefined);
  if(id&&!rows.length)throw new AppError(404,"Run not found.");
  const ids=rows.map(row=>row.id);
  return withRunLocks(ids,async()=>db.transaction(async tx=>{
    if(!ids.length)return {deleted:0};
    const designs=await tx.select({id:designsTable.id}).from(designsTable).where(inArray(designsTable.runId,ids));
    const designIds=designs.map(d=>d.id);
    if(designIds.length){
      const active=await tx.select({id:publicationsTable.id}).from(publicationsTable).where(and(inArray(publicationsTable.designId,designIds),eq(publicationsTable.status,"uploading")));
      if(active.length)throw new AppError(409,"Wait for publishing to finish before deleting this run.");
      await tx.delete(publicationsTable).where(inArray(publicationsTable.designId,designIds));
      await tx.delete(feedbackTable).where(inArray(feedbackTable.designId,designIds));
      await tx.delete(designsTable).where(inArray(designsTable.id,designIds));
    }
    await tx.delete(learningsTable).where(inArray(learningsTable.runId,ids));
    await tx.delete(artifactsTable).where(inArray(artifactsTable.runId,ids));
    await tx.delete(runsTable).where(inArray(runsTable.id,ids));
    return {deleted:ids.length};
  }));
}
export async function deleteMemory(category:string){
  const rows=await db.select({id:runsTable.id}).from(runsTable).where(eq(runsTable.category,category));
  if(!rows.length)throw new AppError(404,"Category not found.");
  return withRunLocks(rows.map(row=>row.id),async()=>db.transaction(async tx=>{
    const key=`memory:${category}`,value=new Date().toISOString();
    await tx.insert(preferencesTable).values({key,value}).onConflictDoUpdate({target:preferencesTable.key,set:{value}});
    await tx.delete(learningsTable).where(eq(learningsTable.category,category));
    await tx.delete(feedbackTable).where(eq(feedbackTable.category,category));
    await tx.update(runsTable).set({data:sql`jsonb_set(${runsTable.data}, '{learnings}', '[]'::jsonb)`}).where(eq(runsTable.category,category));
    return {deleted:1};
  }));
}
export async function deletePublications(id?:string){
  const rows=await db.select().from(publicationsTable).where(id?eq(publicationsTable.id,id):undefined);
  const linked=rows.length?await db.select({runId:designsTable.runId}).from(designsTable).where(inArray(designsTable.id,rows.map(row=>row.designId))):[];
  return withRunLocks([...new Set(linked.map(row=>row.runId))],async()=>db.transaction(async tx=>{
    if(id&&!rows.length)throw new AppError(404,"Publication record not found.");
    if(rows.some(row=>row.status==="uploading"))throw new AppError(409,"Wait for publishing to finish before deleting its history.");
    if(rows.length)await tx.delete(publicationsTable).where(inArray(publicationsTable.id,rows.map(row=>row.id)));
    return {deleted:rows.length};
  }));
}
