import { z } from "zod";
import { GetRunResponse, PublishDesignResponse } from "@workspace/api-zod";

export type Run = z.infer<typeof GetRunResponse>;
export type Product = NonNullable<Run["product"]>;
export type Brand = NonNullable<Run["brand"]>;
export type Design = Run["designs"][number];
export type Competitor = Run["competitors"][number];
export type Learning = Run["learnings"][number];
export type Check = Design["checks"][number];
export type Publication = z.infer<typeof PublishDesignResponse>;
export interface DesignContent {
  headline: string;
  subheading: string;
  story: string;
  benefits: { title: string; text: string }[];
  faqs: { question: string; answer: string }[];
  specs: Record<string, string>;
  sections: string[];
  composition: string;
  imagePosition: string;
  colorUse: string;
  ctaPlacement: string;
  learningIds: string[];
  generationMode: "ai" | "source-only";
  productSnapshot?: Product;
  brandSnapshot?: Brand;
}
export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
