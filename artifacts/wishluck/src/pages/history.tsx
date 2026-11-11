import { useMemo, useState } from "react";
import { Link } from "wouter";
import { History as HIcon, Send, ExternalLink } from "lucide-react";
import { useListRuns, useGetDashboard } from "@workspace/api-client-react";
import { PageHeader, EmptyState, ErrorState, Sk, StatusPill } from "@/components/bits";
import { RunRow } from "@/components/run-row";
import { ago, errMsg } from "@/lib/run-utils";
import { cn } from "@/lib/utils";

export default function HistoryPage() {
  const runs = useListRuns();
  const dash = useGetDashboard();
  const [tab, setTab] = useState<"runs" | "pubs">("runs");
  const [q, setQ] = useState("");
  const filtered = useMemo(() => (runs.data ?? []).filter((r) => !q || (r.url + (r.product?.title ?? "") + (r.product?.category ?? "")).toLowerCase().includes(q.toLowerCase())), [runs.data, q]);
  const pubs = dash.data?.publications ?? [];
  const designName = (id: string) => (runs.data ?? []).flatMap((r) => r.designs).find((d) => d.id === id)?.name;

  return (
    <>
      <PageHeader eyebrow="Archive" title="History" sub="Every analysis run and every publication attempt, including the ones that failed." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {(["runs", "pubs"] as const).map((t) => (
            <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 text-[13px] transition-colors", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t === "runs" ? `Runs${runs.data ? ` · ${runs.data.length}` : ""}` : `Publications${dash.data ? ` · ${pubs.length}` : ""}`}
            </button>
          ))}
        </div>
        {tab === "runs" && <input data-testid="input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by URL, title, category" className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 sm:w-72" />}
      </div>
      {tab === "runs" ? (
        runs.error ? <ErrorState message={errMsg(runs.error)} onRetry={() => runs.refetch()} />
          : runs.isLoading ? <Sk className="h-60" />
          : filtered.length ? <div className="panel overflow-hidden">{filtered.map((r) => <RunRow key={r.id} run={r} />)}</div>
          : <EmptyState icon={<HIcon className="h-5 w-5" />} title={q ? "No matches" : "No runs yet"} body={q ? "Try a different filter." : "Runs appear here as soon as you start an analysis."} />
      ) : (
        dash.error ? <ErrorState message={errMsg(dash.error)} onRetry={() => dash.refetch()} />
          : dash.isLoading ? <Sk className="h-60" />
          : pubs.length ? (
            <div className="panel overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 font-normal">Publication</th><th className="px-4 font-normal">Theme</th><th className="px-4 font-normal">Status</th><th className="px-4 font-normal">When</th><th className="px-4 font-normal">Links</th></tr></thead>
                <tbody>{pubs.map((p) => (
                  <tr key={p.id} data-testid={`row-publication-${p.id}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><div className="font-medium">{p.title}</div><Link href={`/designs/${p.designId}`} className="text-xs text-muted-foreground hover:underline">{designName(p.designId) ?? "Open design"}</Link>{p.error && <div className="mt-1 text-xs text-destructive">{p.error}</div>}</td>
                    <td className="px-4 text-muted-foreground">{p.themeName ?? "—"}</td>
                    <td className="px-4"><StatusPill status={p.status} /></td>
                    <td className="px-4 text-muted-foreground">{ago(p.createdAt)}</td>
                    <td className="px-4"><div className="flex gap-3 text-xs">{p.previewUrl && <a href={p.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Preview <ExternalLink className="h-3 w-3" /></a>}{p.editorUrl && <a href={p.editorUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Editor <ExternalLink className="h-3 w-3" /></a>}</div></td>
                  </tr>))}</tbody>
              </table>
            </div>
          ) : <EmptyState icon={<Send className="h-5 w-5" />} title="No publications" body="Publishing requires a connected Shopify store and an unpublished theme." />
      )}
    </>
  );
}
