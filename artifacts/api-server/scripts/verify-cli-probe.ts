// Read back an explicitly captured test upload; no live-theme commands.
import {readFile,writeFile,rm,mkdir,mkdtemp} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {randomUUID} from "node:crypto";
import {cliThemes,runThemeCli,parseCliTheme,verifyCliFiles} from "../src/lib/shopify-cli";
import {standaloneTheme} from "../src/lib/theme-package";
import {compile,rootDir} from "../src/lib/compiler";
import {getDesign,savePublication} from "../src/lib/store";
import {db} from "@workspace/db";

async function main(){
  const args=process.argv.slice(2),designId=args[args.indexOf("--design")+1];
  if(!args.includes("--design")||!args.includes("--confirm-owned-test-theme"))throw new Error("Required: --design UUID --confirm-owned-test-theme");
  const file=path.join(rootDir,"generated-artifacts/shopify-cli/live-probe.json");
  const p=JSON.parse(await readFile(file,"utf8"));
  const {design,content,run}=await getDesign(designId);
  if(!run.product||!run.brand)throw new Error("Missing source data.");
  const files=standaloneTheme(compile(design,content,run.product,run.brand));
  const temporary=await mkdtemp(path.join(tmpdir(),"wishluck-cli-probe-"));
  const source=path.join(temporary,"theme");
  for(const [name,body]of Object.entries(files)){await mkdir(path.dirname(path.join(source,name)),{recursive:true});await writeFile(path.join(source,name),body);}
  const before=await cliThemes(p.shop),old=before.find((theme:any)=>theme.id===p.theme.id);
  if(old?.role!=="unpublished"||old.name!==p.theme.name||!old.name.startsWith("Wishluck CLI preview "))throw new Error("Owned test-theme guard failed.");
  const result=args.includes("--readback-only")?{theme:{...p.theme,storeDomain:p.shop}}:await runThemeCli(p.shop,["push","--theme",p.theme.id,"--nodelete","--path",source,"--strict","--json"]);
  const theme=parseCliTheme(result.theme,p.shop);
  p.theme={...p.theme,...theme};
  await writeFile(file,JSON.stringify(p,null,2));
  const readback=path.join(temporary,"readback");
  await verifyCliFiles(p.shop,theme.id,files,readback);
  const after=await cliThemes(p.shop);
  p.verified=true;p.fileCount=Object.keys(files).length;
  p.originalLiveThemeUnchanged=before.filter((t:any)=>t.role==="live").every((t:any)=>after.some((v:any)=>v.id===t.id&&v.role===t.role));
  p.publicationId=p.publicationId??randomUUID();
  await writeFile(file,JSON.stringify(p,null,2));
  await savePublication({id:p.publicationId,designId,title:run.product.title,status:"published",createdAt:p.at,shop:p.shop,
    themeId:theme.id,themeName:theme.name,editorUrl:theme.editorUrl,previewUrl:theme.previewUrl,method:"theme-access-cli",
    verified:true,livePublished:false,previousLiveThemeId:before.find((t:any)=>t.role==="live")?.id,
    warnings:["Verified CLI upload to a new unpublished theme. No products were imported, activated or reassigned."]});
  console.log(JSON.stringify({verified:true,theme:p.theme,fileCount:p.fileCount,publicationId:p.publicationId,originalLiveThemeUnchanged:p.originalLiveThemeUnchanged},null,2));
  await rm(temporary,{recursive:true,force:true});
  await db.$client.end();
}
main().catch(error=>{console.error(error instanceof Error?error.message:"CLI verification failed");process.exit(1);});
