import { z } from "zod";

export const stalkerSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  token: z.string().optional(),
});

export type Stalker = z.infer<typeof stalkerSchema>;

export const cullRecordSchema = z.object({
  id: z.coerce.number(),
  stalkerId: z.coerce.number().nullable().optional(),
  stalkerName: z.string().nullable().optional(),
  sessionId: z.coerce.number().nullable().optional(),
  species: z.enum(["red_deer", "roe_deer", "fallow_deer", "sika_deer", "muntjac", "chinese_water_deer"]),
  sex: z.enum(["stag", "hind", "buck", "doe"]),
  weight: z.coerce.number().nullable().optional(),
  condition: z.enum(["excellent", "good", "fair", "poor"]),
  pregnant: z.boolean().nullable().optional(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  woodlandBlock: z.string().nullable().optional(),
  larderTag: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  culledAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CullRecord = z.infer<typeof cullRecordSchema>;

/**
 * A CullRecord that hasn't been synced to the server yet.
 * Displayed in the UI with a pending indicator.
 */
export type PendingCullRecord = CullRecord & {
  _pending: true;
  _localId: string;
};

export const stalkingSessionSchema = z.object({
  id: z.coerce.number(),
  stalkerId: z.coerce.number().nullable().optional(),
  stalkerName: z.string().nullable().optional(),
  woodlandBlock: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  durationMinutes: z.coerce.number().nullable().optional(),
  weather: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StalkingSession = z.infer<typeof stalkingSessionSchema>;

export const cullPlanSchema = z.object({
  id: z.coerce.number(),
  seasonStartYear: z.coerce.number(),
  species: z.enum(["red_deer", "roe_deer", "fallow_deer", "sika_deer", "muntjac", "chinese_water_deer"]),
  sex: z.enum(["stag", "hind", "buck", "doe"]),
  target: z.coerce.number(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CullPlan = z.infer<typeof cullPlanSchema>;
