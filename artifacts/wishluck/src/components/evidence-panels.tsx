import type { ReactNode } from "react";
import { Check as CheckIcon, X, CircleDashed, ExternalLink, Gauge, Loader2, ShieldQuestion, FileText, Hourglass } from "lucide-react";
import type { Check, Design } from "@workspace/api-client-react";
import { Btn } from "@/components/bits";
import { ago } from "@/lib/run-utils";
import { cn } from "@/lib/utils";
import { groupByLane, lighthouseMetrics, lighthouseState, sortChecks, tally, INTERNAL_CATS, type Tally } from "@/lib/evidence";

const eyebrow = "font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground";

function TallyBar({ t }: { t: Tally }) {
  if (!t.total) return null;
  const w = (n: number) => `${(n / t.total) * 100}%`;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <span style={{ width: w(t.passed) }} className="bg-[hsl(var(--jade))]" />
      <span style={{ width: w(t.failed) }} className="bg-destructive" />
      <span style={{ width: w(t.unverified) }} className="hatch bg-[hsl(var(--amber)/0.35)]" />
    </div>
  );
}

function Counts({ t }: { t: Tally }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
      <span className="text-[hsl(var(--jade))]">{t.passed} passed</span>
      <span className={t.failed ? "text-destructive" : "text-muted-foreground"}>{t.failed} to fix</span>
      <span className={t.unverified ? "text-[hsl(var(--amber))]" : "text-muted-foreground"}>{t.unverified} pending</span>
    </div>
  );
}

/** Sidebar summary: checklist-derived readiness, explicitly not a search or Lighthouse result. */
export function ReadinessPanel({ design }: { design: Design }) {
  const lanes = groupByLane(design.checks);
  const local = [...lanes.content, ...lanes.internal, ...lanes.other];
  const t = tally(local);
  return (
    <div id="quality-evidence" className="panel p-4 scroll-mt-6" data-testid="panel-readiness">
      <div className="mb-1 flex items-baseline justify-between"><span className={eyebrow}>Content readiness</span><span className="font-mono text-[10px] text-muted-foreground">local checklist</span></div>
      <div className="flex items-baseline gap-1.5"><span data-testid="text-readiness-overall" className="font-display text-5xl tabular-nums">{Math.round(design.scores.overall)}</span><span className="font-mono text-xs text-muted-foreground">/100 checklist</span></div>
      <div className="mt-3 space-y-1.5"><TallyBar t={t} /><Counts t={t} /></div>
      <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-lg border border-border">
        {(["seo", "aeo", "geo"] as const).map((k) => (
          <div key={k} className="px-2 py-2 text-center" data-testid={`text-readiness-${k}`}>
            <dd className="font-mono text-lg tabular-nums">{Math.round(design.scores[k])}</dd>
            <dt className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">{k} content</dt>
          </div>))}
      </dl>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">Share of local {INTERNAL_CATS.join("/")} and content checks passed on the generated page. Not a search ranking, AI-answer placement or Lighthouse score.</p>
      <div className="mt-3 border-t border-border pt-3 text-[13px]"><div className="flex justify-between"><span className="text-muted-foreground">Layout difference</span><span className="font-mono">{design.comparedCount ? `${Math.round(design.uniqueness)}%` : "New baseline"}</span></div>
        <div className="mt-1 text-xs text-muted-foreground">Compared against {design.comparedCount ?? 0} prior designs{design.closestDesign ? `; closest: ${design.closestDesign}` : ""}.</div></div>
    </div>
  );
}

export function LighthousePanel({ design, onAudit, auditing }: { design: Design; onAudit: () => void; auditing: boolean }) {
  const lh = design.lighthouse;
  const state = lighthouseState(lh);
  const metrics = lighthouseMetrics(lh);
  return (
    <div className="panel p-4" data-testid="panel-lighthouse">
      <div className="mb-3 flex items-center justify-between"><span className={eyebrow}>Lighthouse, measured</span>
        <Btn data-testid="button-audit" variant="ghost" className="h-7 px-2 text-xs" disabled={auditing} onClick={onAudit}>{auditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gauge className="h-3.5 w-3.5" />} Run audit</Btn></div>
      {state === "none" && <p data-testid="text-lighthouse-none" className="rounded-lg border border-dashed border-border p-3 text-[13px] text-muted-foreground">No Lighthouse result yet. Nothing is estimated; run an audit to get measured numbers.</p>}
      {state === "running" && <p data-testid="text-lighthouse-running" className="flex items-center gap-2 rounded-lg bg-muted p-3 text-[13px]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Audit running. Results appear when Lighthouse finishes.</p>}
      {state === "failed" && <p data-testid="text-lighthouse-error" className="rounded-lg border border-destructive/25 bg-destructive/[0.04] p-3 text-xs text-destructive">{lh?.error || "Audit failed."} No scores recorded.</p>}
      {state === "complete" && <ul className="space-y-2">{metrics.map((m) => (
        <li key={m.key} data-testid={`lighthouse-${m.key}`} className="flex items-center gap-3">
          <span className="w-24 text-[12.5px]">{m.label}</span>
          <div className="relative h-1.5 flex-1 rounded-full bg-muted">
            {m.value != null && <span className={cn("absolute inset-y-0 left-0 rounded-full", m.meets ? "bg-[hsl(var(--jade))]" : "bg-destructive")} style={{ width: `${m.value}%` }} />}
            <span className="absolute -inset-y-1 w-px bg-foreground/50" style={{ left: `${m.target}%` }} title={`Target ${m.target}`} />
          </div>
          <span className="w-16 text-right font-mono text-xs tabular-nums">{m.value ?? "n/a"}<span className="text-muted-foreground">/{m.target}</span></span>
        </li>))}</ul>}
      {state === "complete" && <p className="mt-2 text-[11px] text-muted-foreground">Targets: performance 85, SEO 95, accessibility 90.{lh?.testedAt ? ` Tested ${ago(lh.testedAt)}.` : ""}</p>}
      {lh?.url && <a data-testid="link-lighthouse-report" href={lh.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline">Open Lighthouse report<ExternalLink className="h-3 w-3" /></a>}
    </div>
  );
}

function StatusIcon({ s }: { s: Check["status"] }) {
  return s === "passed" ? <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--jade))]" /> : s === "failed" ? <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--amber))]" />;
}

