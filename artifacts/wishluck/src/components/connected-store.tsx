import {useState} from "react";
import {useMutation,useQueryClient} from "@tanstack/react-query";
import {Store,Plus,Loader2,ArrowRightLeft} from "lucide-react";
import {useGetShopifyStatus,useListShopifyStores,switchShopifyStore,getGetShopifyStatusQueryKey} from "@workspace/api-client-react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {errMsg} from "@/lib/run-utils";

export function ConnectedStore(){
  const [open,setOpen]=useState(false),[shop,setShop]=useState("");
  const client=useQueryClient();
  const status=useGetShopifyStatus({query:{staleTime:15000,refetchInterval:60000}});
  const stores=useListShopifyStores({query:{enabled:open,staleTime:0}});
  const mutation=useMutation({mutationFn:(domain:string)=>switchShopifyStore({shop:domain.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"")}),onSuccess:async connection=>{
    await client.cancelQueries();
    client.setQueryData(getGetShopifyStatusQueryKey(),connection);
    await client.invalidateQueries();
    setOpen(false);setShop("");
  }});
  const current=status.data;
  const connected=!!current?.connected;
  return <div className="mx-1 mt-4 border-t border-sidebar-border pt-4">
    <div className="px-2">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground"><Store className="h-3.5 w-3.5"/>Shopify store<span className={`ml-auto h-1.5 w-1.5 rounded-full ${connected?"bg-[hsl(var(--jade))]":"bg-muted-foreground/40"}`}/></div>
      {status.isLoading?<p className="text-xs text-muted-foreground">Checking connection…</p>:<>
        <p className="truncate text-[13px] font-medium" title={current?.name}>{connected?(current?.name||"Connected Shopify store"):"Not connected"}</p>
        {current?.shop&&<p className="mt-1 break-all font-mono text-[10.5px] text-muted-foreground" data-testid="connected-shop-domain">{current.shop}</p>}
        {connected&&current.primaryDomain&&current.primaryDomain!==`https://${current.shop}`&&<p className="mt-1 break-all text-[11px] text-muted-foreground">{current.primaryDomain.replace(/^https?:\/\//,"")}</p>}
        {(status.error||(!connected&&current?.message))&&<p className="mt-2 text-[11px] text-muted-foreground">{status.error?errMsg(status.error):current?.message}</p>}
      </>}
      <button onClick={()=>{mutation.reset();setOpen(true);}} className="mt-3 flex items-center gap-1.5 rounded-md py-1.5 text-[12px] text-foreground/75 hover:text-foreground"><Plus className="h-3.5 w-3.5"/>{connected?"Connect another store":"Connect a store"}</button>
    </div>
    <Dialog open={open} onOpenChange={value=>{if(!mutation.isPending)setOpen(value);}}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Connect a Shopify store</DialogTitle><DialogDescription>Connect a store using the Shopify app already configured for this workspace. The app must be installed in that store under the same Shopify organisation. Different app credentials require a separate secure setup.</DialogDescription></DialogHeader>
        {current?.shop&&<div className="rounded-md border border-border bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Current store</span><p className="mt-1 break-all font-medium">{current.shop}</p></div>}
        {!!stores.data?.length&&<div className="space-y-2"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Previously connected</p>{stores.data.map(store=><button key={store.shop} disabled={mutation.isPending||store.shop===current?.shop&&connected} onClick={()=>mutation.mutate(store.shop)} className="flex w-full items-center justify-between gap-3 rounded-md border border-border p-3 text-left hover:bg-muted disabled:opacity-60"><span className="min-w-0"><span className="block truncate text-sm">{store.name||store.shop}</span><span className="block break-all font-mono text-[11px] text-muted-foreground">{store.shop}</span></span>{store.shop===current?.shop&&connected?<span className="text-xs text-muted-foreground">Current</span>:<ArrowRightLeft className="h-4 w-4 shrink-0"/>}</button>)}</div>}
        <form onSubmit={e=>{e.preventDefault();mutation.mutate(shop);}} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="shop-domain">Shopify store domain</label>
          <input id="shop-domain" value={shop} disabled={mutation.isPending} onChange={e=>setShop(e.target.value)} placeholder="your-store.myshopify.com" autoCapitalize="none" autoCorrect="off" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"/>
          <p className="text-xs text-muted-foreground">Access is verified before switching. A failed connection leaves your current store unchanged. Existing runs and designs are kept.</p>
          {mutation.error&&<p role="alert" className="text-sm text-destructive">{errMsg(mutation.error)} Your current store was not changed.</p>}
          <button type="submit" disabled={!shop.trim()||mutation.isPending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{mutation.isPending?<><Loader2 className="h-4 w-4 animate-spin"/>Verifying store…</>:"Verify and connect"}</button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
