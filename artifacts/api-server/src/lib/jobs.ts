import { getRun, event } from "./store";
import { logger } from "./logger";
import type { Run } from "./domain";
import { AppError } from "./domain";

const active=new Set<string>();
const queue:{id:string;work:(run:Run)=>Promise<unknown>}[]=[];
let working=0;
const concurrency=2;
export function enqueue(id:string,work:(run:Run)=>Promise<unknown>){
  if(active.has(id))throw new AppError(409,"This run already has an active job.");
  if(queue.length>=10)throw new AppError(429,"The background queue is full; try again shortly.");
  active.add(id);queue.push({id,work});drain();
}
export const isActive=(id:string)=>active.has(id);
export async function withRunLocks<T>(ids:string[],work:()=>Promise<T>){
  if(ids.some(id=>active.has(id)))throw new AppError(409,"Wait for processing or publishing to finish before deleting this data.");
  ids.forEach(id=>active.add(id));
  try{return await work();}finally{ids.forEach(id=>active.delete(id));}
}
export async function withRunLock<T>(id:string,work:()=>Promise<T>){
  if(active.has(id))throw new AppError(409,"This run already has an active job.");
  active.add(id);
  try{return await work();}finally{active.delete(id);}
}
function drain(){
  while(working<concurrency&&queue.length){
    const job=queue.shift()!;working++;
    setImmediate(async()=>{
      try{const run=await getRun(job.id);await job.work(run);}
      catch(e){
        const run=await getRun(job.id).catch(()=>null);
        if(run){run.status="failed";run.error=e instanceof Error?e.message:"Background processing failed";await event(run,"failed",run.error);}
        logger.warn({runId:job.id},"Background job failed; see the run's recorded error.");
      }
      finally{working--;active.delete(job.id);drain();}
    });
  }
}
