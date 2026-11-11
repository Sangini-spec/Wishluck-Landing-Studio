/** Scan reachable exported history without printing credential values. */
import {execFileSync} from "node:child_process";
const git=(...args)=>execFileSync("git",args,{maxBuffer:128*1024*1024}).toString();
const objects=git("rev-list","--objects","main").trim().split("\n").map(l=>{const p=l.indexOf(" ");return{id:p<0?l:l.slice(0,p),path:p<0?"":l.slice(p+1)};});
const forbidden=/^(?:\.agents\/|docs\/source\/|attached_assets\/|generated-artifacts\/|\.local\/|\.cache\/|replit\.md$)/;
const patterns=[
  /\bshp(?:at|ca|pa|tka)_[A-Za-z0-9]{24,}\b/,
  /\btvly-(?:dev|prod)-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[A-Za-z0-9_-]{30,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:[?&]|&amp;)preview_key=[A-Za-z0-9_-]{16,}/,
];
const bad=new Set();let blobs=0;
for(const o of objects){
  if(!o.path)continue;
  if(forbidden.test(o.path)||(/(^|\/)\.env(?:\.|$)/.test(o.path)&&!o.path.endsWith(".env.example"))){bad.add(o.path);continue;}
  if(/\.(jpg|jpeg|png|gif|webp|ico|woff2?|ttf|mp4|zip|pdf|docx)$/i.test(o.path))continue;
  if(git("cat-file","-t",o.id).trim()!=="blob")continue;
  const text=git("cat-file","blob",o.id);blobs++;
  if(patterns.some(p=>p.test(text)))bad.add(o.path);
}
if(bad.size){console.error("Public-export scan stopped. Review these paths (values withheld):\n"+[...bad].sort().join("\n"));process.exit(1);}
console.log(`Public-export history scan passed: ${blobs} text blobs; no forbidden paths or credential signatures detected.`);
