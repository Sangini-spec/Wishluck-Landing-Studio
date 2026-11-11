import {randomUUID} from "node:crypto";
import {db,pool,publishingJobsTable} from "@workspace/db";
import {eq,inArray,desc} from "drizzle-orm";
import type {DurableJob} from "./job-recovery";
import {logger} from "./logger";

export async function durableJobs(){
  const rows=await db.select().from(publishingJobsTable).orderBy(desc(publishingJobsTable.createdAt));
  return rows.map(r=>r.data as unknown as DurableJob);
}
export async function getJob(id:string){
  const [row]=await db.select().from(publishingJobsTable).where(eq(publishingJobsTable.id,id));
  return row?.data as unknown as DurableJob|undefined;
}
export async function saveJob(job:DurableJob){
  job.updatedAt=new Date().toISOString();
  await db.update(publishingJobsTable).set({status:job.status,data:{...job}}).where(eq(publishingJobsTable.id,job.id));
}
export async function createJob(input:Omit<DurableJob,"id"|"createdAt"|"updatedAt"|"phase"|"status">){
  const now=new Date().toISOString();
  const job:DurableJob={...input,id:randomUUID(),phase:"queued",status:"queued",createdAt:now,updatedAt:now};
  const inserted=await db.insert(publishingJobsTable).values({id:job.id,identity:job.identity,status:job.status,data:{...job}}).onConflictDoNothing().returning();
  if(inserted.length)return {job,created:true};
  const [existing]=await db.select().from(publishingJobsTable).where(eq(publishingJobsTable.identity,input.identity));
  if(!existing)throw new Error("Could not retrieve the durable job receipt.");
  return {job:existing.data as unknown as DurableJob,created:false};
}
// A PostgreSQL session lock outlives HTTP requests and excludes other workers.
// On process death it is released; recovery never repeats uncertain writes.
export async function withJobLock(id:string,work:()=>Promise<void>){
  const client=await pool.connect();
  try{
    const result=await client.query("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked",[`publishing-job:${id}`]);
    if(!result.rows[0].locked)return;
    try{await work();}finally{await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))",[`publishing-job:${id}`]);}
  }finally{client.release();}
}
export function startDurableJob(id:string,work:(job:DurableJob)=>Promise<void>){
  setImmediate(()=>void withJobLock(id,async()=>{
    const job=await getJob(id);
    if(!job||job.status!=="queued")return;
    job.status="running";await saveJob(job);
    try{await work(job);}
    catch{
      // Never persist arbitrary subprocess errors/credentials.
      job.status="attention";job.error="Processing stopped. Saved progress is retained; no automatic remote write will be retried.";
      await saveJob(job);
    }
  }).catch(()=>logger.warn({jobId:id},"Durable job stopped; saved phase retained.")));
}
export async function recoverDurableJobs(recover:(job:DurableJob)=>Promise<void>){
  const rows=await db.select().from(publishingJobsTable).where(inArray(publishingJobsTable.status,["queued","running"]));
  for(const row of rows)await withJobLock(row.id,async()=>{
    const job=await getJob(row.id);
    if(job&&["queued","running"].includes(job.status))await recover(job);
  });
}
