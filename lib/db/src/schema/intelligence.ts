import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { runsTable } from "./runs";

export const learningsTable = pgTable("competitor_learnings", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runsTable.id),
  category: text("category").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("learning_category_idx").on(t.category)]);

export const artifactsTable = pgTable("crawl_artifacts", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runsTable.id),
  sourceUrl: text("source_url").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
