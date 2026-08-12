import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export type SiteState = Record<string, unknown>

export const appState = pgTable("app_state", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<SiteState>().notNull().default({}),
  version: bigint("version", { mode: "number" }).notNull().default(1),
  migratedAt: timestamp("migrated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
