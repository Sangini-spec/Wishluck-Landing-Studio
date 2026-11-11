import {useState,useEffect} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {ExternalLink,Loader2,Upload,AlertTriangle} from "lucide-react";
import {useGetCliPublishingStatus,useUploadCliTheme,useActivateCliTheme,type Design,type Publication} from "@workspace/api-client-react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Btn,Notice} from "@/components/bits";
import {useToast} from "@/hooks/use-toast";
import {errMsg} from "@/lib/run-utils";

export function CliPublishing({design}:{design:Design}){
  const qc=useQueryClient(),{toast}=useToast();
  const status=useGetCliPublishingStatus({query:{staleTime:30000}});
  const [uploadOpen,setUploadOpen]=useState(false),[uploadConfirm,setUploadConfirm]=useState(false);
  const [activation,setActivation]=useState<Publication|null>(null),[liveConfirm,setLiveConfirm]=useState(false);
  const upload=useUploadCliTheme({mutation:{
    onSuccess:async p=>{await qc.invalidateQueries();if(p.status==="failed"){toast({title:"Theme upload incomplete",description:p.error,variant:"destructive"});return;}setUploadOpen(false);setUploadConfirm(false);toast({title:"Unpublished theme uploaded and verified",description:p.themeName});},
  }});
  const activate=useActivateCliTheme({mutation:{
    onSuccess:async()=>{await qc.invalidateQueries();setActivation(null);setLiveConfirm(false);toast({title:"Shopify live theme changed"});},
  }});
  const ready=!!status.data?.authenticated;
  useEffect(()=>{setLiveConfirm(false);},[status.data?.currentLiveThemeId,status.data?.shop]);
  useEffect(()=>{setActivation(null);setUploadOpen(false);setUploadConfirm(false);},[status.data?.shop]);
  const uploads=(status.data?.uploads??[]).filter(p=>p.designId===design.id);
  const approved=["approved","published"].includes(design.status);
  function closeUpload(open:boolean){if(upload.isPending)return;setUploadOpen(open);if(!open){setUploadConfirm(false);upload.reset();}}
  function closeActivation(open:boolean){if(activate.isPending)return;if(!open){setActivation(null);setLiveConfirm(false);activate.reset();}}
  return <section className="panel my-5 space-y-4 p-5" data-testid="cli-publishing">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-display text-xl">Theme Access publishing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upload a new, unpublished theme using Shopify CLI. Existing themes and products stay unchanged.</p></div>
      <Btn data-testid="button-cli-upload" variant="seal" disabled={!ready||design.status==="rejected"||status.isFetching} onClick={()=>setUploadOpen(true)}><Upload className="h-4 w-4"/>Upload preview theme</Btn>
    </div>
    {status.isLoading?<p className="text-sm text-muted-foreground">Checking store-specific Theme Access…</p>:status.error?<Notice>{errMsg(status.error)}</Notice>:
      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{status.data?.shop}</span> · {ready?"Theme Access authenticated":status.data?.configured?"Authentication failed":"Theme Access password not configured"}</p>}
    {status.data&&!ready&&<Notice>{status.data.message??`Add ${status.data.credentialKey} through project Secrets. This credential is specific to this store.`}</Notice>}
    <p className="text-xs text-muted-foreground">A theme upload does not import products. In the editor, select the matching store product for the homepage or preview a product page. Making a theme live is a separate action that replaces the storefront for all visitors.</p>
    {uploads.map(p=><article key={p.id} className="rounded-lg border border-border p-3" data-testid={`cli-upload-${p.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm">{p.themeName??"CLI upload"}</b>
        <p className="mt-1 text-xs text-muted-foreground">Theme {p.themeId??"not created"} · {p.livePublished?"Live":p.verified?"Verified · unpublished":"Not verified"} · {p.shop}</p></div>
        {p.verified&&!p.livePublished&&<Btn data-testid={`button-cli-make-live-${p.id}`} variant="outline" disabled={!ready||!approved||!status.data?.livePublishingEnabled} onClick={()=>{setActivation(p);setLiveConfirm(false);void status.refetch();}}>Make live…</Btn>}
      </div>
      {p.error&&<Notice>{p.error}</Notice>}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">{p.previewUrl&&<a href={p.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Preview on Shopify<ExternalLink className="h-3 w-3"/></a>}{p.editorUrl&&<a href={p.editorUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Open theme editor<ExternalLink className="h-3 w-3"/></a>}</div>
      {!approved&&p.verified&&!p.livePublished&&<p className="mt-2 text-xs text-muted-foreground">Approve this design before making its theme live.</p>}
      {!status.data?.livePublishingEnabled&&p.verified&&!p.livePublished&&<p className="mt-2 text-xs text-muted-foreground">Live replacement is disabled by default. The owner must enable it in server configuration; a separate exact-store/theme confirmation is still required.</p>}
    </article>)}
    <Dialog open={uploadOpen} onOpenChange={closeUpload}><DialogContent><DialogHeader><DialogTitle>Create an unpublished preview theme?</DialogTitle><DialogDescription>Shopify CLI will upload the complete design as a separate theme in {status.data?.shop}. It will not activate the theme or change any products.</DialogDescription></DialogHeader>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={uploadConfirm} onChange={e=>setUploadConfirm(e.target.checked)} disabled={upload.isPending} data-testid="checkbox-cli-upload"/><span>Create a new unpublished theme in this store. Keep the current live theme unchanged.</span></label>
      {upload.error&&<Notice>{errMsg(upload.error)}</Notice>}
      {upload.data?.status==="failed"&&<Notice>{upload.data.error}</Notice>}
      <div className="flex justify-end gap-2"><Btn variant="outline" disabled={upload.isPending} onClick={()=>closeUpload(false)}>Cancel</Btn>
        <Btn data-testid="button-cli-confirm-upload" disabled={!uploadConfirm||!ready||upload.isPending} onClick={()=>upload.mutate({data:{designId:design.id,expectedShop:status.data!.shop,confirmUnpublishedUpload:true}})}>{upload.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:null}Upload unpublished theme</Btn></div>
    </DialogContent></Dialog>
    <Dialog open={!!activation} onOpenChange={closeActivation}><DialogContent><DialogHeader><DialogTitle>Replace your live storefront theme?</DialogTitle><DialogDescription>This changes the theme seen by every visitor to {status.data?.shop}. The previous live theme stays in the theme library, but your storefront layout and theme settings will change.</DialogDescription></DialogHeader>
      <Notice icon={<AlertTriangle className="h-4 w-4"/>}>New live theme: {activation?.themeName} ({activation?.themeId}). Current live theme ID: {status.data?.currentLiveThemeId??"checking…"}. Review the Shopify preview before continuing. Products remain in their existing publication states.</Notice>
      <label className="flex items-start gap-2 text-sm"><input data-testid="checkbox-cli-live" type="checkbox" checked={liveConfirm} disabled={activate.isPending} onChange={e=>setLiveConfirm(e.target.checked)}/><span>I explicitly authorize replacing the live theme for this store with the theme shown above.</span></label>
      {activate.error&&<Notice>{errMsg(activate.error)}</Notice>}
      <div className="flex justify-end gap-2"><Btn variant="outline" disabled={activate.isPending} onClick={()=>closeActivation(false)}>Cancel</Btn>
        <Btn variant="seal" data-testid="button-cli-confirm-live" disabled={!liveConfirm||!ready||!approved||!status.data?.livePublishingEnabled||status.isFetching||!status.data?.currentLiveThemeId||activate.isPending} onClick={()=>activate.mutate({id:activation!.id,data:{themeId:activation!.themeId!,expectedShop:status.data!.shop,expectedLiveThemeId:status.data!.currentLiveThemeId!,confirmReplaceLiveTheme:true}})}>{activate.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:null}Replace live theme</Btn></div>
    </DialogContent></Dialog>
  </section>;
}
