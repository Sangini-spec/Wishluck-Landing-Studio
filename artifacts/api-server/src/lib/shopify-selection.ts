import {preference,setPreference} from "./preferences";
import {AppError} from "./domain";
import type {Connection} from "@workspace/api-zod";
import {db,preferencesTable} from "@workspace/db";

let selected="";
let busy=false;
export const selectedShopDomain=()=>selected;
export async function initialiseStoreSelection(){selected=await preference<string>("shopify:active")??"";}
export async function selectStore(store:Connection){
  const stores=await preference<Connection[]>("shopify:stores")??[];
  await db.transaction(async tx=>{
    for(const [key,value] of [["shopify:active",store.shop],["shopify:stores",[store,...stores.filter(s=>s.shop!==store.shop)].slice(0,30)]] as const){
      await tx.insert(preferencesTable).values({key,value}).onConflictDoUpdate({target:preferencesTable.key,set:{value}});
    }
  });
  selected=store.shop;
}
export async function rememberStore(store:Connection){
  const stores=await preference<Connection[]>("shopify:stores")??[];
  await setPreference("shopify:stores",[store,...stores.filter(s=>s.shop!==store.shop)].slice(0,30));
}
export async function savedStores(){
  const stores=await preference<Connection[]>("shopify:stores")??[];
  return stores.map(s=>({...s,connected:s.shop===(selected||process.env.SHOPIFY_SHOP_DOMAIN)}));
}
export async function withStoreLock<T>(work:()=>Promise<T>){
  if(busy)throw new AppError(409,"A store connection change or publication is in progress. Wait for it to finish.");
  busy=true;
  try{return await work();}finally{busy=false;}
}