function CheckRow({ c, pendingLabel = "Pending" }: { c: Check; pendingLabel?: string }) {
  return (
    <li data-testid={`check-${c.key}`} className={cn("flex gap-3 px-4 py-2.5", c.status === "failed" && "bg-destructive/[0.035]")}>
      <StatusIcon s={c.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2"><span className="text-[13.5px]">{c.label}</span>
          <span className={cn("shrink-0 font-mono text-[10px] uppercase tracking-wider", c.status === "passed" ? "text-[hsl(var(--jade))]" : c.status === "failed" ? "text-destructive" : "text-[hsl(var(--amber))]")}>{c.status === "passed" ? "Passed" : c.status === "failed" ? "Fix" : pendingLabel}</span></div>
        {c.detail && <div className={cn("text-xs", c.status === "failed" ? "text-foreground/80" : "text-muted-foreground")}>{c.detail}</div>}
      </div>
    </li>
  );
}

function Group({ title, sub, checks, icon, tone, pendingLabel, testId }: { title: string; sub: string; checks: Check[]; icon: ReactNode; tone?: "amber"; pendingLabel?: string; testId: string }) {
  const t = tally(checks);
  return (
    <div data-testid={testId} className={cn("panel overflow-hidden", tone === "amber" && "border-[hsl(var(--amber)/0.4)]")}>
      <div className={cn("space-y-2 border-b border-border px-4 py-3", tone === "amber" && "hatch bg-[hsl(var(--amber)/0.06)]")}>
        <div className="flex items-center gap-2">{icon}<span className="font-medium">{title}</span><span className="ml-auto"><Counts t={t} /></span></div>
        <p className="text-xs text-muted-foreground">{sub}</p>
        <TallyBar t={t} />
      </div>
      {checks.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No checks in this group.</p> :
        <ul className="divide-y divide-border">{sortChecks(checks).map((c) => <CheckRow key={c.key} c={c} pendingLabel={pendingLabel} />)}</ul>}
    </div>
  );
}

export function EvidenceChecks({ checks }: { checks: Check[] }) {
  if (!checks.length) return <p className="text-sm text-muted-foreground">No checks recorded.</p>;
  const lanes = groupByLane(checks);
  const failed = checks.filter((c) => c.status === "failed" && laneOf2(c) !== "external");
  const internalByCat = INTERNAL_CATS.map((cat) => ({ cat, cs: lanes.internal.filter((c) => c.category.toUpperCase() === cat) })).filter((g) => g.cs.length);
  return (
    <div className="space-y-6">
      {failed.length > 0 && <div data-testid="panel-fix-first" className="rounded-xl border border-destructive/25 bg-destructive/[0.03] p-4">
        <div className="mb-2 font-medium text-destructive">Fix before publishing: {failed.length}</div>
        <ol className="list-decimal space-y-1 pl-5 text-[13px]">{failed.map((c) => <li key={c.key}><span className="font-medium">{c.label}</span>{c.detail ? <span className="text-muted-foreground"> — {c.detail}</span> : null}</li>)}</ol>
        <p className="mt-2 text-xs text-muted-foreground">Missing product facts are fixed in the run's Product tab, then regenerate. Pages never invent values.</p>
      </div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Group testId="group-content" title="Campaign content" sub="Is the page complete and factual? Checked locally against your product facts." checks={lanes.content} icon={<FileText className="h-4 w-4" />} />
        <Group testId="group-external" tone="amber" pendingLabel="Not verified" title="External verification" sub="Schema validators and live cart checks. Pending means not run on Shopify yet, not passed." checks={lanes.external} icon={<Hourglass className="h-4 w-4 text-[hsl(var(--amber))]" />} />
      </div>
      {internalByCat.length > 0 && <div>
        <div className={cn(eyebrow, "mb-2")}>Internal content checks · local HTML only, no search engine contacted</div>
        <div className="grid gap-4 md:grid-cols-3">{internalByCat.map(({ cat, cs }) => (
          <Group key={cat} testId={`group-internal-${cat.toLowerCase()}`} title={`${cat} content`} sub={cat === "SEO" ? "Titles, meta and structure in the generated page." : cat === "AEO" ? "Answerable facts and FAQ structure. No numeric target." : "Citable, sourced claims. No numeric target."} checks={cs} icon={<ShieldQuestion className="h-4 w-4 text-muted-foreground" />} />))}</div>
      </div>}
      {lanes.other.length > 0 && <Group testId="group-other" title="Other checks" sub="Additional recorded checks." checks={lanes.other} icon={<CircleDashed className="h-4 w-4" />} />}
    </div>
  );
}

const laneOf2 = (c: Check) => (c.category.trim().toUpperCase() === "EXTERNAL" ? "external" : "local");
