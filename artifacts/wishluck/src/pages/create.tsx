import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Link2, ScanSearch, Palette, Search, Sparkles, Loader2 } from "lucide-react";
import { useCreateRun, useGetSettings, useDiscoverStoreProducts } from "@workspace/api-client-react";
import { PageHeader, Btn, ErrorState, Notice } from "@/components/bits";
import { errMsg, invalidateRun } from "@/lib/run-utils";

const STEPS = [
  { icon: ScanSearch, t: "Read the product", d: "Title, variants, price, specs, reviews, and the facts that are missing." },
  { icon: Palette, t: "Extract the brand", d: "Colors, fonts, radius, spacing, tone. You correct anything before generating." },
  { icon: Search, t: "Research competitors", d: "Runs before design generation. Every learning cites its source pages." },
  { icon: Sparkles, t: "Generate editable pages", d: "Shopify sections with checks for SEO, AEO and GEO." },
];

export default function Create() {
  const [url, setUrl] = useState("");
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const create = useCreateRun();
  const discover = useDiscoverStoreProducts();
  const [selectedProduct,setSelectedProduct]=useState("");
  const { data: s } = useGetSettings();
  const valid = /^https:\/\/\S+\.\S+/.test(url.trim());
  const busy=create.isPending||discover.isPending;
  const isProductUrl=(()=>{try{return /\/products\/[^/]+\/?$/.test(new URL(url.trim()).pathname);}catch{return false;}})();
  const analyse=(productUrl:string)=>{
    create.mutate({data:{url:productUrl}},{
      onSuccess:run=>{invalidateRun(qc,run.id);nav(`/runs/${run.id}`);},
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if(isProductUrl)analyse(url.trim());
    else{setSelectedProduct("");create.reset();discover.mutate({data:{url:url.trim()}});}
  };

  return (
    <>
      <PageHeader eyebrow="New analysis" title="Start with your store or product." sub="Paste a store, collection or product link. Choose a product when needed; review the extracted details before anything is designed." />
      <form onSubmit={submit} className="panel rise p-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 items-center gap-3 rounded-lg px-3">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <input data-testid="input-url" aria-label="Store, collection or product URL" autoFocus value={url} disabled={busy} onChange={(e) => {setUrl(e.target.value);setSelectedProduct("");discover.reset();create.reset();}} placeholder="https://yourstore.com"
              className="h-12 w-full bg-transparent font-mono text-[14px] outline-none placeholder:text-muted-foreground/60" />
          </label>
          <Btn data-testid="button-analyse" type="submit" variant="seal" disabled={!valid || busy} className="h-12 px-5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {isProductUrl?"Analyse":"Find products"}
          </Btn>
        </div>
      </form>
      {url && !valid && <p className="mt-2 text-xs text-muted-foreground">Enter a full HTTPS store, collection or product URL.</p>}
      {discover.error&&<div className="mt-4"><ErrorState message={errMsg(discover.error)}/></div>}
      {discover.data&&<section className="panel mt-4 space-y-4 p-5" data-testid="discovered-products">
        <div><h2 className="font-display text-xl">Choose a product</h2><p className="mt-1 text-sm text-muted-foreground">{discover.data.message}</p></div>
        <label className="block text-sm" htmlFor="discovered-product">Product</label>
        <select id="discovered-product" data-testid="select-discovered-product" value={selectedProduct} disabled={busy} onChange={e=>setSelectedProduct(e.target.value)} className="w-full rounded-lg border border-border bg-background p-3 text-sm">
          <option value="">Select a product to analyse</option>
          {discover.data.products.map(p=><option key={p.url} value={p.url}>{p.title}</option>)}
        </select>
        {selectedProduct&&<a href={selectedProduct} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-muted-foreground underline">View selected product</a>}
        <Btn data-testid="button-analyse-selected-product" variant="seal" disabled={!selectedProduct||busy} onClick={()=>analyse(selectedProduct)}>{create.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<ArrowRight className="h-4 w-4"/>}Analyse selected product</Btn>
      </section>}
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
