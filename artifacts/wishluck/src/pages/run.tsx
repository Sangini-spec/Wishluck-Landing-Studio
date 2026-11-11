import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Sparkles, Loader2, ExternalLink, AlertTriangle, Plus, Trash2, Save, Globe, Quote, LayoutTemplate, ArrowUpRight, ImageOff, Info } from "lucide-react";
import { useGetRun, useUpdateBrand, useUpdateProduct, useResearchRun, useGenerateRun, getGetRunQueryKey, type BrandProfile, type Run } from "@workspace/api-client-react";
import { PageHeader, StatusPill, Btn, ErrorState, Sk, Notice, Tag, EmptyState } from "@/components/bits";
import { useToast } from "@/hooks/use-toast";
import { errMsg, invalidateRun, isActive, stamp, host, ago } from "@/lib/run-utils";
import { cn } from "@/lib/utils";

const TABS = ["Product", "Brand", "Research", "Designs", "Activity"] as const;
type TabT = typeof TABS[number];

const field = "h-9 w-full rounded-lg border border-input bg-background px-3 text-[13.5px] outline-none transition focus:border-[hsl(var(--seal)/0.5)] focus:ring-2 focus:ring-[hsl(var(--seal)/0.15)]";
const lbl = "mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground";

const SUGGESTED_SPECS = ["Delivery estimate", "COD availability", "Return policy", "Package contents", "Materials", "Dimensions", "Intended audience"];
type VRow = { id: string; title: string; price: string; compareAtPrice: string; available: boolean };
type RRow = { text: string; author: string; sourceUrl: string; rating: string };
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const badNum = (s: string, max?: number) => s.trim() !== "" && (isNaN(Number(s)) || Number(s) < 0 || (max != null && Number(s) > max));

function Block({ title, hint, children, action }: { title: string; hint?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-5 first:border-0 first:pt-0">
      <div className="mb-3 flex items-start justify-between gap-3"><div><h4 className="text-[14px] font-medium">{title}</h4>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>{action}</div>
      {children}
    </section>
  );
}
function AddBtn({ onClick, label, testId }: { onClick: () => void; label: string; testId: string }) {
  return <button data-testid={testId} onClick={onClick} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="h-3 w-3" /> {label}</button>;
}
function RmBtn({ onClick, testId }: { onClick: () => void; testId: string }) {
  return <button data-testid={testId} onClick={onClick} className="shrink-0 rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>;
}

