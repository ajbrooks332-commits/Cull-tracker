import type { Species, Sex } from "@/constants/types";
import { SPECIES_COLORS } from "@/constants/colors";

export function getMarkerColor(species: Species, sex: Sex): string {
  return SPECIES_COLORS[species]?.[sex] ?? "#666666";
}

export interface LegendEntry {
  species: Species;
  sex: Sex;
  color: string;
  label: string;
}

export const LEGEND_ENTRIES: LegendEntry[] = [
  { species: "red_deer", sex: "stag", color: "#8B1A1A", label: "Red Deer - Stag" },
  { species: "red_deer", sex: "hind", color: "#C45C5C", label: "Red Deer - Hind" },
  { species: "roe_deer", sex: "buck", color: "#2D6A1A", label: "Roe Deer - Buck" },
  { species: "roe_deer", sex: "doe", color: "#6BAF3A", label: "Roe Deer - Doe" },
  { species: "fallow_deer", sex: "buck", color: "#1A5C8B", label: "Fallow Deer - Buck" },
  { species: "fallow_deer", sex: "doe", color: "#5C9FC4", label: "Fallow Deer - Doe" },
  { species: "sika_deer", sex: "stag", color: "#6B1A8B", label: "Sika Deer - Stag" },
  { species: "sika_deer", sex: "hind", color: "#A45CC4", label: "Sika Deer - Hind" },
  { species: "muntjac", sex: "buck", color: "#8B5A1A", label: "Muntjac - Buck" },
  { species: "muntjac", sex: "doe", color: "#C49A5C", label: "Muntjac - Doe" },
  { species: "chinese_water_deer", sex: "buck", color: "#1A6B6B", label: "Chinese Water Deer - Buck" },
  { species: "chinese_water_deer", sex: "doe", color: "#5CB8B8", label: "Chinese Water Deer - Doe" },
];
