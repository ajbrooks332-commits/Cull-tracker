export type Species =
  | "red_deer"
  | "roe_deer"
  | "fallow_deer"
  | "sika_deer"
  | "muntjac"
  | "chinese_water_deer";

export type Sex = "stag" | "hind" | "buck" | "doe";
export type Condition = "excellent" | "good" | "fair" | "poor";

export interface CullRecord {
  id: number;
  stalkerId?: number | null;
  stalkerName?: string | null;
  species: Species;
  sex: Sex;
  weight?: number | null;
  condition: Condition;
  pregnant?: boolean | null;
  latitude: number;
  longitude: number;
  notes?: string | null;
  culledAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stalker {
  id: number;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

export const SPECIES_LABELS: Record<Species, string> = {
  red_deer: "Red Deer",
  roe_deer: "Roe Deer",
  fallow_deer: "Fallow Deer",
  sika_deer: "Sika Deer",
  muntjac: "Muntjac",
  chinese_water_deer: "Chinese Water Deer",
};

export const SEX_LABELS: Record<Sex, string> = {
  stag: "Stag",
  hind: "Hind",
  buck: "Buck",
  doe: "Doe",
};

export const CONDITION_LABELS: Record<Condition, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export const VALID_SEX_FOR_SPECIES: Record<Species, Sex[]> = {
  red_deer: ["stag", "hind"],
  roe_deer: ["buck", "doe"],
  fallow_deer: ["buck", "doe"],
  sika_deer: ["stag", "hind"],
  muntjac: ["buck", "doe"],
  chinese_water_deer: ["buck", "doe"],
};

export const FEMALE_SEX: Sex[] = ["hind", "doe"];

export function getCurrentSeasonYear(): number {
  return getCurrentPlanYear();
}

export function seasonLabel(startYear: number): string {
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

export function getAvailableSeasons(): number[] {
  const current = getCurrentSeasonYear();
  const seasons: number[] = [];
  for (let y = current; y >= current - 9; y--) {
    seasons.push(y);
  }
  return seasons;
}

/**
 * Cull-plan years run from 1 May through 30 April.
 * `2026` represents the 2026/27 cull season.
 */
export function getCurrentPlanYear(): number {
  const now = new Date();
  return now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

export function getAvailablePlanYears(): number[] {
  const current = getCurrentPlanYear();
  const years: number[] = [];
  for (let year = current; year >= current - 9; year--) {
    years.push(year);
  }
  return years;
}

export function isInPlanYear(date: Date | string, startYear: number): boolean {
  const cullDate = typeof date === "string" ? new Date(date) : date;
  const start = new Date(startYear, 4, 1);
  const end = new Date(startYear + 1, 4, 1);
  return cullDate.getTime() >= start.getTime() && cullDate.getTime() < end.getTime();
}
