import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { designsTable } from "./designs";

export const publicationsTable = pgTable("publishing_history", {
  id: text("id").primaryKey(),
  designId: text("design_id").notNull().references(() => designsTable.id),
  status: text("status").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("publication_design_idx").on(t.designId)]);
