/**
 * Explicit, opt-in live permission diagnostic. Never assigns products, publishes
 * a theme, or writes to any pre-existing theme. Reports contain redacted replies.
 */
import {mkdir,writeFile} from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import path from "node:path";
import JSZip from "jszip";
import {customAdmin,shopifyConfig} from "../src/lib/shopify-auth";
import {observeShopifyResponses,ShopifyApiError,type ShopifyDiagnostic} from "../src/lib/shopify-diagnostics";
import {db} from "@workspace/db";

const args=process.argv.slice(2);
const shop=args[args.indexOf("--shop")+1];
if(!args.includes("--shop")||!args.includes("--allow-unpublished-test")||!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop??"")){
  throw new Error("Required: --shop your-store.myshopify.com --allow-unpublished-test. This creates at most one new unpublished test theme.");
}
const records:ShopifyDiagnostic[]=[];
const steps:any[]=[];
const report:any={at:new Date().toISOString(),shop,apiVersion:process.env.SHOPIFY_API_VERSION||"2026-10",steps,responses:records,
  safety:"Only a newly created UNPUBLISHED theme may receive files. No product assignment, activation, theme publication or pre-existing theme write.",
  exemption:{required:true,approvalRecord:"Not exposed by Admin GraphQL. A denial cannot confirm whether a request was submitted or approved but not provisioned."},
  documentation:["https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/themeCreate","https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/themeFilesUpsert"]};
