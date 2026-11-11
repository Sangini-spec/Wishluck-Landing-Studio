import { useMemo, useState } from "react";
import { Link } from "wouter";
import { History as HIcon, Send, ExternalLink } from "lucide-react";
import { useListRuns, useGetDashboard,deletePublication,clearPublications,clearRuns,useCheckCliPublication } from "@workspace/api-client-react";
import {useQueryClient} from "@tanstack/react-query";
import {useToast} from "@/hooks/use-toast";
import {DeleteMenu} from "@/components/delete-menu";
import { PageHeader, EmptyState, ErrorState, Sk, StatusPill,Btn } from "@/components/bits";
import { RunRow } from "@/components/run-row";
import { ago, errMsg } from "@/lib/run-utils";
import { cn } from "@/lib/utils";
import { publicationDisplayStatus } from "@/lib/publications";

export default function HistoryPage() {
  const runs = useListRuns();
  const qc=useQueryClient(),{toast}=useToast();
  const dash = useGetDashboard({query:{refetchOnWindowFocus:true,refetchInterval:30000,staleTime:0}});
  const check=useCheckCliPublication({mutation:{onSuccess:()=>{void qc.invalidateQueries();},onError:e=>toast({title:"Shopify status could not be checked",description:errMsg(e),variant:"destructive"})}});
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
        <DeleteMenu label={tab==="runs"?"run history":"publication history"} title={tab==="runs"?"Delete all run history?":"Clear publication history?"}
          description={tab==="runs"?"Permanently delete ALL runs, generated designs, learnings, feedback and publication records in this workspace, including runs hidden by filters. This cannot be undone. Shopify products and themes are not changed.":"Permanently delete all local publication history. Runs, saved designs, category memory and actual Shopify products and themes are kept. This cannot be undone."}
          onDelete={()=>tab==="runs"?clearRuns():clearPublications()} disabled={tab==="runs"?!runs.data?.length:!pubs.length}/>
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
              <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">Uploaded means saved to Shopify, not live. Deleted themes stay in history but are excluded from dashboard totals. Shopify publication and saved edits are timestamped when detected.</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3 font-normal">Design</th><th className="px-4 font-normal">Store</th><th className="px-4 font-normal">Status</th><th className="px-4 font-normal">Timeline</th><th className="px-4 font-normal">Links</th></tr></thead>
                <tbody>{pubs.map((p) => (
                  <tr key={p.id} data-testid={`row-publication-${p.id}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><div className="font-medium">{p.title}</div><Link href={`/designs/${p.designId}`} className="text-xs text-muted-foreground hover:underline">{designName(p.designId) ?? "Open design"}</Link>{p.error && <div className="mt-1 text-xs text-destructive">{p.error}</div>}</td>
                    <td className="px-4 text-muted-foreground">{p.shop ?? "—"}</td>
                    <td className="px-4"><div className="flex items-center gap-2"><StatusPill status={publicationDisplayStatus(p)}/><DeleteMenu label={`${p.title} publication`} title="Delete this publication record?" description="Remove this local publication history entry. The design, category memory, and actual Shopify product and theme remain unchanged." onDelete={()=>deletePublication(p.id)} disabled={p.status==="uploading"}/></div></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground"><ul className="space-y-1">{(p.timeline?.length?p.timeline:[{status:p.status==="published"?"uploaded":p.status,at:p.uploadedAt??p.createdAt}]).map((event,i)=><li key={i}><span className="capitalize">{event.status}{event.status==="edited"?" detected":""}</span> · <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></li>)}</ul>{p.checkedAt&&<p className="mt-2">Checked {new Date(p.checkedAt).toLocaleString()}</p>}</td>
                    <td className="px-4"><div className="flex flex-wrap gap-3 text-xs">{publicationDisplayStatus(p)==="deleted"?<span className="text-muted-foreground">No longer on Shopify</span>:<>{p.previewUrl && <a href={p.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Preview <ExternalLink className="h-3 w-3" /></a>}{p.editorUrl && <a href={p.editorUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Editor <ExternalLink className="h-3 w-3" /></a>}{p.verified&&p.shop&&<Btn variant="outline" disabled={check.isPending} onClick={()=>check.mutate({id:p.id,data:{expectedShop:p.shop!,runAudit:false}})}>Check status</Btn>}</>}</div></td>
                  </tr>))}</tbody>
              </table>
            </div>
          ) : <EmptyState icon={<Send className="h-5 w-5" />} title="No publications" body="Publishing requires a connected Shopify store and an unpublished theme." />
      )}
    </>
  );
}
