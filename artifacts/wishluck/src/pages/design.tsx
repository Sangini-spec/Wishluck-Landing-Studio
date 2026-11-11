import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Smartphone, Tablet, Monitor, Download, ThumbsUp, ThumbsDown, RefreshCw, Gauge, Send, Loader2, ArrowLeft, Info, ShoppingCart, Check, X, CircleDashed, ExternalLink, AlertTriangle } from "lucide-react";
import { useListRuns, useSubmitFeedback, useRegenerateDesign, useAuditDesign, useGetShopifyStatus, useListThemes, usePublishDesign, getListThemesQueryKey, type Design } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Btn, ErrorState, Sk, StatusPill, Notice, Tag, EmptyState } from "@/components/bits";
import { useToast } from "@/hooks/use-toast";
import { errMsg, invalidateRun, isActive, ago } from "@/lib/run-utils";
import { cn } from "@/lib/utils";

const DEVICES = [
  { key: "mobile", w: 360, icon: Smartphone },
  { key: "tablet", w: 768, icon: Tablet },
  { key: "desktop", w: 1440, icon: Monitor },
] as const;

function Preview({ design }: { design: Design }) {
  const [dev, setDev] = useState<(typeof DEVICES)[number]>(DEVICES[2]);
  const box = useRef<HTMLDivElement>(null);
  const [bw, setBw] = useState(1000);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setBw(e.contentRect.width));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const scale = Math.min(1, (bw - 32) / dev.w);
  const H = 760;
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="inline-flex rounded-lg bg-muted p-0.5">{DEVICES.map((d) => (
          <button key={d.key} data-testid={`button-device-${d.key}`} onClick={() => setDev(d)} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition", dev.key === d.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <d.icon className="h-3.5 w-3.5" /> <span className="font-mono">{d.w}</span>
          </button>))}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{Math.round(scale * 100)}% scale</div>
      </div>
      <div ref={box} className="hatch flex justify-center p-4" style={{ height: H * scale + 32 }}>
        <div className="overflow-hidden rounded-md border border-border bg-card shadow-lg transition-[width] duration-300" style={{ width: dev.w * scale, height: H * scale }}>
          <iframe data-testid="iframe-preview" title="Design preview" src={design.previewUrl} style={{ width: dev.w, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }} className="border-0" />
        </div>
      </div>
      <div className="space-y-2 border-t border-border p-3">
        <Notice tone="muted" icon={<Info className="h-3.5 w-3.5" />}>This preview is server-rendered HTML that approximates the Shopify sections. It is not actual Liquid rendering; exact output depends on your theme.</Notice>
        <Notice tone="amber" icon={<ShoppingCart className="h-3.5 w-3.5" />}>Cart is unavailable in local preview. Add to cart and checkout are only testable on Shopify after publishing to a theme.</Notice>
      </div>
    </div>
  );
}