function ProductEditor({ run }: { run: Run }) {
  const p = run.product!;
  const qc = useQueryClient();
  const { toast } = useToast();
  const init = useRef<string | null>(null);
  const [title, setTitle] = useState(""); const [category, setCategory] = useState(""); const [desc, setDesc] = useState("");
  const [specs, setSpecs] = useState<[string, string][]>([]);
  const [price, setPrice] = useState(""); const [compare, setCompare] = useState(""); const [currency, setCurrency] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VRow[]>([]);
  const [rating, setRating] = useState(""); const [reviewCount, setReviewCount] = useState("");
  const [reviews, setReviews] = useState<RRow[]>([]);
  const [collectionUrl, setCollectionUrl] = useState("");
  useEffect(() => {
    if (init.current === run.id) return;
    init.current = run.id;
    setTitle(p.title); setCategory(p.category); setDesc(p.description); setSpecs(Object.entries(p.specs ?? {}));
    setPrice(p.price != null ? String(p.price) : ""); setCompare(p.compareAtPrice != null ? String(p.compareAtPrice) : ""); setCurrency(p.currency ?? "");
    setImages([...(p.images ?? [])]);
    setVariants((p.variants ?? []).map((v) => ({ id: v.id, title: v.title, price: String(v.price ?? ""), compareAtPrice: v.compareAtPrice != null ? String(v.compareAtPrice) : "", available: v.available })));
    setRating(p.rating != null ? String(p.rating) : ""); setReviewCount(p.reviewCount != null ? String(p.reviewCount) : "");
    setReviews((p.reviews ?? []).map((r) => ({ text: r.text, author: r.author, sourceUrl: r.sourceUrl, rating: r.rating != null ? String(r.rating) : "" })));
    setCollectionUrl(p.collectionUrl ?? "");
  }, [run.id, p]);
  const save = useUpdateProduct({ mutation: { onSuccess: () => { invalidateRun(qc, run.id); toast({ title: "Merchant corrections saved", description: "Edited fields are marked as merchant-confirmed." }); }, onError: (e) => toast({ title: "Save failed", description: errMsg(e), variant: "destructive" }) } });

  const errors: string[] = [];
  if (price.trim() === "" || badNum(price)) errors.push("Price must be a number of 0 or more.");
  if (badNum(compare)) errors.push("Compare-at price must be empty or a number of 0 or more.");
  if (!currency.trim()) errors.push("Currency is required.");
  if (badNum(rating, 5) || (rating !== "" && Number(rating) < 1)) errors.push("Rating must be empty or between 1 and 5.");
  if (badNum(reviewCount) || (reviewCount.trim() && !Number.isInteger(Number(reviewCount)))) errors.push("Review count must be empty or a whole number.");
  variants.forEach((v, i) => { if (!v.id.trim()) errors.push(`Variant ${i + 1} needs its real Shopify variant ID.`); if (v.price.trim() === "" || badNum(v.price) || badNum(v.compareAtPrice)) errors.push(`Variant ${i + 1} has an invalid price.`); });
  reviews.forEach((r, i) => { if (!r.text.trim() || !r.sourceUrl.trim()) errors.push(`Review ${i + 1} needs text and a source URL.`); if (badNum(r.rating, 5) || (r.rating !== "" && Number(r.rating) < 1)) errors.push(`Review ${i + 1} rating must be 1 to 5, or empty.`); });

  const onSave = () => {
    if (errors.length) return;
    save.mutate({ id: run.id, data: {
      title, category, description: desc,
      specs: Object.fromEntries(specs.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), v])),
      price: Number(price), compareAtPrice: numOrNull(compare), currency: currency.trim().toUpperCase(),
      images: images.map((s) => s.trim()).filter(Boolean),
      variants: variants.map((v) => ({ id: v.id.trim(), title: v.title, price: Number(v.price), compareAtPrice: numOrNull(v.compareAtPrice), available: v.available })),
      rating: numOrNull(rating), reviewCount: numOrNull(reviewCount),
      reviews: reviews.map((r) => ({ text: r.text.trim(), author: r.author.trim(), sourceUrl: r.sourceUrl.trim(), rating: numOrNull(r.rating) })),
      collectionUrl: collectionUrl.trim() || null,
    } });
  };
  const existingKeys = new Set(specs.map(([k]) => k.trim().toLowerCase()));
  const setV = (i: number, patch: Partial<VRow>) => setVariants(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const setR = (i: number, patch: Partial<RRow>) => setReviews(reviews.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const firstImg = images.find((s) => s.trim());

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="panel overflow-hidden">
          <div className="aspect-square bg-muted">{firstImg ? <img src={firstImg} alt={title} className="h-full w-full object-cover" /> : <div className="hatch grid h-full place-items-center text-muted-foreground"><ImageOff className="h-5 w-5" /></div>}</div>
          <div className="space-y-2 border-t border-border p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Brand</span><span>{p.brand || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Handle</span><span className="font-mono text-xs">{p.handle}</span></div>
            <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 pt-1 text-xs text-muted-foreground hover:text-foreground">Source page <ExternalLink className="h-3 w-3" /></a>
          </div>
        </div>
        {p.missingFacts.length > 0 && <div className="rounded-xl border border-[hsl(var(--amber)/0.3)] bg-[hsl(var(--amber)/0.05)] p-4"><div className={cn(lbl, "text-[hsl(var(--amber))]")}>Missing facts</div><ul className="list-disc space-y-1 pl-4 text-[13px]">{p.missingFacts.map((f) => <li key={f}>{f}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Pages will not invent these. Add verified values as specs to include them.</p></div>}
        <Notice tone="muted" icon={<Info className="h-3.5 w-3.5" />}>Saved edits are recorded as merchant-confirmed source corrections. Only enter facts you can verify; leave anything unknown empty.</Notice>
      </aside>

      <div className="panel space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-2xl">Correct the product</h3>
          <Btn data-testid="button-save-product" variant="ink" onClick={onSave} disabled={save.isPending || errors.length > 0}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save corrections</Btn>
        </div>
        {errors.length > 0 && <div className="rounded-lg border border-destructive/25 bg-destructive/[0.04] px-3.5 py-2.5 text-xs text-destructive" data-testid="text-product-errors"><ul className="list-disc space-y-0.5 pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}

        <Block title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={lbl}>Title</label><input data-testid="input-product-title" className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><label className={lbl}>Category</label><input data-testid="input-product-category" className={field} value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          </div>
          <div className="mt-4"><label className={lbl}>Description</label><textarea data-testid="input-product-description" rows={6} className={cn(field, "h-auto py-2 leading-relaxed")} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="mt-4"><label className={lbl}>Collection URL</label><input data-testid="input-product-collection" className={cn(field, "font-mono text-xs")} placeholder="Leave empty to clear" value={collectionUrl} onChange={(e) => setCollectionUrl(e.target.value)} /></div>
        </Block>

        <Block title="Pricing" hint="Empty compare-at price clears it.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={lbl}>Price</label><input data-testid="input-product-price" inputMode="decimal" className={field} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div><label className={lbl}>Compare-at price</label><input data-testid="input-product-compare" inputMode="decimal" className={field} placeholder="None" value={compare} onChange={(e) => setCompare(e.target.value)} /></div>
            <div><label className={lbl}>Currency</label><input data-testid="input-product-currency" maxLength={3} className={cn(field, "font-mono uppercase")} placeholder="USD" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
          </div>
        </Block>

        <Block title="Images" hint="Image URLs from the product or your CDN. Order matters; the first is the hero." action={<AddBtn testId="button-add-image" label="Add image" onClick={() => setImages([...images, ""])} />}>
          {images.length === 0 && <p className="text-sm text-muted-foreground">No images.</p>}
          <div className="space-y-2">{images.map((src, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-muted">{src.trim() && <img src={src} alt="" className="h-full w-full object-cover" />}</div>
              <input data-testid={`input-image-${i}`} className={cn(field, "font-mono text-xs")} placeholder="https://" value={src} onChange={(e) => setImages(images.map((s, j) => (j === i ? e.target.value : s)))} />
              <RmBtn testId={`button-remove-image-${i}`} onClick={() => setImages(images.filter((_, j) => j !== i))} />
            </div>))}</div>
        </Block>

        <Block title="Variants" action={<AddBtn testId="button-add-variant" label="Add variant" onClick={() => setVariants([...variants, { id: "", title: "", price: price, compareAtPrice: "", available: true }])} />}
          hint={<span className="text-[hsl(var(--amber))]">Variant IDs must be the real Shopify variant IDs from your admin. Never invent one: a wrong ID breaks add to cart on the published page.</span>}>
          {variants.length === 0 && <p className="text-sm text-muted-foreground">No variants.</p>}
          <div className="space-y-2">{variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.1fr_1.3fr_.8fr_.8fr_auto_auto]">
              <input data-testid={`input-variant-id-${i}`} className={cn(field, "font-mono text-xs")} placeholder="Variant ID" value={v.id} onChange={(e) => setV(i, { id: e.target.value })} />
              <input data-testid={`input-variant-title-${i}`} className={field} placeholder="Title" value={v.title} onChange={(e) => setV(i, { title: e.target.value })} />
              <input data-testid={`input-variant-price-${i}`} inputMode="decimal" className={field} placeholder="Price" value={v.price} onChange={(e) => setV(i, { price: e.target.value })} />
              <input data-testid={`input-variant-compare-${i}`} inputMode="decimal" className={field} placeholder="Compare-at" value={v.compareAtPrice} onChange={(e) => setV(i, { compareAtPrice: e.target.value })} />
              <label className="flex items-center gap-1.5 whitespace-nowrap px-1 text-xs"><input data-testid={`checkbox-variant-available-${i}`} type="checkbox" checked={v.available} onChange={(e) => setV(i, { available: e.target.checked })} className="accent-[hsl(var(--seal))]" /> In stock</label>
              <RmBtn testId={`button-remove-variant-${i}`} onClick={() => setVariants(variants.filter((_, j) => j !== i))} />
            </div>))}</div>
        </Block>

        <Block title="Ratings & reviews" hint="Only genuine reviews with a link to where they are published. Empty rating or count clears it.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={lbl}>Average rating (1 to 5)</label><input data-testid="input-product-rating" inputMode="decimal" className={field} placeholder="None" value={rating} onChange={(e) => setRating(e.target.value)} /></div>
            <div><label className={lbl}>Review count</label><input data-testid="input-product-review-count" inputMode="numeric" className={field} placeholder="None" value={reviewCount} onChange={(e) => setReviewCount(e.target.value)} /></div>
          </div>
          <div className="mt-4 mb-2 flex items-center justify-between"><span className={cn(lbl, "mb-0")}>Review excerpts</span><AddBtn testId="button-add-review" label="Add review" onClick={() => setReviews([...reviews, { text: "", author: "", sourceUrl: "", rating: "" }])} /></div>
          {reviews.length === 0 && <p className="text-sm text-muted-foreground">No review content.</p>}
          <div className="space-y-3">{reviews.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2"><textarea data-testid={`input-review-text-${i}`} rows={2} className={cn(field, "h-auto py-2")} placeholder="Review text, quoted exactly" value={r.text} onChange={(e) => setR(i, { text: e.target.value })} /><RmBtn testId={`button-remove-review-${i}`} onClick={() => setReviews(reviews.filter((_, j) => j !== i))} /></div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1.6fr_.6fr]">
                <input data-testid={`input-review-author-${i}`} className={field} placeholder="Author" value={r.author} onChange={(e) => setR(i, { author: e.target.value })} />
                <input data-testid={`input-review-source-${i}`} className={cn(field, "font-mono text-xs")} placeholder="Source URL" value={r.sourceUrl} onChange={(e) => setR(i, { sourceUrl: e.target.value })} />
                <input data-testid={`input-review-rating-${i}`} inputMode="decimal" className={field} placeholder="Rating" value={r.rating} onChange={(e) => setR(i, { rating: e.target.value })} />
              </div>
            </div>))}</div>
        </Block>

        <Block title="Specs" action={<AddBtn testId="button-add-spec" label="Add spec" onClick={() => setSpecs([...specs, ["", ""]])} />}>
          <div className="mb-3 rounded-lg bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Buyers often look for these, but they were not necessarily found on your page. Add one only if you can confirm the value; the label is added empty for you to fill.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{SUGGESTED_SPECS.map((s) => (
              <button key={s} data-testid={`button-suggest-spec-${s.toLowerCase().replace(/\s/g, "-")}`} disabled={existingKeys.has(s.toLowerCase())} onClick={() => setSpecs([...specs, [s, ""]])}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11.5px] hover:border-[hsl(var(--seal)/0.4)] disabled:opacity-40"><Plus className="h-3 w-3" />{s}</button>))}</div>
          </div>
          {specs.length === 0 && <p className="py-2 text-sm text-muted-foreground">No specs.</p>}
          <div className="space-y-2">{specs.map(([k, v], i) => (
            <div key={i} className="flex gap-2">
              <input data-testid={`input-spec-key-${i}`} className={cn(field, "w-2/5")} placeholder="Name" value={k} onChange={(e) => setSpecs(specs.map((s, j) => (j === i ? [e.target.value, s[1]] : s)))} />
              <input data-testid={`input-spec-value-${i}`} className={field} placeholder="Verified value" value={v} onChange={(e) => setSpecs(specs.map((s, j) => (j === i ? [s[0], e.target.value] : s)))} />
              <RmBtn testId={`button-remove-spec-${i}`} onClick={() => setSpecs(specs.filter((_, j) => j !== i))} />
            </div>))}</div>
        </Block>
      </div>
    </div>
  );
}

