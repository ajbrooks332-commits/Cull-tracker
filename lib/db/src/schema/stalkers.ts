import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stalkersTable = pgTable("stalkers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  pin: text("pin").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStalkerSchema = createInsertSchema(stalkersTable).omit({
  id: true,
  createdAt: true,
});

export const updateStalkerSchema = createUpdateSchema(stalkersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertStalker = z.infer<typeof insertStalkerSchema>;
export type UpdateStalker = z.infer<typeof updateStalkerSchema>;
export type Stalker = typeof stalkersTable.$inferSelect;
