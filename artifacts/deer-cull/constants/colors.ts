const forest = "#1A3A2A";
const moss = "#2D5A3D";
const sage = "#4A7C59";
const fern = "#6BAF83";
const cream = "#F5F0E8";
const tan = "#C4A882";
const bark = "#8B6F47";
const charcoal = "#1C1C1E";
const smoke = "#2C2C2E";
const mist = "#3A3A3C";

export const SPECIES_COLORS: Record<string, Record<string, string>> = {
  red_deer: {
    stag: "#8B1A1A",
    hind: "#C45C5C",
    buck: "#8B1A1A",
    doe: "#C45C5C",
  },
  roe_deer: {
    stag: "#2D6A1A",
    hind: "#6BAF3A",
    buck: "#2D6A1A",
    doe: "#6BAF3A",
  },
  fallow_deer: {
    stag: "#1A5C8B",
    hind: "#5C9FC4",
    buck: "#1A5C8B",
    doe: "#5C9FC4",
  },
  sika_deer: {
    stag: "#6B1A8B",
    hind: "#A45CC4",
    buck: "#6B1A8B",
    doe: "#A45CC4",
  },
  muntjac: {
    stag: "#8B5A1A",
    hind: "#C49A5C",
    buck: "#8B5A1A",
    doe: "#C49A5C",
  },
  chinese_water_deer: {
    stag: "#1A6B6B",
    hind: "#5CB8B8",
    buck: "#1A6B6B",
    doe: "#5CB8B8",
  },
};

export default {
  light: {
    text: charcoal,
    background: cream,
    tint: moss,
    tabIconDefault: "#8E8E93",
    tabIconSelected: moss,
    primary: moss,
    primaryDark: forest,
    accent: fern,
    surface: "#FFFFFF",
    surfaceSecondary: "#F0EBE1",
    border: "#D4C9B5",
    textSecondary: bark,
    danger: "#C0392B",
    warning: "#D4872A",
    success: sage,
    tan,
    cream,
    bark,
  },
  dark: {
    text: "#F0EBE1",
    background: charcoal,
    tint: fern,
    tabIconDefault: "#636366",
    tabIconSelected: fern,
    primary: sage,
    primaryDark: moss,
    accent: fern,
    surface: smoke,
    surfaceSecondary: mist,
    border: "#48484A",
    textSecondary: "#8E8E93",
    danger: "#FF453A",
    warning: "#FFD60A",
    success: fern,
    tan,
    cream,
    bark,
  },
};
