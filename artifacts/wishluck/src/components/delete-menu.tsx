import {useState} from "react";
import {useMutation,useQueryClient} from "@tanstack/react-query";
import {MoreHorizontal,Trash2,Loader2} from "lucide-react";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from "@/components/ui/dropdown-menu";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {useToast} from "@/hooks/use-toast";
import {errMsg} from "@/lib/run-utils";

export function DeleteMenu({label,title,description,onDelete,disabled=false}:{
  label:string;title:string;description:string;onDelete:()=>Promise<unknown>;disabled?:boolean;
}){
  const [open,setOpen]=useState(false);
  const client=useQueryClient();
  const {toast}=useToast();
  const mutation=useMutation({mutationFn:onDelete,onSuccess:async()=>{
    setOpen(false);
    await client.invalidateQueries();
    toast({title:"Deleted",description:title});
  }});
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button aria-label={`More options for ${label}`} disabled={disabled||mutation.isPending} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"><MoreHorizontal className="h-4 w-4"/></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={()=>{mutation.reset();setOpen(true);}}><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={open} onOpenChange={value=>{if(!mutation.isPending)setOpen(value);}}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        {mutation.error&&<p role="alert" className="text-sm text-destructive">{errMsg(mutation.error)}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <button disabled={mutation.isPending} onClick={()=>mutation.mutate()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground disabled:opacity-50">{mutation.isPending&&<Loader2 className="h-4 w-4 animate-spin"/>}{mutation.isPending?"Deleting…":"Delete permanently"}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
