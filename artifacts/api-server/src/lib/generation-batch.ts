import type {Run} from "./domain";
export function unfinishedBatchStart(run:Run){
  const completed=run.events.map(e=>e.stage).lastIndexOf("ready");
  return run.events.slice(completed+1).find(e=>e.stage==="retrieving_memory")?.at;
}
