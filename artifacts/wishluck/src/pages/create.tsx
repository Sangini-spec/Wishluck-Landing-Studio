import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Link2, ScanSearch, Palette, Search, Sparkles, Loader2 } from "lucide-react";
import { useCreateRun, useGetSettings } from "@workspace/api-client-react";
import { PageHeader, Btn, ErrorState, Notice } from "@/components/bits";
import { errMsg, invalidateRun } from "@/lib/run-utils";

const STEPS = [
  { icon: ScanSearch, t: "Read the product", d: "Title, variants, price, specs, reviews, and the facts that are missing." },
  { icon: Palette, t: "Extract the brand", d: "Colors, fonts, radius, spacing, tone. You correct anything before generating." },
  { icon: Search, t: "Research competitors", d: "Optional. Every learning cites the pages it came from." },
  { icon: Sparkles, t: "Generate editable pages", d: "Shopify sections with checks for SEO, AEO and GEO." },
];

export default function Create() {
  const [url, setUrl] = useState("");
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const create = useCreateRun();
  const { data: s } = useGetSettings();
  const valid = /^https?:\/\/\S+\.\S+/.test(url.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate({ data: { url: url.trim() } }, {
      onSuccess: (run) => { invalidateRun(qc, run.id); nav(`/runs/${run.id}`); },
    });
  };

  return (
    <>
      <PageHeader eyebrow="New analysis" title="Start from a real product page." sub="Wishluck reads the live page, not a description of it. Analysis stops for your corrections before anything is designed." />
      <form onSubmit={submit} className="panel rise p-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 items-center gap-3 rounded-lg px-3">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <input data-testid="input-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourstore.com/products/your-product"
              className="h-12 w-full bg-transparent font-mono text-[14px] outline-none placeholder:text-muted-foreground/60" />
          </label>
          <Btn data-testid="button-analyse" type="submit" variant="seal" disabled={!valid || create.isPending} className="h-12 px-5">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Analyse
          </Btn>
        </div>
      </form>
      {url && !valid && <p className="mt-2 text-xs text-muted-foreground">Enter a full URL including https://</p>}
      {create.error && <div className="mt-4"><ErrorState message={errMsg(create.error)} /></div>}
      {s && !s.ai.configured && <div className="mt-4"><Notice>AI provider is not configured. Analysis will run with extraction only and disclose any step that needed AI.</Notice></div>}

      <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((st, i) => (
          <li key={st.t} className="rise bg-card p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between">
              <st.icon className="h-4 w-4 text-[hsl(var(--seal))]" strokeWidth={1.75} />
              <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
            </div>
            <div className="mt-6 text-[14px] font-medium">{st.t}</div>
            <p className="mt-1 text-[13px] text-muted-foreground">{st.d}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
