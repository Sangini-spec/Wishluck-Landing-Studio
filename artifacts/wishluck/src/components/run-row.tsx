import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import type { Run } from "@workspace/api-client-react";
import { StatusPill } from "@/components/bits";
import { ago, host } from "@/lib/run-utils";
import {deleteRun} from "@workspace/api-client-react";
import {DeleteMenu} from "./delete-menu";

export function RunRow({ run }: { run: Run }) {
  const img = run.product?.images?.[0];
  return (
    <div className="group flex items-center gap-1 border-b border-border pr-3 last:border-0 hover:bg-muted/50">
    <Link href={`/runs/${run.id}`} data-testid={`row-run-${run.id}`}
      className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5 transition-colors">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
        {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <div className="hatch h-full w-full" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{run.product?.title || host(run.url)}</div>
        <div className="mt-0.5 flex items-center gap-2 truncate font-mono text-[11px] text-muted-foreground">
          <span className="truncate">{host(run.url)}</span>
          {run.product?.category && <><span>/</span><span className="truncate">{run.product.category}</span></>}
        </div>
      </div>
      <div className="hidden text-right text-xs text-muted-foreground sm:block">
        <div className="tabular-nums">{run.designs.length} design{run.designs.length === 1 ? "" : "s"} · {run.competitors.length} competitors</div>
        <div className="mt-0.5">{ago(run.createdAt)}</div>
      </div>
      <StatusPill status={run.status} />
      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
    <DeleteMenu label={run.product?.title||host(run.url)} title="Delete this run?" description="Permanently remove this run, its saved designs, learnings, feedback and local publication records. This cannot be undone. Shopify products and themes are not deleted." onDelete={()=>deleteRun(run.id)} disabled={["queued","analysing","researching","generating"].includes(run.status)}/>
    </div>
  );
}
