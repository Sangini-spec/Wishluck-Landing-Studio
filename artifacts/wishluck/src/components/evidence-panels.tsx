import { ExternalLink, Gauge, Loader2 } from "lucide-react";
import type { Design } from "@workspace/api-client-react";
import { Btn } from "@/components/bits";
import { ago } from "@/lib/run-utils";
import { cn } from "@/lib/utils";
import { lighthouseMetrics, lighthouseState } from "@/lib/evidence";

const eyebrow = "font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground";

/** Compact SEO / AEO / GEO content scores. Local page checks, not Lighthouse. */
export function ScoresPanel({ design }: { design: Design }) {
  return (
    <div className="panel p-4" data-testid="panel-scores">
      <div className="mb-3 flex items-baseline justify-between"><span className={eyebrow}>Content scores</span><span className="font-mono text-[10px] text-muted-foreground">local check, not Lighthouse</span></div>
      <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
        {(["seo", "aeo", "geo"] as const).map((k) => (
          <div key={k} className="px-2 py-2 text-center" data-testid={`text-score-${k}`}>
            <dd className="font-mono text-lg tabular-nums">{Math.round(design.scores[k])}</dd>
            <dt className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">{k}</dt>
          </div>))}
      </dl>
    </div>
  );
}

export function LighthousePanel({ design, onAudit, auditing }: { design: Design; onAudit: () => void; auditing: boolean }) {
  const lh = design.lighthouse;
  const state = lighthouseState(lh);
  const metrics = lighthouseMetrics(lh);
  return (
    <div className="panel p-4" data-testid="panel-lighthouse">
      <div className="mb-3 flex items-center justify-between"><span className={eyebrow}>Lighthouse</span>
        <Btn data-testid="button-audit" variant="ghost" className="h-7 px-2 text-xs" disabled={auditing} onClick={onAudit}>{auditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gauge className="h-3.5 w-3.5" />} Run audit</Btn></div>
      {state === "none" && <p data-testid="text-lighthouse-none" className="text-[13px] text-muted-foreground">Not run yet.</p>}
      {state === "running" && <p data-testid="text-lighthouse-running" className="flex items-center gap-2 text-[13px]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</p>}
      {state === "failed" && <p data-testid="text-lighthouse-error" className="text-xs text-destructive">{lh?.error || "Audit failed."}</p>}
      {state === "complete" && <ul className="space-y-1.5">{metrics.map((m) => (
        <li key={m.key} data-testid={`lighthouse-${m.key}`} className="flex items-center justify-between text-[13px]">
          <span>{m.label}</span>
          <span className={cn("font-mono tabular-nums", m.value == null ? "text-muted-foreground" : m.meets ? "text-[hsl(var(--jade))]" : "text-destructive")}>{m.value ?? "n/a"}</span>
        </li>))}</ul>}
      {state === "complete" && lh?.testedAt && <p className="mt-2 text-[11px] text-muted-foreground">Measured {ago(lh.testedAt)}</p>}
      {lh?.url && <a data-testid="link-lighthouse-report" href={lh.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline">Open report<ExternalLink className="h-3 w-3" /></a>}
    </div>
  );
}
