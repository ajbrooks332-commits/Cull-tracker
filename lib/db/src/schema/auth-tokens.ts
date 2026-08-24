import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { stalkersTable } from "./stalkers";

export const authTokensTable = pgTable("auth_tokens", {
  token: text("token").primaryKey(),
  stalkerId: integer("stalker_id")
    .notNull()
    .references(() => stalkersTable.id, { onDelete: "cascade" }),
  stalkerName: text("stalker_name").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuthToken = typeof authTokensTable.$inferSelect;