const COLOR_KEYS: (keyof BrandProfile)[] = ["primary", "secondary", "background", "text", "button"];
const TEXT_KEYS: (keyof BrandProfile)[] = ["headingFont", "bodyFont", "shopifyHeadingFont", "shopifyBodyFont", "headingSize", "bodySize", "headingWeight", "bodyWeight", "radius", "spacing", "buttonStyle", "imageStyle"];
const pretty = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function BrandEditor({ run }: { run: Run }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const init = useRef<string | null>(null);
  const [b, setB] = useState<BrandProfile | null>(null);
  useEffect(() => { if (run.brand && init.current !== run.id) { init.current = run.id; setB({ ...run.brand }); } }, [run.id, run.brand]);
  const save = useUpdateBrand({ mutation: { onSuccess: () => { invalidateRun(qc, run.id); toast({ title: "Brand profile saved" }); }, onError: (e) => toast({ title: "Save failed", description: errMsg(e), variant: "destructive" }) } });
  if (!b) return <EmptyState icon={<LayoutTemplate className="h-5 w-5" />} title="No brand profile" body="Brand extraction did not produce a profile for this run." />;
  const set = (k: keyof BrandProfile, v: string) => setB({ ...b, [k]: v });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="panel space-y-6 p-5">
        <div className="flex items-center justify-between"><h3 className="font-display text-2xl">Correct the brand</h3><Btn data-testid="button-save-brand" variant="ink" disabled={save.isPending} onClick={() => save.mutate({ id: run.id, data: b })}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Btn></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{COLOR_KEYS.map((k) => (
          <label key={k} className="block"><span className={lbl}>{k}</span>
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background p-1.5">
              <input data-testid={`input-brand-${k}-picker`} type="color" value={/^#[0-9a-f]{6}$/i.test(String(b[k])) ? String(b[k]) : "#000000"} onChange={(e) => set(k, e.target.value)} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" />
              <input data-testid={`input-brand-${k}`} value={String(b[k] ?? "")} onChange={(e) => set(k, e.target.value)} className="w-full min-w-0 bg-transparent font-mono text-xs outline-none" />
            </div></label>))}</div>
        <div className="grid gap-4 sm:grid-cols-2">{TEXT_KEYS.map((k) => (
          <div key={k}><label className={lbl}>{pretty(k)}</label><input data-testid={`input-brand-${k}`} className={field} value={String(b[k] ?? "")} onChange={(e) => set(k, e.target.value)} /></div>))}</div>
        <div><label className={lbl}>Tone</label><textarea data-testid="input-brand-tone" rows={3} className={cn(field, "h-auto py-2")} value={b.tone} onChange={(e) => set("tone", e.target.value)} /></div>
        <div><label className={lbl}>Evidence</label><textarea data-testid="input-brand-evidence" rows={3} className={cn(field, "h-auto py-2 font-mono text-xs")} value={b.evidence ?? ""} onChange={(e) => set("evidence", e.target.value)} /></div>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div className={lbl}>Live specimen</div>
        <div className="overflow-hidden border border-border shadow-sm" style={{ background: b.background, color: b.text, borderRadius: b.radius }}>
          <div className="h-2" style={{ background: b.primary }} />
          <div className="space-y-3 p-6">
            <div style={{ fontFamily: b.headingFont, fontWeight: Number(b.headingWeight) || 700, fontSize: "26px", lineHeight: 1.1 }}>{run.product?.title || "Product headline"}</div>
            <p style={{ fontFamily: b.bodyFont, fontWeight: Number(b.bodyWeight) || 400, fontSize: "14px", opacity: 0.85 }}>{(run.product?.description || "Body copy renders in the extracted body font.").slice(0, 140)}</p>
            <button className="px-4 py-2 text-sm font-semibold" style={{ background: b.button, color: b.background, borderRadius: b.radius }}>Add to cart</button>
            <div className="flex gap-1.5 pt-2">{COLOR_KEYS.map((k) => <span key={k} title={k} className="h-5 w-5 rounded-full border border-black/10" style={{ background: String(b[k]) }} />)}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Specimen uses fonts available in this browser; Shopify font fields map to the theme's font picker.</p>
      </aside>
    </div>
  );
}

