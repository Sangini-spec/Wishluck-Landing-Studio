import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const runsTable = pgTable("generation_runs", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  category: text("category").notNull().default("Uncategorised"),
  status: text("status").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, t => [index("runs_category_idx").on(t.category), index("runs_status_idx").on(t.status)]);
export const insertRunSchema = createInsertSchema(runsTable);
export type RunRecord = typeof runsTable.$inferSelect;
