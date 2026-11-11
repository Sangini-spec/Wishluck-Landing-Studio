import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { runsTable } from "./runs";

export const designsTable = pgTable("generated_designs", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runsTable.id),
  category: text("category").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("design_category_idx").on(t.category), index("design_run_idx").on(t.runId)]);
export const insertDesignSchema = createInsertSchema(designsTable);
export type DesignRecord = typeof designsTable.$inferSelect;

export const feedbackTable = pgTable("design_feedback", {
  id: text("id").primaryKey(),
  designId: text("design_id").notNull().references(() => designsTable.id),
  category: text("category").notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("feedback_category_idx").on(t.category)]);
