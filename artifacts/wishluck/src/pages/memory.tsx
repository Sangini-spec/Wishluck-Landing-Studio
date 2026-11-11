import { Link } from "wouter";
import { BookMarked, Quote } from "lucide-react";
import { useGetMemory,deleteCategoryMemory } from "@workspace/api-client-react";
import {DeleteMenu} from "@/components/delete-menu";
import { PageHeader, EmptyState, ErrorState, Sk, Tag } from "@/components/bits";
import { errMsg, host } from "@/lib/run-utils";
import { DetailDisclosure } from "@/components/detail-disclosure";

export default function Memory() {
  const { data, isLoading, error, refetch } = useGetMemory();
  return (
    <>
      <PageHeader eyebrow="Category intelligence" title="What the studio has learned." sub="Sourced learnings and design fingerprints, grouped by category. New designs are checked against these to stay distinct." />
      {error ? <ErrorState message={errMsg(error)} onRetry={() => refetch()} />
        : isLoading ? <div className="space-y-4"><Sk className="h-48" /><Sk className="h-48" /></div>
        : !data?.length ? <EmptyState icon={<BookMarked className="h-5 w-5" />} title="Memory is empty" body="Categories are saved once a run completes research or generation. Nothing here is pre-seeded." />
        : <div className="space-y-6">{data.map((c, i) => (
          <section key={c.category} data-testid={`card-category-${c.category}`} className="panel rise overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-5">
              <h2 className="font-display text-3xl">{c.category || "Uncategorised"}</h2>
              <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <span><b className="text-foreground tabular-nums">{c.runCount}</b> runs</span>
                <span><b className="text-foreground tabular-nums">{c.designCount}</b> designs</span>
                <span><b className="text-[hsl(var(--jade))] tabular-nums">{c.approvedCount}</b> approved</span>
                <span><b className="text-destructive tabular-nums">{c.rejectedCount}</b> rejected</span>
                <DeleteMenu label={`${c.category} category memory`} title={`Delete ${c.category} memory?`} description="Permanently clear this category’s learnings and feedback, and stop using its existing design fingerprints for future generation. Your runs, saved designs and Shopify store are kept. New research or generation can build fresh memory." onDelete={()=>deleteCategoryMemory(c.category)}/>
              </div>
            </div>
            <DetailDisclosure className="m-4" label={`View category details · ${c.learnings.length} learnings · ${c.fingerprints.length} design fingerprints`}>
            <div className="grid md:grid-cols-[1.4fr_1fr]">
              <div className="p-5 md:border-r md:border-border">
                <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Learnings</div>
                {c.learnings.length ? <ul className="space-y-3">{c.learnings.map((l) => (
                  <li key={l.id} className="flex gap-3"><Quote className="mt-1 h-3.5 w-3.5 shrink-0 text-[hsl(var(--seal))]" />
                    <div><p className="text-[13.5px]">{l.text}</p><div className="mt-1 flex flex-wrap gap-1.5"><Tag>{l.category}</Tag>{l.sources.map((s) => <a key={s} href={s} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-muted-foreground underline-offset-2 hover:underline">{host(s)}</a>)}</div></div>
                  </li>))}</ul> : <p className="text-sm text-muted-foreground">No sourced learnings yet. Run competitor research to collect them.</p>}
              </div>
              <div className="p-5">
                <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Design fingerprints</div>
                {c.fingerprints.length ? <ul className="space-y-1">{c.fingerprints.map((d) => (
                  <li key={d.id}><Link href={`/designs/${d.id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"><span className="truncate">{d.name}</span><span className="font-mono text-xs text-muted-foreground">{Math.round(d.uniqueness)}% unique</span></Link></li>
                ))}</ul> : <p className="text-sm text-muted-foreground">No designs yet.</p>}
              </div>
            </div>
            </DetailDisclosure>
          </section>))}</div>}
    </>
  );
}
