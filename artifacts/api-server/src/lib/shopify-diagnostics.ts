import {AsyncLocalStorage} from "node:async_hooks";
import {AppError} from "./domain";
import {logger} from "./logger";

export type ShopifyDiagnostic={operation:string;shop:string;httpStatus:number;requestId:string|null;apiVersion:string|null;response:any};
const observer=new AsyncLocalStorage<(record:ShopifyDiagnostic)=>void>();
export const observeShopifyResponses=<T>(listener:(record:ShopifyDiagnostic)=>void,work:()=>Promise<T>)=>observer.run(listener,work);

export function redactShopifyResponse(value:unknown,protectedValues:string[]=[]):any{
  if(typeof value==="string"){
    let text=value;
    for(const secret of protectedValues.filter(v=>v.length>=4))text=text.split(secret).join("[REDACTED]");
    return text.replace(/https?:\/\/[^\s"'<>]+/g,url=>{
      try{const parsed=new URL(url);if(parsed.search||/shopifypreview|storage\.googleapis|amazonaws/.test(parsed.hostname))return `${parsed.origin}${parsed.pathname}?[REDACTED]`;return url;}catch{return "[REDACTED URL]";}
    });
  }
  if(Array.isArray(value))return value.map(item=>redactShopifyResponse(item,protectedValues));
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[
    key,/^(apiKey|access_token|refresh_token|client_secret|authorization|parameters|password|token|resourceUrl)$/i.test(key)?"[REDACTED]":redactShopifyResponse(item,protectedValues),
  ]));
  return value;
}
export function recordShopifyResponse(query:string,shop:string,response:Response,body:unknown,protectedValues:string[]){
  const operation=/\b(stagedUploadsCreate|themeCreate|themeFilesUpsert|currentAppInstallation|themes|theme)\b/.exec(query)?.[1]??"adminGraphql";
  const record:ShopifyDiagnostic={operation,shop,httpStatus:response.status,requestId:response.headers.get("x-request-id"),
    apiVersion:response.headers.get("x-shopify-api-version"),response:redactShopifyResponse(body,protectedValues)};
  if(operation!=="adminGraphql")logger.info({shopify:record},"Shopify GraphQL response (credentials and signed upload details redacted)");
  observer.getStore()?.(record);
  return record;
}
export class ShopifyApiError extends AppError{
  constructor(status:number,message:string,public diagnostic:ShopifyDiagnostic){super(status,message);}
}
