import { AppError } from "./domain";
import {selectedShopDomain} from "./shopify-selection";

// The assignment explicitly supplies an existing, merchant-owned custom app.
// This adapter does not create a store or collect credentials from the browser.
const cached=new Map<string,{token:string;expiresAt:number}>();
const refreshing=new Map<string,Promise<string>>();
export function shopifyConfig(){
  const missing=["SHOPIFY_CLIENT_ID","SHOPIFY_CLIENT_SECRET"].filter(key=>!process.env[key]);
  const shop=selectedShopDomain()||process.env.SHOPIFY_SHOP_DOMAIN||"";
  if(!shop)missing.push("SHOPIFY_SHOP_DOMAIN");
  if(shop&&!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop))throw new AppError(400,"SHOPIFY_SHOP_DOMAIN must be a myshopify.com hostname without protocol or path.");
  return {configured:missing.length===0,missing,shop};
}
export async function accessToken(force=false,shop=shopifyConfig().shop):Promise<string>{
  const config=shopifyConfig();
  if(!config.configured)throw new AppError(503,`Shopify connection needs: ${config.missing.join(", ")}. Add them through project Secrets.`);
  const saved=cached.get(shop);
  if(!force&&saved&&saved.expiresAt>Date.now()+60000)return saved.token;
  const pending=refreshing.get(shop);
  if(pending)return pending;
  const renewal=(async()=>{
    const response=await fetch(`https://${shop}/admin/oauth/access_token`,{
      method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({grant_type:"client_credentials",client_id:process.env.SHOPIFY_CLIENT_ID!,client_secret:process.env.SHOPIFY_CLIENT_SECRET!}),
      signal:AbortSignal.timeout(20000),
    });
    if(!response.ok)throw new AppError(503,`Shopify authentication failed (HTTP ${response.status}). Confirm the custom app is installed, the credentials are correct, and app and store belong to the same Shopify organisation.`);
    const result=await response.json() as {access_token?:string;expires_in?:number};
    if(!result.access_token)throw new AppError(502,"Shopify did not return an access token.");
    cached.set(shop,{token:result.access_token,expiresAt:Date.now()+Math.max(60,result.expires_in??86399)*1000});
    return result.access_token;
  })();
  refreshing.set(shop,renewal);
  try{return await renewal;}finally{refreshing.delete(shop);}
}
export async function customAdmin(query:string,variables:Record<string,unknown>={},attempt=0,shop=shopifyConfig().shop):Promise<any>{
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop))throw new AppError(400,"Enter a valid myshopify.com store domain.");
  const version=process.env.SHOPIFY_API_VERSION||"2026-10";
  if(!/^\d{4}-(01|04|07|10)$/.test(version))throw new AppError(400,"SHOPIFY_API_VERSION must be a supported YYYY-MM version.");
  const token=await accessToken(attempt===1,shop);
  const response=await fetch(`https://${shop}/admin/api/${version}/graphql.json`,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":token},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(30000)});
  if(response.status===401&&attempt===0)return customAdmin(query,variables,1,shop);
  if(!response.ok)throw new AppError(response.status===403?403:502,`Shopify Admin API returned HTTP ${response.status}. Verify the app scopes and theme-file write exemption.`);
  const data=await response.json() as {data?:unknown;errors?:{message:string;extensions?:{code?:string}}[];extensions?:{cost?:{throttleStatus?:{currentlyAvailable:number;restoreRate:number}}}};
  if(data.errors?.length){
    if(data.errors.some(e=>e.extensions?.code==="THROTTLED")&&attempt<2){await new Promise(r=>setTimeout(r,1500));return customAdmin(query,variables,attempt+1,shop);}
    throw new AppError(422,data.errors.map(e=>e.message).join("; "));
  }
  const throttle=data.extensions?.cost?.throttleStatus;
  if(throttle&&throttle.currentlyAvailable<100&&throttle.restoreRate>0)await new Promise(r=>setTimeout(r,Math.min(3000,1000*100/throttle.restoreRate)));
  return data.data;
}
