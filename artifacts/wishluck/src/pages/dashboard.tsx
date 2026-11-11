import { Link } from "wouter";
import { ArrowRight, Plus, Layers, Send } from "lucide-react";
import { useGetDashboard } from "@workspace/api-client-react";
import { PageHeader, Stat, EmptyState, ErrorState, Sk, StatusPill, Btn } from "@/components/bits";
import { RunRow } from "@/components/run-row";
import { ago, errMsg } from "@/lib/run-utils";

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useGetDashboard();
  return (
    <>
      <PageHeader eyebrow="Studio overview" title={<>Pages built on <em className="text-[hsl(var(--seal))]">evidence</em>, not templates.</>}
        sub="Every run starts from a real product URL, extracts the brand you already have, and only claims what it can source."
        actions={<Link href="/create" data-testid="link-new-analysis" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> New analysis</Link>} />
      {error ? <ErrorState message={errMsg(error)} onRetry={() => refetch()} /> : (
        <>
          <div className="panel rise grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0">
            {isLoading || !data ? [0, 1, 2, 3].map((i) => <div key={i} className="p-5"><Sk className="h-3 w-16" /><Sk className="mt-3 h-8 w-12" /></div>) : <>
              <Stat label="Runs" value={data.totalRuns} />
              <Stat label="Designs" value={data.totalDesigns} />
              <Stat label="Published" value={data.publishedCount} hint="to non-live themes" />
              <Stat label="Categories" value={data.categories} hint="in memory" />
            </>}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-2xl">Recent work</h2>
                <Link href="/history" className="text-xs text-muted-foreground hover:text-foreground">All history <ArrowRight className="inline h-3 w-3" /></Link>
              </div>
              {isLoading ? <div className="panel p-4 space-y-3">{[0, 1, 2].map((i) => <Sk key={i} className="h-11" />)}</div>
                : data && data.recentRuns.length > 0 ? <div className="panel overflow-hidden">{data.recentRuns.map((r) => <RunRow key={r.id} run={r} />)}</div>
                : <EmptyState icon={<Layers className="h-5 w-5" />} title="No runs yet"
                    body="Paste a Shopify product URL and Wishluck will read the product, your brand system, and what's missing before designing anything."
                    action={<Link href="/create"><Btn variant="seal"><Plus className="h-4 w-4" /> Analyse a product</Btn></Link>} />}
            </section>
            <section>
              <h2 className="mb-3 font-display text-2xl">Publications</h2>
              {isLoading ? <Sk className="h-40" /> : data && data.publications.length > 0 ? (
                <div className="panel divide-y divide-border">
                  {data.publications.slice(0, 6).map((p) => (
                    <div key={p.id} data-testid={`row-publication-${p.id}`} className="p-4">
                      <div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-medium">{p.title}</div><StatusPill status={p.status} /></div>
                      <div className="mt-1 text-xs text-muted-foreground">{p.themeName ? `Theme: ${p.themeName} · ` : ""}{ago(p.createdAt)}</div>
                      {p.error && <div className="mt-1 text-xs text-destructive">{p.error}</div>}
                    </div>
                  ))}
                </div>
              ) : <EmptyState icon={<Send className="h-5 w-5" />} title="Nothing published" body="Approved designs can be pushed to an unpublished Shopify theme for safe review. Live themes are never touched." />}
            </section>
          </div>
        </>
      )}
    </>
  );
}
