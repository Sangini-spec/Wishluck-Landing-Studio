import {createHash} from "node:crypto";
import type {Run} from "./domain";
function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}
export const legacyResearchKey=(run:Run)=>createHash("sha256").update(JSON.stringify({product:run.product,brand:run.brand})).digest("hex");
export const reviewedInputKey=(run:Run)=>createHash("sha256").update(JSON.stringify(canonical({product:run.product,brand:run.brand}))).digest("hex");
export const sameReviewedInputs=(run:Run)=>run.researchKey===reviewedInputKey(run)||run.researchKey===legacyResearchKey(run);
