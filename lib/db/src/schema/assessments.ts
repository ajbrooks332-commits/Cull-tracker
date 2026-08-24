import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { stalkersTable } from "./stalkers";
import { woodlandBlockEnum, weatherEnum } from "./sessions";

export const deerAssessmentsTable = pgTable("deer_assessments", {
  id: serial("id").primaryKey(),
  stalkerId: integer("stalker_id").references(() => stalkersTable.id, {
    onDelete: "set null",
  }),

  date: timestamp("date", { withTimezone: true }).notNull(),
  woodlandBlock: woodlandBlockEnum("woodland_block"),
  weather: weatherEnum("weather"),
  recorder: text("recorder"),
  sbiNumber: text("sbi_number"),

  standType: text("stand_type"),
  canopyCover: text("canopy_cover"),
  mainSpeciesInStand: text("main_species_in_stand"),
  groundVegetation: text("ground_vegetation"),
  vegWithoutDeer: text("veg_without_deer"),

  deerPresent: text("deer_present"),
  speciesAssessed: text("species_assessed"),
  speciesCausingImpact: text("species_causing_impact"),

  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),

  distanceWalked: integer("distance_walked"),
  gpsRoute: jsonb("gps_route"),

  deerSeenScore: text("deer_seen_score"),
  dungTally: integer("dung_tally"),
  couchesScore: text("couches_score"),
  scrapesScore: text("scrapes_score"),
  wallowsScore: text("wallows_score"),
  racksInWoodScore: text("racks_in_wood_score"),
  racksEdgeScore: text("racks_edge_score"),

  barkRemovalScore: text("bark_removal_score"),
  frayingScore: text("fraying_score"),
  barkStrippingScore: text("bark_stripping_score"),
  brokenStemsScore: text("broken_stems_score"),
  browselineScore: text("browseline_score"),
  browsingCoppiceScore: text("browsing_coppice_score"),
  browsingBasalScore: text("browsing_basal_score"),
  browsingSaplingsScore: text("browsing_saplings_score"),
  browsingBrambleScore: text("browsing_bramble_score"),

  grazingFlora: jsonb("grazing_flora"),

  activitySummary: text("activity_summary"),
  impactSummary: text("impact_summary"),
  activityTrend: text("activity_trend"),
  impactTrend: text("impact_trend"),

  trendNotes: text("trend_notes"),
  comments: text("comments"),

  tallyCounts: jsonb("tally_counts"),

  photos: jsonb("photos"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DeerAssessment = typeof deerAssessmentsTable.$inferSelect;
export type InsertDeerAssessment = typeof deerAssessmentsTable.$inferInsert;
