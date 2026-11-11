import {z} from "zod";

export const contentKinds=["story","benefits","specs","faq","reviews","gallery","purchase"] as const;
export const surfaces=["paper","ink","brand","muted"] as const;
export const compositionSchema=z.object({
  hero:z.object({
    layout:z.enum(["split","stack","offset","rail","showcase"]),
    mediaSide:z.enum(["left","right"]),
    mediaShare:z.number().int().min(35).max(70).multipleOf(5),
    imageRatio:z.enum(["square","portrait","landscape"]),
    imageCount:z.number().int().min(1).max(4),
    surface:z.enum(surfaces),
    alignment:z.enum(["start","center"]),
    contentWidth:z.enum(["compact","balanced","wide"]),
  }),
  sections:z.array(z.object({
    kind:z.enum(contentKinds),
    layout:z.enum(["stack","split","grid","feature","alternating","band"]),
    surface:z.enum(surfaces),
    headingPlacement:z.enum(["above","beside","center"]),
    columns:z.number().int().min(1).max(4),
    width:z.enum(["full","contained","narrow"]),
    spacing:z.number().int().min(24).max(100).multipleOf(2),
    title:z.string().min(2).max(65),
  })).min(3).max(7),
});
export const creativePlanSchema=z.object({
  name:z.string().min(3).max(80),rationale:z.string().max(650),
  typography:z.enum(["display","editorial","technical"]),
  imageTreatment:z.enum(["cutout","framed","fullbleed","collage"]),
  headingSize:z.number().int().min(30).max(80),
  sectionSpacing:z.number().int().min(12).max(100).multipleOf(2),
  composition:compositionSchema,
});
export type Composition=z.infer<typeof compositionSchema>;
export type CreativePlan=z.infer<typeof creativePlanSchema>;
