import {
  boolean,
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

export const woodlandBlockEnum = pgEnum("woodland_block", [
  "hercules",
  "leaselands",
  "jack_bells_grove",
  "great_wood",
  "mount_park",
  "osier_carr",
  "pond_wood",
  "hollys_grove",
  "the_tollands",
  "marlpit_plantation",
  "squirrels_carr",
  "moorgate_carrs",
]);

export const weatherEnum = pgEnum("weather_condition", [
  "clear",
  "overcast",
  "light_rain",
  "heavy_rain",
  "fog",
  "windy",
  "snow",
]);

export const stalkingSessionsTable = pgTable("stalking_sessions", {
  id: serial("id").primaryKey(),
  stalkerId: integer("stalker_id").references(() => stalkersTable.id, {
    onDelete: "set null",
  }),
  woodlandBlock: woodlandBlockEnum("woodland_block").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  weather: weatherEnum("weather"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(stalkingSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSessionSchema = createUpdateSchema(stalkingSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type UpdateSession = z.infer<typeof updateSessionSchema>;
export type StalkingSession = typeof stalkingSessionsTable.$inferSelect;
