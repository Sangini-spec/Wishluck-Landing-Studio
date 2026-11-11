import {AppError} from "./domain";

export function storefrontPasswordKey(shop:string){
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))throw new AppError(400,"A canonical Shopify store is required.");
  return `SHOPIFY_STOREFRONT_PASSWORD_${shop.replace(".myshopify.com","").replaceAll("-","_").toUpperCase()}`;
}
export interface StorefrontCookie {name:string;value:string;domain:string;path:string;httpOnly:boolean;secure:boolean;sameSite:"Lax"}
export interface StorefrontAccess {
  origin:string;
  cookies:()=>StorefrontCookie[];
  request:(url:string,init?:RequestInit)=>Promise<Response>;
}
export async function storefrontAccess(shop:string,url:string,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch):Promise<StorefrontAccess>{
  const destination=new URL(url),canonical=`https://${shop}`;
  const key=storefrontPasswordKey(shop),password=env[key];
  const jar=new Map<string,string>();
  const sameStore=destination.origin===canonical;
  function receive(response:Response){
    for(const header of response.headers.getSetCookie()){
      const pair=header.split(";")[0],index=pair.indexOf("=");
      if(index>0)jar.set(pair.slice(0,index),pair.slice(index+1));
    }
  }
  async function request(target:string,init:RequestInit={}){
    let next=new URL(target);
    for(let redirects=0;redirects<6;redirects++){
      if(next.origin!==destination.origin||next.protocol!=="https:")throw new AppError(502,"Storefront redirected to a different origin. No authorization cookie was forwarded.");
      const headers=new Headers(init.headers);
      if(jar.size)headers.set("Cookie",[...jar].map(([name,value])=>`${name}=${value}`).join("; "));
      const response=await fetcher(next.href,{...init,headers,redirect:"manual",signal:AbortSignal.timeout(25000)});
      receive(response);
      if(![301,302,303,307,308].includes(response.status))return response;
      const location=response.headers.get("location");
      if(!location)throw new AppError(502,"Shopify returned a redirect without a location.");
      next=new URL(location,next);
      if([301,302,303].includes(response.status))init={method:"GET"};
    }
    throw new AppError(502,"Too many storefront redirects.");
  }
  if(password&&sameStore){
    // This is the storefront-viewing password, never the Theme Access token or
    // staff login. Do not follow redirects with the password body or log it.
    let response:Response;
    try{response=await fetcher(`${canonical}/password`,{method:"POST",redirect:"manual",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({form_type:"storefront_password",utf8:"✓",password}),signal:AbortSignal.timeout(25000)});}
    catch{throw new AppError(502,"The protected-storefront authorization request failed. No credentials were logged.");}
    receive(response);
    if(response.status>=400||!jar.size)throw new AppError(403,`Storefront authorization failed. Verify ${key}; it must contain the storefront viewing password, not a Shopify login or CLI password.`);
  }
  return {origin:destination.origin,request,cookies:()=>[...jar].map(([name,value])=>({name,value,domain:destination.hostname,path:"/",httpOnly:true,secure:true,sameSite:"Lax" as const}))};
}
