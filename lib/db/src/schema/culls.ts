import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stalkersTable } from "./stalkers";
import { woodlandBlockEnum, stalkingSessionsTable } from "./sessions";

export const speciesEnum = pgEnum("species", [
  "red_deer",
  "roe_deer",
  "fallow_deer",
  "sika_deer",
  "muntjac",
  "chinese_water_deer",
]);

export const sexEnum = pgEnum("sex", ["stag", "hind", "buck", "doe"]);

export const conditionEnum = pgEnum("condition", [
  "excellent",
  "good",
  "fair",
  "poor",
]);

export const cullsTable = pgTable("culls", {
  id: serial("id").primaryKey(),
  stalkerId: integer("stalker_id").references(() => stalkersTable.id, {
    onDelete: "set null",
  }),
  sessionId: integer("session_id").references(() => stalkingSessionsTable.id, {
    onDelete: "set null",
  }),
  species: speciesEnum("species").notNull(),
  sex: sexEnum("sex").notNull(),
  weight: doublePrecision("weight"),
  condition: conditionEnum("condition").notNull(),
  pregnant: boolean("pregnant"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  woodlandBlock: woodlandBlockEnum("woodland_block"),
  larderTag: text("larder_tag"),
  notes: text("notes"),
  culledAt: timestamp("culled_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cullPlansTable = pgTable("cull_plans", {
  id: serial("id").primaryKey(),
  seasonStartYear: integer("season_start_year").notNull(),
  species: speciesEnum("species").notNull(),
  sex: sexEnum("sex").notNull(),
  target: integer("target").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCullPlanSchema = createInsertSchema(cullPlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCullPlanSchema = createUpdateSchema(cullPlansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCullPlan = z.infer<typeof insertCullPlanSchema>;
export type UpdateCullPlan = z.infer<typeof updateCullPlanSchema>;
export type CullPlan = typeof cullPlansTable.$inferSelect;

export const insertCullSchema = createInsertSchema(cullsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCullSchema = createUpdateSchema(cullsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCull = z.infer<typeof insertCullSchema>;
export type UpdateCull = z.infer<typeof updateCullSchema>;
export type Cull = typeof cullsTable.$inferSelect;
