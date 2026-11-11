import {pgTable,text,jsonb,timestamp,uniqueIndex} from "drizzle-orm/pg-core";
import {createInsertSchema} from "drizzle-zod";
import {z} from "zod/v4";

// No cascading foreign key: retain idempotency receipts if history is cleared.
export const publishingJobsTable=pgTable("publishing_jobs",{
  id:text("id").primaryKey(),
  identity:text("identity").notNull(),
  status:text("status").notNull(),
  data:jsonb("data").$type<Record<string,unknown>>().notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex("publishing_job_identity_idx").on(t.identity)]);
export const insertPublishingJobSchema=createInsertSchema(publishingJobsTable);
export type PublishingJobRow=typeof publishingJobsTable.$inferSelect;
export type InsertPublishingJob=z.infer<typeof insertPublishingJobSchema>;
