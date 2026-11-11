import { z } from "zod";
import {createHash} from "node:crypto";

export function planChoice<T>(values:readonly T[],seed:string,attempt:number,axis:number):T{
  if(!values.length)throw new Error("No distinct design family remains available.");
  const value=createHash("sha256").update(`${seed}:${attempt}:${axis}`).digest().readUInt32BE(0);
  return values[value%values.length]!;
}

export const designFamilies=["atelier","kinetic","gallery","dossier","panorama","mosaic","catalogue","journal"] as const;
export const visualPlanSchema=z.object({
  family:z.enum(designFamilies),
  name:z.string().min(3).max(80),
  rationale:z.string().max(650),
  heroScale:z.enum(["monumental","balanced","compact"]),
  imageTreatment:z.enum(["cutout","framed","fullbleed","collage"]),
  colorStrategy:z.enum(["light","ink","brand","contrast"]),
  contentRhythm:z.enum(["spacious","dense","alternating"]),
  typography:z.enum(["display","editorial","technical"]),
  detailLayout:z.enum(["tiles","timeline","bento","split","columns"]),
  alignment:z.enum(["start","center"]),
  accentPlacement:z.enum(["edge","panel","rule"]),
  headingSize:z.number().int().min(30).max(80).optional(),
  sectionSpacing:z.number().int().min(12).max(100).multipleOf(2).optional(),
  sections:z.array(z.enum(["hero","story","benefits","specs","faq","reviews","gallery","purchase"])).min(4).max(8),
});
export type VisualPlan=z.infer<typeof visualPlanSchema>;
