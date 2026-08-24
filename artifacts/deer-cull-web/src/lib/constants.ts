export const SPECIES_LABELS = {
  red_deer: "Red Deer",
  roe_deer: "Roe Deer",
  fallow_deer: "Fallow Deer",
  sika_deer: "Sika Deer",
  muntjac: "Muntjac",
  chinese_water_deer: "Chinese Water Deer",
} as const;

export type Species = keyof typeof SPECIES_LABELS;

export const SEX_LABELS = {
  stag: "Stag",
  hind: "Hind",
  buck: "Buck",
  doe: "Doe",
} as const;

export type Sex = keyof typeof SEX_LABELS;

export const CONDITION_LABELS = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
} as const;

export type Condition = keyof typeof CONDITION_LABELS;

export const VALID_SEX_FOR_SPECIES: Record<Species, Sex[]> = {
  red_deer: ["stag", "hind"],
  roe_deer: ["buck", "doe"],
  fallow_deer: ["buck", "doe"],
  sika_deer: ["stag", "hind"],
  muntjac: ["buck", "doe"],
  chinese_water_deer: ["buck", "doe"],
};

export const FEMALE_SEX: Sex[] = ["hind", "doe"];

export function getMarkerColor(species: string, sex: string): string {
  if (species === "red_deer") return sex === "stag" ? "#8B1A1A" : "#C45C5C";
  if (species === "roe_deer") return sex === "buck" ? "#2D6A1A" : "#6BAF3A";
  if (species === "fallow_deer") return sex === "buck" ? "#1A5C8B" : "#5C9FC4";
  if (species === "sika_deer") return sex === "stag" ? "#6B1A8B" : "#A45CC4";
  if (species === "muntjac") return sex === "buck" ? "#8B5A1A" : "#C49A5C";
  if (species === "chinese_water_deer") return sex === "buck" ? "#1A6B6B" : "#5CB8B8";
  return "#000000";
}

export function getCurrentSeasonYear(): number {
  return getCurrentPlanYear();
}

export function formatSeasonLabel(startYear: number): string {
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

export const WOODLAND_BLOCKS = {
  hercules:            "Hercules",
  leaselands:          "Leaselands",
  jack_bells_grove:    "Jack Bells Grove",
  great_wood:          "Great Wood",
  mount_park:          "Mount Park",
  osier_carr:          "Osier Carr",
  pond_wood:           "Pond Wood",
  hollys_grove:        "Holly's Grove",
  the_tollands:        "The Tollands",
  marlpit_plantation:  "Marlpit Plantation",
  squirrels_carr:      "Squirrels Carr",
  moorgate_carrs:      "Moorgate Carrs",
} as const;

export type WoodlandBlock = keyof typeof WOODLAND_BLOCKS;

export const WOODLAND_BLOCK_LIST = Object.keys(WOODLAND_BLOCKS) as WoodlandBlock[];

export const WEATHER_CONDITIONS = {
  clear:       "Clear",
  overcast:    "Overcast",
  light_rain:  "Light rain",
  heavy_rain:  "Heavy rain",
  fog:         "Fog",
  windy:       "Windy",
  snow:        "Snow",
} as const;

export type WeatherCondition = keyof typeof WEATHER_CONDITIONS;

/**
 * UK England open seasons (DEFRA / Deer Act 1991).
 * Returns inclusive [startMonth, startDay] → [endMonth, endDay] (1-indexed months/days).
 * Returns null for species with no closed season.
 */
export function getOpenSeason(species: Species, sex: Sex): { startMonth: number; startDay: number; endMonth: number; endDay: number } | null {
  // Muntjac & Chinese Water Deer — no closed season
  if (species === "muntjac" || species === "chinese_water_deer") return null;

  if (species === "roe_deer") {
    if (sex === "buck") return { startMonth: 4, startDay: 1, endMonth: 10, endDay: 31 };
    if (sex === "doe")  return { startMonth: 11, startDay: 1, endMonth: 3, endDay: 31 };
  }
  // Red, Sika, Fallow
  const isMale = sex === "stag" || sex === "buck";
  if (isMale) return { startMonth: 8, startDay: 1, endMonth: 4, endDay: 30 };
  // Hind / Doe
  return { startMonth: 11, startDay: 1, endMonth: 3, endDay: 31 };
}

/**
 * True if the supplied date falls inside the open season for the given species/sex.
 * If the species has no closed season, always returns true.
 */
export function isInOpenSeason(species: Species, sex: Sex, date: Date): boolean {
  const season = getOpenSeason(species, sex);
  if (!season) return true;
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const md = m * 100 + d;
  const startMd = season.startMonth * 100 + season.startDay;
  const endMd = season.endMonth * 100 + season.endDay;
  // Wrap-around (e.g. Aug 1 → Apr 30) means valid if md >= start OR md <= end
  if (startMd <= endMd) return md >= startMd && md <= endMd;
  return md >= startMd || md <= endMd;
}

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatOpenSeasonRange(species: Species, sex: Sex): string {
  const s = getOpenSeason(species, sex);
  if (!s) return "No closed season";
  return `${MONTHS[s.startMonth]} ${s.startDay} – ${MONTHS[s.endMonth]} ${s.endDay}`;
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
 * Cull-plan years run May 1 → April 30.
 * `startYear` represents the May year (e.g. 2025 = May 2025 → Apr 2026).
 */
export function getCurrentPlanYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  return month >= 5 ? now.getFullYear() : now.getFullYear() - 1;
}

export function formatPlanYearLabel(startYear: number): string {
  return `May ${startYear} – Apr ${startYear + 1}`;
}

export function getPlanYearRange(startYear: number): { start: Date; end: Date } {
  // May 1 of startYear (00:00 local) → May 1 of startYear+1 (00:00 local, exclusive)
  return {
    start: new Date(startYear, 4, 1, 0, 0, 0, 0),
    end:   new Date(startYear + 1, 4, 1, 0, 0, 0, 0),
  };
}

export function isInPlanYear(date: Date | string, startYear: number): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  const { start, end } = getPlanYearRange(startYear);
  return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
}

export function getAvailablePlanYears(): number[] {
  const current = getCurrentPlanYear();
  const years: number[] = [];
  for (let y = current; y >= current - 9; y--) {
    years.push(y);
  }
  return years;
}