function ScoreRing({ label, v }: { label: string; v: number }) {
  const r = 22, c = 2 * Math.PI * r, val = Math.max(0, Math.min(100, v));
  return (
    <div className="flex flex-col items-center">
      <svg width="56" height="56" className="-rotate-90"><circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" /><circle cx="28" cy="28" r={r} fill="none" stroke={val >= 80 ? "hsl(var(--jade))" : val >= 50 ? "hsl(var(--amber))" : "hsl(var(--destructive))"} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - val / 100)} style={{ transition: "stroke-dashoffset .8s" }} /></svg>
      <div className="-mt-[38px] mb-[14px] font-mono text-sm tabular-nums">{Math.round(val)}</div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function PublishDialog({ design, open, onOpenChange }: { design: Design; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const shop = useGetShopifyStatus();
  const connected = !!shop.data?.connected;
  const themes = useListThemes({ query: { enabled: open && connected, queryKey: getListThemesQueryKey() } });
  const safe = (themes.data ?? []).filter((t) => t.role !== "main");
  const [themeId, setThemeId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const publish = usePublishDesign({ mutation: {
    onSuccess: (p) => { invalidateRun(qc, design.runId); toast({ title: p.status === "failed" ? "Publish failed" : "Published to theme", description: p.error ?? p.themeName }); },
    onError: (e) => toast({ title: "Publish failed", description: errMsg(e), variant: "destructive" }),
  } });
  const pub = publish.data;
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setConfirm(false); publish.reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Publish to a test theme</DialogTitle><DialogDescription>Designs are only published to unpublished themes. Your live theme is never selectable.</DialogDescription></DialogHeader>
        {shop.isLoading ? <Sk className="h-24" /> : !connected ? (
          <div className="space-y-3"><Notice icon={<AlertTriangle className="h-3.5 w-3.5" />}>{shop.data?.message || "Shopify is not connected."}</Notice>
            {shop.data?.missing?.length ? <div className="flex flex-wrap gap-1.5">{shop.data.missing.map((m) => <code key={m} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{m}</code>)}</div> : null}
            <Link href="/settings" className="text-sm underline">Open readiness settings</Link></div>
        ) : pub ? (
          <div className="space-y-3"><div className="flex items-center gap-2"><StatusPill status={pub.status} /><span className="text-sm">{pub.themeName}</span></div>{pub.error && <ErrorState message={pub.error} />}
            <div className="flex gap-3 text-sm">{pub.previewUrl && <a href={pub.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Theme preview <ExternalLink className="h-3 w-3" /></a>}{pub.editorUrl && <a href={pub.editorUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Open theme editor <ExternalLink className="h-3 w-3" /></a>}</div></div>
        ) : (
          <div className="space-y-4">
            {themes.isLoading ? <Sk className="h-24" /> : themes.error ? <ErrorState message={errMsg(themes.error)} onRetry={() => themes.refetch()} /> : safe.length === 0 ? <Notice>No unpublished themes found. Duplicate your theme in Shopify admin first.</Notice> :
              <div className="max-h-56 space-y-1.5 overflow-y-auto">{safe.map((t) => (
                <button key={t.id} data-testid={`button-theme-${t.id}`} onClick={() => setThemeId(t.id)} className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition", themeId === t.id ? "border-[hsl(var(--seal))] bg-[hsl(var(--seal)/0.05)]" : "border-border hover:bg-muted")}>
                  <span>{t.name}</span><Tag>{t.role}</Tag></button>))}</div>}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--amber)/0.35)] bg-[hsl(var(--amber)/0.05)] p-3 text-[13px]">
              <input data-testid="checkbox-confirm-template" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 accent-[hsl(var(--seal))]" />
              <span>I understand this updates the product’s template suffix <b>and SEO title/description</b>. These changes are global in Shopify. The template assignment <b>can affect how the product renders on the live theme</b> if that theme lacks the template.</span>
            </label>
            <Btn data-testid="button-confirm-publish" variant="seal" className="w-full" disabled={!themeId || !confirm || publish.isPending} onClick={() => publish.mutate({ data: { designId: design.id, themeId, confirmTemplateAssignment: true } })}>
              {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish to selected theme
            </Btn>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function DesignPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const runs = useListRuns({ query: { refetchInterval: pending ? 2000 : false } });
  const found = useMemo(() => { for (const r of runs.data ?? []) { const d = r.designs.find((x) => x.id === id); if (d) return { run: r, design: d }; } return null; }, [runs.data, id]);
  useEffect(() => { setPending(!!found && (isActive(found.run.status) || isActive(found.design.status) || found.design.lighthouse?.status === "running")); }, [found]);
  const [reason, setReason] = useState("");
  const [pubOpen, setPubOpen] = useState(false);
  const done = (t: string) => ({ onSuccess: () => { invalidateRun(qc, found?.run.id); toast({ title: t }); }, onError: (e: unknown) => toast({ title: "Action failed", description: errMsg(e), variant: "destructive" as const }) });
  const feedback = useSubmitFeedback();
  const regen = useRegenerateDesign();
  const audit = useAuditDesign();

  if (runs.error) return <ErrorState message={errMsg(runs.error)} onRetry={() => runs.refetch()} />;
  if (runs.isLoading) return <div className="space-y-4"><Sk className="h-12 w-1/2" /><Sk className="h-[600px]" /></div>;
  if (!found) return <EmptyState icon={<CircleDashed className="h-5 w-5" />} title="Design not found" body="It may have been regenerated under a new id." action={<Link href="/history" className="text-sm underline">Browse history</Link>} />;
  const { run, design: d } = found;
  const groups = d.checks.reduce<Record<string, typeof d.checks>>((a, c) => { (a[c.category] ||= []).push(c); return a; }, {});
  const lh = d.lighthouse;

  return (
    <>
      <Link href={`/runs/${run.id}`} className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> {run.product?.title ?? "Back to run"}</Link>
      <header className="rise mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><div className="mb-2 flex items-center gap-2"><StatusPill status={d.status} /><span className="font-mono text-[11px] text-muted-foreground">v{d.version} · {ago(d.createdAt)}</span></div>
          <h1 className="font-display text-4xl md:text-[44px]">{d.name}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground"><b className="font-medium text-foreground">{d.direction}.</b> {d.description}</p></div>
        <div className="flex flex-wrap gap-2">
          <a href={d.downloadUrl} download data-testid="link-download" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted"><Download className="h-4 w-4" /> ZIP</a>
          <Btn data-testid="button-regenerate" variant="outline" disabled={regen.isPending} onClick={() => regen.mutate({ id: d.id }, { ...done("New design version created"), onSuccess: (next) => { invalidateRun(qc, run.id); navigate(`/designs/${next.id}`); toast({title:"New design version created"}); } })}>{regen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerate</Btn>
          <Btn data-testid="button-publish" variant="seal" onClick={() => setPubOpen(true)}><Send className="h-4 w-4" /> Publish</Btn>
        </div>
      </header>
      {d.warnings.length > 0 && <div className="mb-4 space-y-2">{d.warnings.map((w, i) => <Notice key={i} icon={<AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--amber))]" />}>{w}</Notice>)}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Preview design={d} />
        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Feedback</div>
            <textarea data-testid="input-feedback-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What should change, or why it works" className="w-full rounded-lg border border-input bg-background p-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[hsl(var(--seal)/0.15)]" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn data-testid="button-approve" variant="outline" disabled={feedback.isPending} onClick={() => feedback.mutate({ id: d.id, data: { action: "approve", reason: reason || undefined } }, { ...done("Design approved"), onSettled: () => setReason("") })}><ThumbsUp className="h-4 w-4 text-[hsl(var(--jade))]" /> Approve</Btn>
              <Btn data-testid="button-reject" variant="outline" disabled={feedback.isPending} onClick={() => feedback.mutate({ id: d.id, data: { action: "reject", reason: reason || undefined } }, { ...done("Design rejected"), onSettled: () => setReason("") })}><ThumbsDown className="h-4 w-4 text-destructive" /> Reject</Btn>
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">Feedback is saved to category memory and shapes future runs.</p>
          </div>
          <div className="panel p-4">
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Scores</div>
            <div className="grid grid-cols-4">{(["overall", "seo", "aeo", "geo"] as const).map((k) => <ScoreRing key={k} label={k} v={d.scores[k]} />)}</div>
            <div className="mt-4 border-t border-border pt-3 text-[13px]"><div className="flex justify-between"><span className="text-muted-foreground">Uniqueness</span><span className="font-mono">{Math.round(d.uniqueness)}%</span></div>
              <div className="mt-1 text-xs text-muted-foreground">Compared against {d.comparedCount ?? 0} prior designs{d.closestDesign ? `; closest: ${d.closestDesign}` : ""}.</div></div>
          </div>
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Lighthouse</span>
              <Btn data-testid="button-audit" variant="ghost" className="h-7 px-2 text-xs" disabled={audit.isPending} onClick={() => audit.mutate({ id: d.id }, done("Audit finished"))}>{audit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gauge className="h-3.5 w-3.5" />} Run audit</Btn></div>
            {!lh ? <p className="text-[13px] text-muted-foreground">Not audited yet.</p> : <>
              <div className="mb-2"><StatusPill status={lh.status} /></div>
              {lh.error ? <p className="text-xs text-destructive">{lh.error}</p> : <div className="grid grid-cols-3 gap-2 text-center">{([["Perf", lh.performance], ["SEO", lh.seo], ["A11y", lh.accessibility]] as const).map(([k, v]) => <div key={k} className="rounded-lg bg-muted py-2"><div className="font-display text-2xl">{v ?? "—"}</div><div className="font-mono text-[10px] uppercase text-muted-foreground">{k}</div></div>)}</div>}
              {lh.testedAt && <p className="mt-2 text-[11px] text-muted-foreground">Tested {ago(lh.testedAt)}</p>}</>}
          </div>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-2xl">Checks</h2>
        {d.checks.length === 0 ? <p className="text-sm text-muted-foreground">No checks recorded.</p> :
          <div className="grid gap-4 md:grid-cols-2">{Object.entries(groups).map(([cat, cs]) => (
            <div key={cat} className="panel"><div className="border-b border-border px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{cat}</div>
              <ul className="divide-y divide-border">{cs.map((c) => (
                <li key={c.key} data-testid={`check-${c.key}`} className="flex gap-3 px-4 py-2.5">
                  {c.status === "passed" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--jade))]" /> : c.status === "failed" ? <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--amber))]" />}
                  <div><div className="text-[13.5px]">{c.label}</div>{c.detail && <div className="text-xs text-muted-foreground">{c.detail}</div>}</div>
                </li>))}</ul></div>))}</div>}
      </section>
      <PublishDialog design={d} open={pubOpen} onOpenChange={setPubOpen} />
    </>
  );
}
