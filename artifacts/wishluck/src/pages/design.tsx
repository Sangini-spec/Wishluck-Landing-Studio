import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Smartphone, Tablet, Monitor, Download, ThumbsUp, ThumbsDown, RefreshCw, Send, Loader2, ArrowLeft, Info, ShoppingCart, CircleDashed, ExternalLink, AlertTriangle } from "lucide-react";
import { useListRuns, useSubmitFeedback, useRegenerateDesign, useAuditDesign, useGetShopifyStatus, useListThemes, usePublishDesign, useConnectShopify, useGetPublishingContext, getGetPublishingContextQueryKey, getListThemesQueryKey, getGetShopifyStatusQueryKey, type Design } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Btn, ErrorState, Sk, StatusPill, Notice, Tag, EmptyState } from "@/components/bits";
import { useToast } from "@/hooks/use-toast";
import { errMsg, invalidateRun, isActive, ago } from "@/lib/run-utils";
import { cn } from "@/lib/utils";
import { ReadinessPanel, LighthousePanel, EvidenceChecks } from "@/components/evidence-panels";
import {CliPublishing} from "@/components/cli-publishing";

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

function PublishDialog({ design, open, onOpenChange }: { design: Design; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const shop = useGetShopifyStatus();
  const destination=useGetPublishingContext(design.id,{query:{enabled:open,queryKey:getGetPublishingContextQueryKey(design.id),staleTime:0}});
  const connect = useConnectShopify({mutation:{
    onSuccess:async()=>{await qc.invalidateQueries({queryKey:getGetShopifyStatusQueryKey()});await destination.refetch();},
    onError:(e)=>toast({title:"Could not connect Shopify",description:errMsg(e),variant:"destructive"}),
  }});
  const connected = !!destination.data;
  const themes = useListThemes({ query: { enabled: open && connected, queryKey: getListThemesQueryKey() } });
  const safe = (themes.data ?? []).filter((t) => ["unpublished","development"].includes(t.role));
  const [themeId, setThemeId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [mode,setMode]=useState<"source"|"existing"|"import">("source");
  const [productId,setProductId]=useState("");
  const [confirmImport,setConfirmImport]=useState(false);
  const [confirmCurrency,setConfirmCurrency]=useState(false);
  useEffect(()=>{if(open&&destination.data){setMode(destination.data.sameStore?"source":"import");setProductId("");setConfirmImport(false);setConfirmCurrency(false);}},[open,destination.data?.shop,destination.data?.sameStore]);
  const mismatch=!!destination.data&&destination.data.sourceCurrency!==destination.data.currency;
  const publish = usePublishDesign({ mutation: {
    onSuccess: (p) => { invalidateRun(qc, design.runId); toast({ title: p.status === "failed" ? "Publish failed" : "Saved to selected theme", description: p.error ?? p.themeName }); },
    onError: (e) => toast({ title: "Publish failed", description: errMsg(e), variant: "destructive" }),
  } });
  const pub = publish.data;
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setConfirm(false); publish.reset(); } }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl font-normal">Publish to a test theme</DialogTitle><DialogDescription>Designs are only published to unpublished themes. Your live theme is never selectable.</DialogDescription></DialogHeader>
        {destination.isLoading ? <Sk className="h-24" /> : !connected ? (
          <div className="space-y-3"><Notice icon={<AlertTriangle className="h-3.5 w-3.5" />}>{destination.error?errMsg(destination.error):shop.data?.message || "Shopify is not connected."}</Notice>
            {shop.data?.missing?.length ? <div className="flex flex-wrap gap-1.5">{shop.data.missing.map((m) => <code key={m} className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{m}</code>)}</div> : null}
            <Btn variant="outline" disabled={connect.isPending} onClick={()=>connect.mutate()}>{connect.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:null} Connect Shopify</Btn></div>
        ) : pub ? (
          <div className="space-y-3"><div className="flex items-center gap-2"><StatusPill status={pub.status} /><span className="text-sm">{pub.themeName}</span></div>{pub.error && <ErrorState message={pub.error} />}
            <p className="text-sm text-muted-foreground">Store: {pub.shop||destination.data?.shop}{pub.productStatus?` · Product ${pub.productStatus.toLowerCase()}`:""}</p>
            {pub.warnings?.map((w,i)=><Notice key={i}>{w}</Notice>)}
            {pub.helpUrl&&<div className="flex flex-wrap gap-3 text-sm"><a href={pub.helpUrl} target="_blank" rel="noreferrer" className="underline">Request Shopify theme-file access</a><a href={design.downloadUrl} className="underline">Download theme ZIP</a></div>}
            <div className="flex flex-wrap gap-3 text-sm">{pub.previewUrl && <a href={pub.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Theme preview <ExternalLink className="h-3 w-3" /></a>}{pub.editorUrl && <a href={pub.editorUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Open theme editor <ExternalLink className="h-3 w-3" /></a>}{pub.adminUrl&&<a href={pub.adminUrl} target="_blank" rel="noreferrer" className="underline">Open product in Shopify</a>}</div></div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm"><span className="font-medium">{destination.data?.name}</span><div className="mt-1 break-all text-xs text-muted-foreground">{destination.data?.shop}</div></div>
            {!destination.data?.sameStore&&<Notice>This design was analysed from {destination.data?.sourceHost}. Its original variant IDs do not belong to your store. Choose how to bring the design into your store.</Notice>}
            <div className="space-y-2">
              <label htmlFor="publish-product-mode" className="text-sm font-medium">Product destination</label>
              <select id="publish-product-mode" data-testid="select-product-mode" value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setConfirm(false);}} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                {destination.data?.sameStore&&<option value="source">Use the analysed store product</option>}
                <option value="import" disabled={!destination.data?.canImport}>Import a draft copy into my store</option>
                <option value="existing">Apply layout to an existing store product</option>
              </select>
              {mode==="existing"&&<><label htmlFor="publish-product" className="sr-only">Store product</label><select id="publish-product" data-testid="select-target-product" value={productId} onChange={e=>setProductId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">Choose a store product</option>{destination.data?.products.map(p=><option key={p.id} value={p.id}>{p.title} · {p.status.toLowerCase()}</option>)}</select><p className="text-xs text-muted-foreground">The layout is retained; unrelated source copy, imagery and claims are replaced with the selected product’s actual facts.</p></>}
              {mode==="import"&&<><p className="text-xs leading-relaxed text-muted-foreground">Creates a draft with new Shopify product/variant IDs and copies the source images. It is not published for sale. Source-store policies, ratings and inventory are not copied.</p><label className="flex gap-2 text-sm"><input data-testid="checkbox-confirm-import" type="checkbox" checked={confirmImport} onChange={e=>setConfirmImport(e.target.checked)}/><span>I have the rights to import this product and its images as a draft.</span></label>{mismatch&&<label className="flex gap-2 rounded-lg border border-border p-3 text-xs"><input data-testid="checkbox-confirm-currency" type="checkbox" checked={confirmCurrency} onChange={e=>setConfirmCurrency(e.target.checked)}/><span>Source prices are {destination.data?.sourceCurrency}; my store uses {destination.data?.currency}. Keep the same numeric amounts in {destination.data?.currency}. I will review prices before activation. No currency conversion is performed.</span></label>}</>}
            </div>
            {themes.isLoading ? <Sk className="h-24" /> : themes.error ? <ErrorState message={errMsg(themes.error)} onRetry={() => themes.refetch()} /> : safe.length === 0 ? <Notice>No unpublished themes found. Duplicate your theme in Shopify admin first.</Notice> :
              <div className="max-h-56 space-y-1.5 overflow-y-auto">{safe.map((t) => (
                <button key={t.id} data-testid={`button-theme-${t.id}`} onClick={() => setThemeId(t.id)} className={cn("flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition", themeId === t.id ? "border-[hsl(var(--seal))] bg-[hsl(var(--seal)/0.05)]" : "border-border hover:bg-muted")}>
                  <span>{t.name}</span><Tag>{t.role}</Tag></button>))}</div>}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[hsl(var(--amber)/0.35)] bg-[hsl(var(--amber)/0.05)] p-3 text-[13px]">
              <input data-testid="checkbox-confirm-template" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 accent-[hsl(var(--seal))]" />
              <span>{mode==="import"?"I confirm creating/updating the draft’s template and SEO fields, and uploading files to this non-live theme. The product will remain a draft.":"I understand this updates the selected product’s template suffix and SEO title/description globally. It can affect the live theme if that theme lacks the template."}</span>
            </label>
            <Btn data-testid="button-confirm-publish" variant="seal" className="w-full" disabled={!themeId || !confirm || publish.isPending||(mode==="existing"&&!productId)||(mode==="import"&&(!confirmImport||(mismatch&&!confirmCurrency)))} onClick={() => publish.mutate({ data: { designId: design.id, themeId, expectedShop:destination.data?.shop,confirmTemplateAssignment: true,productMode:mode,productId:mode==="existing"?productId:undefined,confirmProductImport:confirmImport,confirmCurrencyMismatch:confirmCurrency } })}>
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

  return (
    <>
      <Link href={`/runs/${run.id}`} className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> {run.product?.title ?? "Back to run"}</Link>
      <header className="rise mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><div className="mb-2 flex items-center gap-2"><StatusPill status={d.status} /><span className="font-mono text-[11px] text-muted-foreground">v{d.version} · {ago(d.createdAt)}</span></div>
          <h1 className="font-display text-4xl md:text-[44px]">{d.name}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground"><b className="font-medium text-foreground">{d.direction}.</b> {d.description}</p></div>
        <div className="flex flex-wrap gap-2">
          <a href={d.downloadUrl} download data-testid="link-download" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium hover:bg-muted"><Download className="h-4 w-4" /> Theme ZIP</a>
          <Btn data-testid="button-regenerate" variant="outline" disabled={regen.isPending} onClick={() => regen.mutate({ id: d.id }, { ...done("New design version created"), onSuccess: (next) => { invalidateRun(qc, run.id); navigate(`/designs/${next.id}`); toast({title:"New design version created"}); } })}>{regen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerate</Btn>
          <Btn data-testid="button-publish" variant={["uploaded","edited","published"].includes(d.status)?"outline":"seal"} disabled={["rejected","uploaded","edited","published"].includes(d.status)} title={["uploaded","edited","published"].includes(d.status)?"This version is already uploaded. Open its editor below or regenerate a new version.":d.status==="rejected"?"Approve this rejected design before publishing":"Upload automatically and open Shopify’s editor"} onClick={() => setPubOpen(true)}><Send className="h-4 w-4" /> {d.status==="published"?"Published":["uploaded","edited"].includes(d.status)?"Already uploaded":"Publish to Shopify"}</Btn>
        </div>
      </header>
      <CliPublishing design={d} open={pubOpen} onOpenChange={setPubOpen}/>
      {d.warnings.length > 0 && <div className="mb-4 space-y-2">{d.warnings.map((w, i) => <Notice key={i} icon={<AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--amber))]" />}>{w}</Notice>)}</div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Preview design={d} />
        <aside className="space-y-4">
          {!!d.researchInfluences?.length&&<section className="panel space-y-3 p-4" data-testid="research-applied">
            <h2 className="font-display text-xl">Research applied</h2>
            {d.researchInfluences.map((influence,i)=><div key={i} className="border-t border-border pt-3 text-sm"><p className="font-medium">{influence.observation}</p><p className="mt-1 text-muted-foreground">{influence.application}</p><a href={influence.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline">View reference</a></div>)}
          </section>}
          <div className="panel p-4">
            <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Feedback</div>
            <textarea data-testid="input-feedback-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What should change, or why it works" className="w-full rounded-lg border border-input bg-background p-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[hsl(var(--seal)/0.15)]" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn data-testid="button-approve" variant="outline" disabled={feedback.isPending} onClick={() => feedback.mutate({ id: d.id, data: { action: "approve", reason: reason || undefined } }, { ...done("Design approved"), onSettled: () => setReason("") })}><ThumbsUp className="h-4 w-4 text-[hsl(var(--jade))]" /> Approve</Btn>
              <Btn data-testid="button-reject" variant="outline" disabled={feedback.isPending} onClick={() => feedback.mutate({ id: d.id, data: { action: "reject", reason: reason || undefined } }, { ...done("Design rejected"), onSettled: () => setReason("") })}><ThumbsDown className="h-4 w-4 text-destructive" /> Reject</Btn>
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">Feedback is saved to category memory and shapes future runs.</p>
          </div>
          <ReadinessPanel design={d} />
          <LighthousePanel design={d} auditing={audit.isPending} onAudit={() => audit.mutate({ id: d.id }, done("Audit finished"))} />
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="mb-1 font-display text-2xl">Evidence</h2><p className="mb-4 text-sm text-muted-foreground">Content readiness, measured Lighthouse results and external verification are tracked separately.</p>
        <EvidenceChecks checks={d.checks} />
      </section>
    </>
  );
}
