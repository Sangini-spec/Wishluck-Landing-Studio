import {useState,useEffect,useRef} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {ExternalLink,Loader2,EyeOff,Eye} from "lucide-react";
import {useGetCliPublishingStatus,useGetPublishingJobs,useUploadCliTheme,useCheckCliPublication,useGetPublishingContext,type Design,type CliUploadInput} from "@workspace/api-client-react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Btn,Notice} from "@/components/bits";
import {useToast} from "@/hooks/use-toast";
import {errMsg} from "@/lib/run-utils";
import {historyPreferences,readyPublication,uploadPhase,type PendingUpload} from "@/lib/publishing-ui";

export function CliPublishing({design,open:uploadOpen,onOpenChange:setUploadOpen}:{design:Design;open:boolean;onOpenChange:(open:boolean)=>void}){
  const qc=useQueryClient(),{toast}=useToast();
  const pendingKey=`wishluck:pending-upload:${design.id}`,historyKey=`wishluck:publication-history:${design.id}`,returnKey=`wishluck:editor-return:${design.id}`;
  const [pending,setPending]=useState<PendingUpload|null>(null),[progressError,setProgressError]=useState<string|null>(null);
  const [history,setHistory]=useState(()=>{try{return historyPreferences(localStorage.getItem(historyKey));}catch{return historyPreferences(null);}});
  useEffect(()=>{
    try{
      setHistory(historyPreferences(localStorage.getItem(historyKey)));
      const saved=JSON.parse(sessionStorage.getItem(pendingKey)??"null");
      setPending(saved?.id&&saved?.shop&&saved.designId===design.id?saved:null);
      const editorReturn=JSON.parse(sessionStorage.getItem(returnKey)??"null");
      returnCheck.current=editorReturn?.id&&editorReturn?.shop?editorReturn:null;
    }catch{setPending(null);}
    setProgressError(null);
  },[design.id,historyKey,pendingKey,returnKey]);
  function rememberPending(value:PendingUpload|null){
    setPending(value);
    try{if(value?.id)sessionStorage.setItem(pendingKey,JSON.stringify(value));else sessionStorage.removeItem(pendingKey);}catch{/* In-memory progress still works when browser storage is disabled. */}
  }
  function changeHistory(patch:Partial<typeof history>){
    setHistory(old=>{const next={...old,...patch};try{localStorage.setItem(historyKey,JSON.stringify(next));}catch{/* Hiding still works for this visit. */}return next;});
  }
  const status=useGetCliPublishingStatus({query:{staleTime:30000,refetchInterval:pending?.id?2500:false}});
  const jobs=useGetPublishingJobs({query:{refetchInterval:q=>q.state.data?.some(j=>["queued","running"].includes(j.status))?2000:15000,refetchOnWindowFocus:true}});
  const [uploadConfirm,setUploadConfirm]=useState(false),[assign,setAssign]=useState(false);
  const [mode,setMode]=useState<NonNullable<CliUploadInput["productMode"]>>("existing"),[productId,setProductId]=useState("");
  const [importRights,setImportRights]=useState(false),[currencyConfirm,setCurrencyConfirm]=useState(false);
  const context=useGetPublishingContext(design.id,{query:{enabled:uploadOpen,staleTime:0}});
  const lastShop=useRef<string|undefined>(undefined),lastJobs=useRef("");
  const returnCheck=useRef<{id:string;shop:string}|null>(null),designRef=useRef(design);designRef.current=design;
  const check=useCheckCliPublication({mutation:{onSuccess:()=>{void qc.invalidateQueries();},onError:e=>toast({title:"Shopify check needs attention",description:errMsg(e),variant:"destructive"})}});
  const upload=useUploadCliTheme({mutation:{
    onSuccess:async p=>{
      if(p.status==="failed"){rememberPending(null);setProgressError(p.error??"The upload could not be verified.");await qc.invalidateQueries();return;}
      if(p.status==="uploading"){
        rememberPending({id:p.jobId??p.id,shop:p.shop!,designId:design.id});
        setUploadOpen(false);setUploadConfirm(false);
        await qc.invalidateQueries();return;
      }
      rememberPending({id:p.jobId??p.id,shop:p.shop!,designId:design.id});
      setUploadOpen(false);setUploadConfirm(false);
      await qc.invalidateQueries();
    },
    onError:e=>{rememberPending(null);setProgressError(errMsg(e));void qc.invalidateQueries();},
  }});
  const ready=!!status.data?.authenticated;
  useEffect(()=>{
    if(lastShop.current&&status.data?.shop&&lastShop.current!==status.data.shop){setUploadOpen(false);setUploadConfirm(false);returnCheck.current=null;rememberPending(null);setProductId("");}
    lastShop.current=status.data?.shop;
  },[status.data?.shop,setUploadOpen]);
  useEffect(()=>{
    if(!jobs.data)return;
    const signature=jobs.data.map(j=>`${j.id}:${j.phase}:${j.status}:${j.updatedAt}`).join("|");
    if(lastJobs.current!==signature)void qc.invalidateQueries({predicate:q=>q.queryKey[0]!=="/api/shopify/jobs"});
    lastJobs.current=signature;
  },[jobs.data,qc]);
  useEffect(()=>{
    if(!pending?.id||!status.data)return;
    if(pending.shop!==status.data.shop){rememberPending(null);setProgressError("The connected store changed. Open this upload from its original store.");return;}
    const p=readyPublication(pending,status.data.uploads,jobs.data??[]);
    const job=jobs.data?.find(j=>j.id===pending.id&&j.shop===pending.shop);
    if(p?.editorUrl){
      returnCheck.current={id:p.id,shop:p.shop!};
      try{sessionStorage.setItem(returnKey,JSON.stringify({id:p.id,shop:p.shop}));}catch{/* The explicit check button remains available. */}
      rememberPending(null);setUploadOpen(false);
      // Same-tab navigation needs no popup permission or opener reference.
      // Clear the saved intent first so Back never redirects to Shopify again.
      window.location.assign(p.editorUrl);
    }else if(job&&["failed","attention"].includes(job.status)){
      rememberPending(null);setProgressError(job.error??"The upload needs attention. Your saved record is available below.");
    }
  },[status.data,jobs.data,pending]);
  useEffect(()=>{if(uploadOpen&&context.data){setMode(context.data.sameStore?"source":"existing");setProductId("");setAssign(false);setImportRights(false);setCurrencyConfirm(false);}},[uploadOpen,context.data?.shop]);
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    const focus=()=>{
      if(!returnCheck.current||document.hidden)return;
      if(designRef.current.lighthouse?.status==="running"){timer=setTimeout(focus,4000);return;}
      const target=returnCheck.current;returnCheck.current=null;
      try{sessionStorage.removeItem(returnKey);}catch{/* Storage is optional. */}
      check.mutate({id:target.id,data:{expectedShop:target.shop,runAudit:true}});
    };
    focus();
    window.addEventListener("focus",focus);return()=>{window.removeEventListener("focus",focus);if(timer)clearTimeout(timer);};
  },[check.mutate,returnKey]);
  const uploads=(status.data?.uploads??[]).filter(p=>p.designId===design.id);
  const canPublish=design.status!=="rejected";
  const designJobs=(jobs.data??[]).filter(j=>j.designId===design.id&&j.shop===status.data?.shop);
  const processing=designJobs.some(j=>["queued","running"].includes(j.status));
  const activeJob=designJobs.find(j=>j.id===pending?.id);
  function closeUpload(open:boolean){if(upload.isPending)return;setUploadOpen(open);if(!open){rememberPending(null);setProgressError(null);setUploadConfirm(false);upload.reset();}}
  function confirmUpload(){
    setProgressError(null);
    rememberPending({shop:status.data!.shop,designId:design.id});
    upload.mutate({data:{designId:design.id,expectedShop:status.data!.shop,confirmUnpublishedUpload:true,productMode:mode,
      productId:mode==="existing"?productId:undefined,confirmTemplateAssignment:mode!=="none"&&assign,confirmProductImport:importRights,confirmCurrencyMismatch:currencyConfirm}});
  }
  return <>
    {(uploads.length>0||designJobs.length>0)&&<section className="panel my-5 space-y-4 p-5" data-testid="publication-history">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-xl">Publication history</h2>
      <Btn data-testid="button-hide-publication-history" variant="outline" aria-expanded={!history.collapsed} onClick={()=>changeHistory({collapsed:!history.collapsed})}>{history.collapsed?<Eye className="h-4 w-4"/>:<EyeOff className="h-4 w-4"/>}{history.collapsed?"Show history":"Hide history"}</Btn>
    </div>
    {!history.collapsed&&<>
    {history.hidden.length>0&&<Btn variant="outline" data-testid="button-restore-publication-records" onClick={()=>changeHistory({hidden:[]})}>Show hidden records</Btn>}
    {jobs.error&&<Notice>Progress could not be refreshed. Saved jobs continue on the server; retrying the same upload will not create another theme.</Notice>}
    {designJobs.filter(j=>!history.hidden.includes(`job:${j.id}`)).slice(0,8).map(j=><div key={j.id} className="rounded border border-border p-3 text-xs" data-testid={`publishing-job-${j.id}`} aria-live="polite">
      <div className="flex items-center justify-between gap-3"><b>{j.kind==="upload"?"Theme upload":"Lighthouse"} · {j.status}</b><Btn variant="outline" aria-label={`Hide job ${j.id}`} onClick={()=>changeHistory({hidden:[...history.hidden,`job:${j.id}`]})}><EyeOff className="h-3 w-3"/>Hide</Btn></div>
      {j.kind==="upload"?uploadPhase(j.phase):j.phase}<br/>Job {j.id}
      {j.themeId&&<> · Theme {j.themeId}</>}
      {j.error&&<p className="mt-2">{j.error}</p>}
    </div>)}
    {uploads.filter(p=>!history.hidden.includes(`publication:${p.id}`)).map(p=><article key={p.id} className="rounded-lg border border-border p-3" data-testid={`cli-upload-${p.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm">{p.themeName??"CLI upload"}</b>
        <p className="mt-1 text-xs text-muted-foreground">Theme {p.themeId??"ID unavailable"} · {p.livePublished?"Live on Shopify":p.verified?"Verified · unpublished":"Not verified"} · {p.shop}</p></div>
        <div className="flex flex-wrap gap-2">{p.verified&&<Btn data-testid={`button-cli-check-${p.id}`} variant="outline" disabled={!ready||check.isPending||design.lighthouse?.status==="running"} onClick={()=>check.mutate({id:p.id,data:{expectedShop:p.shop!,runAudit:true}})}>{check.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:null}Check Shopify & run audit</Btn>}<Btn variant="outline" aria-label={`Hide publication ${p.themeName??p.id}`} onClick={()=>changeHistory({hidden:[...history.hidden,`publication:${p.id}`]})}><EyeOff className="h-3 w-3"/>Hide</Btn></div>
      </div>
      {p.error&&<Notice>{p.error}</Notice>}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">{p.previewUrl&&<a href={p.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Preview on Shopify<ExternalLink className="h-3 w-3"/></a>}{p.editorUrl&&<a href={p.editorUrl} onClick={()=>{returnCheck.current={id:p.id,shop:p.shop!};}} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Open theme editor<ExternalLink className="h-3 w-3"/></a>}</div>
      {p.productHandle&&<p className="mt-2 text-xs text-muted-foreground">Product: {p.productHandle} · {p.productStatus?.toLowerCase()} · {p.templateAssigned?"Template assignment verified":"Default template preview; global assignment unchanged"}</p>}
      {p.warnings?.map((warning,i)=><p key={i} className="mt-2 text-xs text-muted-foreground">{warning}</p>)}
      {p.checkedAt&&<p className="mt-2 text-xs text-muted-foreground">Shopify status checked {new Date(p.checkedAt).toLocaleString()}</p>}
    </article>)}
    </>}
    </section>}
    <Dialog open={uploadOpen||!!pending||!!progressError} onOpenChange={closeUpload}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{pending?"Publishing your design":progressError?"Upload needs attention":"Publish to Shopify"}</DialogTitle><DialogDescription>{pending?"Please wait. Shopify’s theme editor will open here automatically.":progressError?"Your existing store theme has not been replaced.":`Choose the product for ${status.data?.shop??"your connected store"}.`}</DialogDescription></DialogHeader>
      {pending?<div className="space-y-5 py-6 text-center" data-testid="publishing-progress" role="status" aria-live="polite">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-[hsl(var(--seal))]" aria-hidden="true"/>
        <p className="font-medium">{uploadPhase(activeJob?.phase)}</p>
        <p className="text-sm text-muted-foreground">Uploads can take a little longer for larger themes. You don’t need to return to another tab.</p>
        {(jobs.error||status.error)&&<Notice>Reconnecting to your saved upload. We’ll keep checking without starting another upload.</Notice>}
        <Btn variant="outline" disabled={upload.isPending} onClick={()=>closeUpload(false)}>Stay in Wishluck</Btn>
      </div>:progressError?<div className="space-y-4"><Notice>{progressError}</Notice><Btn variant="outline" onClick={()=>closeUpload(false)}>Close</Btn></div>:<>
      {status.error&&<Notice>{errMsg(status.error)}</Notice>}
      {status.data&&!ready&&<Notice>{status.data.message??"Your Shopify connection needs attention before publishing."}</Notice>}
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
        <Btn data-testid="button-cli-confirm-upload" disabled={!uploadConfirm||!ready||!canPublish||upload.isPending||processing||context.isLoading||!!context.error||(mode==="existing"&&!productId)||(mode==="import"&&(!importRights||(context.data?.sourceCurrency!==context.data?.currency&&!currencyConfirm)))} onClick={confirmUpload}>{upload.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:null}Publish & open Shopify</Btn></div>
      </>}
    </DialogContent></Dialog>
  </>;
}