const humanKey = (k: string) => k.replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
function AnalysisView({ value, depth = 0 }: { value: unknown; depth?: number }): React.ReactElement {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "string" && /^https?:\/\//.test(value)) return <a href={value} target="_blank" rel="noreferrer" className="break-all font-mono text-[11.5px] underline-offset-2 hover:underline">{value}</a>;
  if (typeof value !== "object") return <span className="break-words">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-muted-foreground">None</span>;
    return <ul className="list-disc space-y-1 pl-4">{value.map((v, i) => <li key={i}><AnalysisView value={v} depth={depth + 1} /></li>)}</ul>;
  }
  return (
    <dl className={cn("space-y-2", depth > 0 && "border-l border-border pl-3")}>{Object.entries(value as Record<string, unknown>).map(([k, v]) => (
      <div key={k}><dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{humanKey(k)}</dt><dd className="mt-0.5 text-[13px]"><AnalysisView value={v} depth={depth + 1} /></dd></div>))}</dl>
  );
}

function Research({ run }: { run: Run }) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 font-display text-2xl">Competitors</h3>
        {run.competitors.length === 0 ? <EmptyState icon={<Globe className="h-5 w-5" />} title="No competitors researched" body="Run research to find and capture comparable pages. If search is not configured, research will report that it is unavailable." /> :
          <div className="grid gap-4 md:grid-cols-2">{run.competitors.map((c) => (
            <article key={c.id} data-testid={`card-competitor-${c.id}`} className="panel overflow-hidden">
              <div className="relative aspect-[16/9] overflow-hidden border-b border-border bg-muted">
                {c.screenshot ? <img src={c.screenshot} alt={c.title} className="h-full w-full object-cover object-top" /> : <div className="hatch grid h-full place-items-center text-xs text-muted-foreground">No screenshot captured</div>}
                {c.mobileScreenshot && <img src={c.mobileScreenshot} alt="" className="absolute bottom-2 right-2 h-[70%] rounded-md border border-border object-cover object-top shadow-lg" />}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate font-medium">{c.title}</div><a href={c.url} target="_blank" rel="noreferrer" className="font-mono text-xs text-muted-foreground hover:underline">{host(c.url)}</a></div><StatusPill status={c.status} /></div>
                <p className="mt-2 text-[13px] text-muted-foreground">{c.reason}</p>
                {c.error && <p className="mt-2 text-xs text-destructive">{c.error}</p>}
                {c.sections.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{c.sections.map((s) => <Tag key={s}>{s}</Tag>)}</div>}
                {c.analysis && Object.keys(c.analysis).length > 0 && <details className="mt-3 rounded-lg border border-border" open><summary className="cursor-pointer px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Conversion breakdown</summary><div className="border-t border-border px-3 py-2"><AnalysisView value={c.analysis} /></div></details>}
                {c.htmlUrl && <a href={c.htmlUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs hover:underline">Captured HTML <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </article>))}</div>}
      </section>
      <section>
        <h3 className="mb-3 font-display text-2xl">Sourced learnings</h3>
        {run.learnings.length === 0 ? <p className="text-sm text-muted-foreground">No learnings yet. Each learning will cite the competitor pages it came from.</p> :
          <ul className="panel divide-y divide-border">{run.learnings.map((l) => (
            <li key={l.id} className="flex gap-3 p-4"><Quote className="mt-1 h-3.5 w-3.5 shrink-0 text-[hsl(var(--seal))]" /><div><p className="text-[14px]">{l.text}</p><div className="mt-1.5 flex flex-wrap items-center gap-2"><Tag>{l.category}</Tag>{l.sources.map((s) => <a key={s} href={s} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-muted-foreground hover:underline">{host(s)}</a>)}</div></div></li>))}</ul>}
      </section>
    </div>
  );
}

function Designs({ run }: { run: Run }) {
  if (!run.designs.length) return <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No designs generated" body="Correct the product and brand, optionally research competitors, then generate." />;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{run.designs.map((d) => (
      <Link key={d.id} href={`/designs/${d.id}`} data-testid={`card-design-${d.id}`} className="panel group block overflow-hidden transition-transform hover:-translate-y-0.5">
        <div className="relative h-56 overflow-hidden border-b border-border bg-muted">
          <iframe title={d.name} src={d.previewUrl} className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: 1440, height: 1800, transform: "scale(0.27)" }} tabIndex={-1} />
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2"><div className="truncate font-medium">{d.name}</div><StatusPill status={d.status} /></div>
          <div className="mt-0.5 text-xs text-muted-foreground">{d.direction} · v{d.version}</div>
          <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground"><span>Score {Math.round(d.scores.overall)}</span><span>{d.comparedCount?`${Math.round(d.uniqueness)}% layout difference`:"New baseline"}</span><ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
        </div>
      </Link>))}</div>
  );
}

export default function RunPage() {
  const { id = "" } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabT>("Product");
  const { data: run, isLoading, error, refetch } = useGetRun(id, { query: { enabled: !!id, queryKey: getGetRunQueryKey(id), refetchInterval: (q) => (isActive(q.state.data?.status) ? 2000 : false) } });
  const opts = { mutation: { onSuccess: () => invalidateRun(qc, id), onError: (e: unknown) => toast({ title: "Action failed", description: errMsg(e), variant: "destructive" as const }) } };
  const research = useResearchRun(opts);
  const generate = useGenerateRun({ mutation: { ...opts.mutation, onSuccess: () => { invalidateRun(qc, id); setTab("Designs"); } } });
  const autoTab = useRef(false);
  useEffect(() => { if (run && !autoTab.current) { autoTab.current = true; if (!run.product) setTab("Activity"); else if (run.designs.length) setTab("Designs"); } }, [run]);

  if (error) return <ErrorState message={errMsg(error)} onRetry={() => refetch()} />;
  if (isLoading || !run) return <div className="space-y-4"><Sk className="h-12 w-2/3" /><Sk className="h-6 w-1/3" /><Sk className="h-96" /></div>;
  const busy = isActive(run.status);
  const canAct = !!run.product && !busy;

  return (
    <>
      <PageHeader eyebrow={`Run · ${host(run.url)}`} title={run.product?.title || "Analysing product"}
        sub={<span className="inline-flex flex-wrap items-center gap-2"><StatusPill status={run.status} /><span className="font-mono text-xs">stage: {run.stage}</span><span className="text-xs">· started {ago(run.createdAt)}</span>{run.aiCost != null && <span className="font-mono text-xs">· AI cost ${run.aiCost.toFixed(4)}</span>}</span>}
        actions={<>
          <Btn data-testid="button-research" variant="outline" disabled={!canAct || research.isPending} onClick={() => research.mutate({ id })}>{research.isPending || run.status === "researching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Research competitors</Btn>
          <Btn data-testid="button-generate" variant="seal" disabled={!canAct || generate.isPending} onClick={() => generate.mutate({ id })}>{generate.isPending || run.status === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {run.designs.length ? "Generate again" : "Generate designs"}</Btn>
        </>} />

      {busy && (
        <div className="panel mb-6 overflow-hidden">
          <div className="relative h-0.5 overflow-hidden bg-muted"><div className="indeterminate absolute inset-y-0 w-1/3 bg-[hsl(var(--seal))]" /></div>
          <div className="flex items-center gap-3 p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--seal))]" /><span className="font-medium">{run.events[run.events.length - 1]?.message ?? "Working"}</span><span className="ml-auto font-mono text-xs text-muted-foreground">updates every 2s</span></div>
        </div>
      )}
      {run.error && <div className="mb-4"><ErrorState message={run.error} /></div>}
      {run.warnings.length > 0 && <div className="mb-6 space-y-2">{run.warnings.map((w, i) => <Notice key={i} icon={<AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--amber))]" />}>{w}</Notice>)}</div>}
      {run.status === "analysed" && run.designs.length === 0 && <div className="mb-6"><Notice tone="seal">Analysis is paused for your review. Correct the product and brand below, then research or generate.</Notice></div>}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const count = t === "Research" ? run.competitors.length : t === "Designs" ? run.designs.length : t === "Activity" ? run.events.length : null;
          return <button key={t} data-testid={`tab-${t.toLowerCase()}`} onClick={() => setTab(t)} className={cn("relative whitespace-nowrap px-3.5 pb-3 pt-1 text-[13.5px] transition-colors", tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t}{count ? <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{count}</span> : null}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded bg-[hsl(var(--seal))]" />}
          </button>;
        })}
      </div>

      <div key={tab} className="rise">
        {tab === "Product" && (run.product ? <ProductEditor run={run} /> : <EmptyState icon={<Loader2 className={cn("h-5 w-5", busy && "animate-spin")} />} title={busy ? "Reading the product page" : "No product extracted"} body={busy ? "Product facts appear here once extraction finishes." : "Extraction did not produce a product. Check the activity log for details."} />)}
        {tab === "Brand" && (run.brand ? <BrandEditor run={run} /> : <EmptyState icon={<LayoutTemplate className="h-5 w-5" />} title={busy ? "Extracting brand system" : "No brand profile"} body="Colors, type and tone will be editable here." />)}
        {tab === "Research" && <Research run={run} />}
        {tab === "Designs" && <Designs run={run} />}
        {tab === "Activity" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <ol className="panel relative p-5">{run.events.length === 0 && <li className="text-sm text-muted-foreground">No events yet.</li>}
              {run.events.map((e, i) => (
                <li key={i} className="relative flex gap-4 pb-4 last:pb-0">
                  {i < run.events.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-border" />}
                  <span className={cn("relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-card", i === run.events.length - 1 && busy ? "pulse-dot bg-[hsl(var(--seal))]" : "bg-foreground/25")} />
                  <div className="min-w-0"><div className="text-[13.5px]">{e.message}</div><div className="font-mono text-[11px] text-muted-foreground">{e.stage} · {stamp(e.at)}</div></div>
                </li>))}</ol>
            <div className="space-y-3">{run.screenshot && <div className="panel overflow-hidden"><div className={cn(lbl, "px-3 pt-3")}>Source desktop</div><img src={run.screenshot} alt="Source page" className="w-full" /></div>}
              {run.mobileScreenshot && <div className="panel overflow-hidden"><div className={cn(lbl, "px-3 pt-3")}>Source mobile</div><img src={run.mobileScreenshot} alt="Source page mobile" className="mx-auto w-1/2" /></div>}</div>
          </div>
        )}
      </div>
    </>
  );
}
