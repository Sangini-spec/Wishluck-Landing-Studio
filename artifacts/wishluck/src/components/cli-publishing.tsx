import {useState,useEffect,useRef} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {ExternalLink,Loader2,Upload} from "lucide-react";
import {useGetCliPublishingStatus,useUploadCliTheme,useCheckCliPublication,useGetPublishingContext,type Design,type CliUploadInput} from "@workspace/api-client-react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Btn,Notice} from "@/components/bits";
import {useToast} from "@/hooks/use-toast";
import {errMsg} from "@/lib/run-utils";

export function CliPublishing({design,open:uploadOpen,onOpenChange:setUploadOpen}:{design:Design;open:boolean;onOpenChange:(open:boolean)=>void}){
  const qc=useQueryClient(),{toast}=useToast();
  const status=useGetCliPublishingStatus({query:{staleTime:30000}});
  const [uploadConfirm,setUploadConfirm]=useState(false),[assign,setAssign]=useState(false);
  const [mode,setMode]=useState<NonNullable<CliUploadInput["productMode"]>>("existing"),[productId,setProductId]=useState("");
  const [importRights,setImportRights]=useState(false),[currencyConfirm,setCurrencyConfirm]=useState(false);
  const context=useGetPublishingContext(design.id,{query:{enabled:uploadOpen,staleTime:0}});
  const popup=useRef<Window|null>(null),lastShop=useRef<string|undefined>(undefined);
  const returnCheck=useRef<{id:string;shop:string}|null>(null),designRef=useRef(design);designRef.current=design;
  const check=useCheckCliPublication({mutation:{onSuccess:()=>{void qc.invalidateQueries();},onError:e=>toast({title:"Shopify check needs attention",description:errMsg(e),variant:"destructive"})}});
  const upload=useUploadCliTheme({mutation:{
    onSuccess:async p=>{
      if(p.status==="failed"){popup.current?.close();toast({title:"Theme upload incomplete",description:p.error,variant:"destructive"});await qc.invalidateQueries();return;}
      if(p.editorUrl&&popup.current&&!popup.current.closed){returnCheck.current={id:p.id,shop:p.shop!};popup.current.location.href=p.editorUrl;}
      setUploadOpen(false);setUploadConfirm(false);
      toast({title:"Published to an unpublished Shopify theme",description:popup.current&&!popup.current.closed?"Shopify's editor is opening. Quality checks run back here.":"Use Open theme editor below if your browser blocked the new tab."});
      await qc.invalidateQueries();
    },
    onError:()=>{popup.current?.close();},
  }});
  const ready=!!status.data?.authenticated;
  useEffect(()=>{
    if(lastShop.current&&lastShop.current!==status.data?.shop){setUploadOpen(false);setUploadConfirm(false);returnCheck.current=null;setProductId("");}
    lastShop.current=status.data?.shop;
  },[status.data?.shop,setUploadOpen]);
  useEffect(()=>{if(uploadOpen&&context.data){setMode(context.data.sameStore?"source":"existing");setProductId("");setAssign(false);setImportRights(false);setCurrencyConfirm(false);}},[uploadOpen,context.data?.shop]);
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    const focus=()=>{
      if(!returnCheck.current||document.hidden)return;
      if(designRef.current.lighthouse?.status==="running"){timer=setTimeout(focus,4000);return;}
      const target=returnCheck.current;returnCheck.current=null;
      check.mutate({id:target.id,data:{expectedShop:target.shop,runAudit:true}});
    };
    window.addEventListener("focus",focus);return()=>{window.removeEventListener("focus",focus);if(timer)clearTimeout(timer);};
  },[check.mutate]);
  const uploads=(status.data?.uploads??[]).filter(p=>p.designId===design.id);
  const approved=["approved","published"].includes(design.status);
  function closeUpload(open:boolean){if(upload.isPending)return;setUploadOpen(open);if(!open){setUploadConfirm(false);upload.reset();}}
  function confirmUpload(){
    // Reserve a tab synchronously with the click: opening after an async CLI
    // response would be blocked by normal browser popup protection.
    popup.current=window.open("about:blank","_blank");
    if(popup.current){popup.current.opener=null;popup.current.document.title="Publishing to Shopify";popup.current.document.body.textContent="Wishluck is validating and uploading your unpublished theme. Shopify's editor will open here when verification finishes.";}
    upload.mutate({data:{designId:design.id,expectedShop:status.data!.shop,confirmUnpublishedUpload:true,productMode:mode,
      productId:mode==="existing"?productId:undefined,confirmTemplateAssignment:mode!=="none"&&assign,confirmProductImport:importRights,confirmCurrencyMismatch:currencyConfirm}});
  }
  return <section className="panel my-5 space-y-4 p-5" data-testid="cli-publishing">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-display text-xl">Theme Access publishing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Publish through CLI, edit in Shopify, review the preview, then use Shopify’s Publish button when you are ready to go live.</p></div>
      <Btn data-testid="button-cli-upload" variant="outline" disabled={!ready||!approved||status.isFetching} onClick={()=>setUploadOpen(true)}><Upload className="h-4 w-4"/>Publish another preview</Btn>
    </div>
    {status.isLoading?<p className="text-sm text-muted-foreground">Checking store-specific Theme Access…</p>:status.error?<Notice>{errMsg(status.error)}</Notice>:
      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{status.data?.shop}</span> · {ready?"Theme Access authenticated":status.data?.configured?"Authentication failed":"Theme Access password not configured"}</p>}
    {status.data&&!ready&&<Notice>{status.data.message??`Add ${status.data.credentialKey} through project Secrets. This credential is specific to this store.`}</Notice>}
    <p className="text-xs text-muted-foreground">The app never activates the theme. Shopify’s editor opens after verified upload. Return here after editing or publishing to refresh the theme status and rerun Lighthouse.</p>
    {uploads.map(p=><article key={p.id} className="rounded-lg border border-border p-3" data-testid={`cli-upload-${p.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm">{p.themeName??"CLI upload"}</b>
        <p className="mt-1 text-xs text-muted-foreground">Theme {p.themeId??"ID unavailable"} · {p.livePublished?"Live on Shopify":p.verified?"Verified · unpublished":"Not verified"} · {p.shop}</p></div>
        {p.verified&&<Btn data-testid={`button-cli-check-${p.id}`} variant="outline" disabled={!ready||check.isPending||design.lighthouse?.status==="running"} onClick={()=>check.mutate({id:p.id,data:{expectedShop:p.shop!,runAudit:true}})}>{check.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:null}Check Shopify & run audit</Btn>}
      </div>
      {p.error&&<Notice>{p.error}</Notice>}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">{p.previewUrl&&<a href={p.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Preview on Shopify<ExternalLink className="h-3 w-3"/></a>}{p.editorUrl&&<a href={p.editorUrl} onClick={()=>{returnCheck.current={id:p.id,shop:p.shop!};}} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Open theme editor<ExternalLink className="h-3 w-3"/></a>}</div>
      {p.productHandle&&<p className="mt-2 text-xs text-muted-foreground">Product: {p.productHandle} · {p.productStatus?.toLowerCase()} · {p.templateAssigned?"Template assignment verified":"Default template preview; global assignment unchanged"}</p>}
      {p.warnings?.map((warning,i)=><p key={i} className="mt-2 text-xs text-muted-foreground">{warning}</p>)}
      {p.checkedAt&&<p className="mt-2 text-xs text-muted-foreground">Shopify status checked {new Date(p.checkedAt).toLocaleString()}</p>}
    </article>)}
    <Dialog open={uploadOpen} onOpenChange={closeUpload}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Publish to Shopify</DialogTitle><DialogDescription>Create a new unpublished theme in {status.data?.shop} using CLI. The editor opens after file verification; only you can make it live from Shopify.</DialogDescription></DialogHeader>
      {context.isLoading?<p>Loading store products…</p>:context.error?<Notice>{errMsg(context.error)}</Notice>:<div className="space-y-3">
        <label className="block text-sm">Product destination<select data-testid="select-cli-product-mode" className="mt-1 w-full rounded border border-border bg-background p-2" value={mode} disabled={upload.isPending} onChange={e=>{setMode(e.target.value as typeof mode);setAssign(false);}}>
          {context.data?.sameStore&&<option value="source">Source product in this store</option>}<option value="existing">Choose a product from this store</option><option value="import">Import or reuse a draft copy</option><option value="none">Theme only — choose product later</option></select></label>
        {mode==="existing"&&<><label className="block text-sm">Store product<select data-testid="select-cli-product" className="mt-1 w-full rounded border border-border bg-background p-2" value={productId} disabled={upload.isPending} onChange={e=>setProductId(e.target.value)}><option value="">Choose a product</option>{context.data?.products.map(p=><option key={p.id} value={p.id}>{p.title} · {p.status.toLowerCase()}</option>)}</select></label><p className="text-xs text-muted-foreground">Keeps this composition but uses the selected product’s real images, variants and facts. Unrelated source claims are removed.</p></>}
        {mode==="import"&&<><label className="flex gap-2 text-sm"><input type="checkbox" checked={importRights} onChange={e=>setImportRights(e.target.checked)}/>I have the rights to import the product and images as a draft.</label>{context.data?.sourceCurrency!==context.data?.currency&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={currencyConfirm} onChange={e=>setCurrencyConfirm(e.target.checked)}/>Keep numeric prices in {context.data?.currency}; no currency conversion is performed.</label>}<p className="text-xs text-muted-foreground">An existing matching Wishluck draft is reused. Products are never activated automatically.</p></>}
        {mode!=="none"&&<label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm"><input data-testid="checkbox-cli-assignment" type="checkbox" checked={assign} disabled={upload.isPending} onChange={e=>setAssign(e.target.checked)}/><span>Assign this product’s template and SEO fields after verification. This is a global product change, even though the new theme stays unpublished. Leave unchecked for a preview with no product changes.</span></label>}
      </div>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={uploadConfirm} onChange={e=>setUploadConfirm(e.target.checked)} disabled={upload.isPending} data-testid="checkbox-cli-upload"/><span>Create a new unpublished theme in this store. Keep the current live theme unchanged.</span></label>
      {upload.error&&<Notice>{errMsg(upload.error)}</Notice>}
      {upload.data?.status==="failed"&&<Notice>{upload.data.error}</Notice>}
      <div className="flex justify-end gap-2"><Btn variant="outline" disabled={upload.isPending} onClick={()=>closeUpload(false)}>Cancel</Btn>
        <Btn data-testid="button-cli-confirm-upload" disabled={!uploadConfirm||!ready||!approved||upload.isPending||context.isLoading||!!context.error||(mode==="existing"&&!productId)||(mode==="import"&&(!importRights||(context.data?.sourceCurrency!==context.data?.currency&&!currencyConfirm)))} onClick={confirmUpload}>{upload.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:null}Publish & open Shopify</Btn></div>
    </DialogContent></Dialog>
  </section>;
}
