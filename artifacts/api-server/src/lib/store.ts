import { db, runsTable, designsTable, feedbackTable, learningsTable, publicationsTable } from "@workspace/db";
import { desc, eq, inArray,and,gt } from "drizzle-orm";
import {preference} from "./preferences";
import type { Run, Design, DesignContent, Publication, Learning } from "./domain";
import { AppError } from "./domain";
import {designUploadState} from "./publication-status";

export async function listRuns(): Promise<Run[]> {
  const [rows, designs,uploads] = await Promise.all([
    db.select().from(runsTable).orderBy(desc(runsTable.createdAt)).limit(200),
    db.select().from(designsTable).orderBy(desc(designsTable.createdAt)),
    publications(),
  ]);
  return rows.map(row => ({ ...row.data, designs: designs.filter(d => d.runId === row.id).map(d => designUploadState(d.data as Design,uploads)) }) as Run);
}
export async function getRun(id: string): Promise<Run> {
  const [row] = await db.select().from(runsTable).where(eq(runsTable.id, id));
  if (!row) throw new AppError(404, "Run not found");
  const designs = await db.select().from(designsTable).where(eq(designsTable.runId, id)).orderBy(desc(designsTable.createdAt));
  const uploads=await publications();
  return { ...row.data, designs: designs.map(d => designUploadState(d.data as Design,uploads)) } as Run;
}
export async function saveRun(run: Run) {
  const data = { ...run, designs: [] };
  await db.insert(runsTable).values({
    id: run.id, url: run.url, category: run.product?.category ?? "Uncategorised", status: run.status, data,
  }).onConflictDoUpdate({ target: runsTable.id, set: { data, status: run.status, category: run.product?.category ?? "Uncategorised", updatedAt: new Date() } });
}
export async function event(run: Run, stage: string, message: string) {
  run.stage = stage;
  run.events.push({ stage, message, at: new Date().toISOString() });
  await saveRun(run);
}
export async function getDesign(id: string) {
  const [row] = await db.select().from(designsTable).where(eq(designsTable.id, id));
  if (!row) throw new AppError(404, "Design not found");
  const content=row.content as unknown as DesignContent;
  const run=await getRun(row.runId);
  return { design: row.data as Design, content, category: row.category,
    run:{...run,product:content.productSnapshot??run.product,brand:content.brandSnapshot??run.brand} };
}
export async function saveDesign(design: Design, content: DesignContent, category: string) {
  const row = { id: design.id, runId: design.runId, category, version: design.version, status: design.status, data: design as Record<string, unknown>, content: content as unknown as Record<string, unknown> };
  await db.insert(designsTable).values(row).onConflictDoUpdate({ target: designsTable.id, set: row });
}
export async function categoryContext(category: string) {
  const reset=await preference<string>(`memory:${category}`);
  const since=reset?new Date(reset):undefined;
  const [designs, feedback, learnings] = await Promise.all([
    db.select().from(designsTable).where(and(eq(designsTable.category, category),since?gt(designsTable.createdAt,since):undefined)).orderBy(desc(designsTable.createdAt)).limit(100),
    db.select().from(feedbackTable).where(and(eq(feedbackTable.category, category),since?gt(feedbackTable.createdAt,since):undefined)).orderBy(desc(feedbackTable.createdAt)).limit(30),
    db.select().from(learningsTable).where(and(eq(learningsTable.category, category),since?gt(learningsTable.createdAt,since):undefined)).orderBy(desc(learningsTable.createdAt)).limit(50),
  ]);
  return { designs: designs.map(d => d.data as Design), feedback, learnings: learnings.map(l => l.data as Learning) };
}
export async function publications(): Promise<Publication[]> {
  const rows = await db.select().from(publicationsTable).orderBy(desc(publicationsTable.createdAt)).limit(100);
  return rows.map(row => row.data as Publication);
}
export async function getPublication(id:string):Promise<Publication|undefined>{
  const [row]=await db.select().from(publicationsTable).where(eq(publicationsTable.id,id));
  return row?.data as Publication|undefined;
}
export async function savePublication(p: Publication) {
  const row = { id: p.id, designId: p.designId, status: p.status, data: p as Record<string, unknown> };
  await db.insert(publicationsTable).values(row).onConflictDoUpdate({ target: publicationsTable.id, set: row });
}
export async function recoverInterruptedJobs(){
  const rows=await db.select().from(runsTable).where(inArray(runsTable.status,["queued","analysing","researching","generating"]));
  for(const row of rows){
    const run=row.data as Run;
    run.status="failed";run.error="Processing was interrupted by a server restart. Re-run analysis or resume research/generation after reviewing saved results.";
    await event(run,"interrupted",run.error);
  }
}