const request=(query:string,variables:Record<string,unknown>={})=>customAdmin(query,variables,0,shop);
const delay=()=>new Promise(resolve=>setTimeout(resolve,1500));
const snapshotQuery=`query{shop{name myshopifyDomain} themes(first:50){pageInfo{hasNextPage} nodes{id name role updatedAt files(filenames:["layout/theme.liquid"],first:1){nodes{filename checksumMd5}}}} products(first:50,query:"status:draft"){pageInfo{hasNextPage} nodes{id status handle templateSuffix}}}`;
async function attempt(operation:string,work:()=>Promise<any>){
  try{const value=await work();steps.push({operation,outcome:"returned",userErrors:value?.[operation]?.userErrors??[]});return value;}
  catch(error){steps.push({operation,outcome:"failed",message:error instanceof Error?error.message:"Request failed"});return null;}
}
async function diagnose(){
  // This script uses the application's existing installed-app adapter; it does
  // not collect credentials, alter scopes, install an app or change active store.
  if(!shopifyConfig().configured)throw new Error("The existing Shopify app is not configured.");
  const identity=await request("query{shop{name myshopifyDomain} currentAppInstallation{id app{id title apiKey requestedAccessScopes{handle}} accessScopes{handle}}}");
  const installation=identity.currentAppInstallation;
  report.identity={shop:identity.shop,installationId:installation.id,appId:installation.app.id,appTitle:installation.app.title,
    clientIdMatchesConfiguredApp:installation.app.apiKey===process.env.SHOPIFY_CLIENT_ID};
  if(identity.shop.myshopifyDomain!==shop||!report.identity.clientIdMatchesConfiguredApp)throw new Error("Store/app identity mismatch. No mutation attempted.");
  report.declaredScopes=installation.app.requestedAccessScopes.map((s:any)=>s.handle).sort();
  report.grantedScopes=installation.accessScopes.map((s:any)=>s.handle).sort();
  report.scopeSource="Declared scopes queried from the installed app's requestedAccessScopes; no local Shopify app TOML is present.";
  report.missingDeclaredScopes=report.declaredScopes.filter((scope:string)=>!report.grantedScopes.includes(scope));
  report.writeThemesGranted=report.grantedScopes.includes("write_themes");
  report.before=await request(snapshotQuery);
  if(report.before.themes.pageInfo.hasNextPage||report.before.products.pageInfo.hasNextPage)throw new Error("Safety snapshot needs pagination. No mutation attempted.");
  if(!report.writeThemesGranted){report.blocker="write_themes is not granted. Update the installed app's configuration and reauthorise before retrying.";return;}
  const id=randomUUID(),filename=`assets/wishluck-permission-${id}.css`,content=`/* Wishluck permission probe ${id}; no storefront assignment. */\n`;
  const zip=new JSZip();
  zip.file("layout/theme.liquid","<!doctype html><html><head>{{ content_for_header }}</head><body>{{ content_for_layout }}</body></html>");
  zip.file("templates/index.liquid","<main><h1>Wishluck isolated permission test</h1></main>");
  zip.file("config/settings_schema.json","[]");
  const bytes=await zip.generateAsync({type:"nodebuffer"});
  // FILE is a real enum value in 2026-10; there is no THEME resource enum.
  // Staging is diagnostic only: normal publishing uses inline themeFilesUpsert.
  const staged=await attempt("stagedUploadsCreate",()=>request("mutation($input:[StagedUploadInput!]!){stagedUploadsCreate(input:$input){stagedTargets{url resourceUrl parameters{name value}} userErrors{field message}}}",
    {input:[{filename:`wishluck-permission-${id}.zip`,mimeType:"application/zip",resource:"FILE",httpMethod:"POST",fileSize:String(bytes.length)}]}));
  let source:string|undefined;
  const target=staged?.stagedUploadsCreate?.stagedTargets?.[0];
  if(target&&!staged.stagedUploadsCreate.userErrors.length){
    const form=new FormData();
    for(const parameter of target.parameters)form.append(parameter.name,parameter.value);
    form.append("file",new Blob([new Uint8Array(bytes)],{type:"application/zip"}),`wishluck-permission-${id}.zip`);
    const upload=await fetch(target.url,{method:"POST",body:form,signal:AbortSignal.timeout(30000)});
    steps.push({operation:"stagedBinaryUpload",httpStatus:upload.status,outcome:upload.ok?"uploaded":"failed"});
    if(upload.ok)source=target.resourceUrl;
  }
  if(!source){
    // Public, official installable ZIP; no broader file scope is requested merely
    // to work around a staging failure in a path the publisher does not use.
    const release=await fetch("https://api.github.com/repos/Shopify/dawn/releases/latest",{signal:AbortSignal.timeout(15000)});
    if(!release.ok)throw new Error("Cannot obtain an official test theme ZIP; no themeCreate attempted.");
    const metadata=await release.json() as any;
    source=metadata.assets?.find((asset:any)=>/^Dawn-.*\.zip$/.test(asset.name))?.browser_download_url;
    if(!source)throw new Error("Official Dawn release contains no installable theme ZIP.");
    report.testThemeSource=source;
  }
  const created=await attempt("themeCreate",()=>request("mutation($source:URL!,$name:String!){themeCreate(source:$source,name:$name,role:UNPUBLISHED){theme{id name role processing processingFailed} userErrors{code field message}}}",{source,name:`Wishluck permission test ${id.slice(0,8)}`}));
  let theme=created?.themeCreate?.theme;
  if(theme){
    report.createdTestTheme={id:theme.id,name:theme.name,role:theme.role};
    for(let i=0;i<30&&theme.processing;i++){await delay();theme=(await request("query($id:ID!){theme(id:$id){id name role processing processingFailed}}",{id:theme.id})).theme;}
    if(!theme||theme.processing||theme.processingFailed||theme.role!=="UNPUBLISHED")throw new Error("New test theme is not ready and unpublished; no file write attempted.");
  }
  // A blocked creation must never fall back to writing Horizon, the live theme,
  // or another existing draft. ID zero is a verified nonexistent target and can
  // only test field-level authorisation, not establish upload/readback success.
  const themeId=theme?.id??"gid://shopify/OnlineStoreTheme/0";
  let check:any;
  try{check=await request("query($id:ID!,$names:[String!]!){theme(id:$id){id role files(filenames:$names,first:1){nodes{filename checksumMd5}}}}",{id:themeId,names:[filename]});}
  catch(error){
    if(!theme&&error instanceof ShopifyApiError&&error.diagnostic.response.errors?.every((item:any)=>item.extensions?.code==="NOT_FOUND"&&item.path?.[0]==="theme"))check={theme:null};
    else throw error;
  }
  if(!theme&&check.theme)throw new Error("Nonexistent-target guard failed. No file write attempted.");
  if(theme&&(check.theme?.role!=="UNPUBLISHED"||check.theme.files.nodes.length))throw new Error("Destination role or filename changed. No file write attempted.");
  report.fileProbe={themeId,nonexistentTarget:!theme,filename,actualUploadVerified:false};
  const written=await attempt("themeFilesUpsert",()=>request("mutation($id:ID!,$files:[OnlineStoreThemeFilesUpsertFileInput!]!){themeFilesUpsert(themeId:$id,files:$files){job{id done} upsertedThemeFiles{filename} userErrors{code field message}}}",
    {id:themeId,files:[{filename,body:{type:"TEXT",value:content}}]}));
  if(theme&&written?.themeFilesUpsert&&!written.themeFilesUpsert.userErrors.length){
    let job=written.themeFilesUpsert.job;
    for(let i=0;i<20&&job&&!job.done;i++){await delay();const polled=await request("query($id:ID!){job(id:$id){id done}}",{id:job.id});if(!polled.job)throw new Error("Upload job disappeared; success is unverified.");job=polled.job;}
    const readback=await request("query($id:ID!,$names:[String!]!){theme(id:$id){role files(filenames:$names,first:1){nodes{filename checksumMd5}}}}",{id:themeId,names:[filename]});
    report.fileProbe.actualUploadVerified=(!job||job.done)&&readback.theme?.role==="UNPUBLISHED"&&readback.theme.files.nodes.some((file:any)=>file.filename===filename&&file.checksumMd5===createHash("md5").update(content).digest("hex"));
  }
  report.exemption.effectiveForTest=report.fileProbe.actualUploadVerified;
  const denials=records.filter(record=>["themeCreate","themeFilesUpsert"].includes(record.operation)&&record.response.errors?.some((error:any)=>error.extensions?.code==="ACCESS_DENIED"));
  report.blocker=report.fileProbe.actualUploadVerified?null:denials.length?"Shopify-side theme API approval/provisioning dependency: write_themes is granted but theme mutations are denied. Adding the same scope again will not fix this.":"Upload and checksum readback did not both succeed; inspect the recorded operations.";
}
async function main(){
  await observeShopifyResponses(record=>records.push(record),async()=>{
    try{await diagnose();}
    catch(error){report.failure=error instanceof Error?error.message:"Diagnostic failed";}
    finally{
      if(report.before){
        try{
          report.after=await request(snapshotQuery);
          const oldIds=new Set(report.before.themes.nodes.map((theme:any)=>theme.id));
          report.existingThemesUnchanged=JSON.stringify(report.before.themes.nodes)===JSON.stringify(report.after.themes.nodes.filter((theme:any)=>oldIds.has(theme.id)));
          report.existingDraftUnchanged=JSON.stringify(report.before.products.nodes)===JSON.stringify(report.after.products.nodes);
        }catch(error){report.safetyVerificationError=error instanceof Error?error.message:"Post-test verification failed";}
      }
    }
  });
  const output=path.resolve(import.meta.dirname,"../../../generated-artifacts/shopify-publishing-diagnostic");
  await mkdir(output,{recursive:true});
  const json=JSON.stringify(report,null,2);
  await writeFile(path.join(output,"report.json"),json);
  const escaped=json.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  await writeFile(path.join(output,"report.html"),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shopify publishing permission diagnostic</title><style>body{max-width:1100px;margin:40px auto;padding:0 20px;font:16px system-ui;color:#222}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:20px;border-radius:8px;font:12px/1.6 monospace}</style><h1>Shopify publishing permission diagnostic</h1><p>Live API evidence, with credentials and temporary upload credentials removed. A nonexistent-theme probe is not a successful upload.</p><pre>${escaped}</pre></html>`);
  console.log(JSON.stringify({reportDirectory:output,identity:report.identity,declared:report.declaredScopes,granted:report.grantedScopes,
    blocker:report.blocker,fileProbe:report.fileProbe,createdTestTheme:report.createdTestTheme,existingThemesUnchanged:report.existingThemesUnchanged,existingDraftUnchanged:report.existingDraftUnchanged,failure:report.failure},null,2));
  await db.$client.end();
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Diagnostic failed");process.exitCode=1;});
