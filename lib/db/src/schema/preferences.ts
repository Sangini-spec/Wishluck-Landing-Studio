import {pgTable,text,jsonb} from "drizzle-orm/pg-core";

// Non-secret workspace preferences only. Never store credentials here.
export const preferencesTable=pgTable("workspace_preferences",{
  key:text("key").primaryKey(),
  value:jsonb("value").$type<unknown>().notNull(),
});
