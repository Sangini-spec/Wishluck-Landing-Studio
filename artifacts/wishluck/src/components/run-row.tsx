import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import type { Run } from "@workspace/api-client-react";
import { StatusPill } from "@/components/bits";
import { ago, host } from "@/lib/run-utils";

export function RunRow({ run }: { run: Run }) {
  const img = run.product?.images?.[0];
  return (
    <Link href={`/runs/${run.id}`} data-testid={`row-run-${run.id}`}
      className="group flex items-center gap-4 border-b border-border px-4 py-3.5 transition-colors last:border-0 hover:bg-muted/50">
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
  );
}
