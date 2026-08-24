import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { CullRecord, Stalker } from "@/constants/types";
import { SPECIES_LABELS, SEX_LABELS, CONDITION_LABELS, seasonLabel } from "@/constants/types";
import { LEGEND_ENTRIES } from "./markerColors";
import { getMarkerColor } from "./markerColors";

interface PDFOptions {
  season?: number;
  stalker?: Stalker;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generatePDF(culls: CullRecord[], options: PDFOptions = {}): Promise<void> {
  const { season, stalker } = options;

  const legendHtml = LEGEND_ENTRIES.filter((entry) =>
    culls.some((c) => c.species === entry.species && c.sex === entry.sex)
  )
    .map(
      (e) => `
    <div class="legend-item">
      <div class="legend-dot" style="background-color: ${e.color}"></div>
      <span>${e.label}</span>
    </div>`
    )
    .join("");

  const tableRows = culls
    .map((c) => {
      const color = getMarkerColor(c.species, c.sex);
      return `
      <tr>
        <td><span class="dot" style="background:${color}"></span></td>
        <td>${c.id}</td>
        <td>${SPECIES_LABELS[c.species]}</td>
        <td>${SEX_LABELS[c.sex]}</td>
        <td>${c.weight != null ? `${c.weight} kg` : "-"}</td>
        <td>${CONDITION_LABELS[c.condition]}</td>
        <td>${c.pregnant != null ? (c.pregnant ? "Yes" : "No") : "-"}</td>
        <td>${c.stalkerName || "-"}</td>
        <td>${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}</td>
        <td>${formatDate(c.culledAt)}</td>
        <td>${c.notes || "-"}</td>
      </tr>`;
    })
    .join("");

  const summary = {
    total: culls.length,
    bySpecies: culls.reduce(
      (acc, c) => {
        acc[c.species] = (acc[c.species] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    totalWeight: culls
      .filter((c) => c.weight != null)
      .reduce((s, c) => s + (c.weight || 0), 0),
    pregnant: culls.filter((c) => c.pregnant).length,
  };

  const summaryRows = Object.entries(summary.bySpecies)
    .map(
      ([sp, count]) =>
        `<tr><td>${SPECIES_LABELS[sp as keyof typeof SPECIES_LABELS] || sp}</td><td>${count}</td></tr>`
    )
    .join("");

  const subtitle = [
    season != null ? `Season ${seasonLabel(season)}` : null,
    stalker ? `Stalker: ${stalker.name}` : null,
  ]
    .filter(Boolean)
    .join(" &nbsp;&bull;&nbsp; ");

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Deer Culling Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; background: #F5F0E8; color: #1C1C1E; padding: 20px; }
  .header { background: #1A3A2A; color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; }
  .header h1 { font-size: 28px; margin-bottom: 4px; }
  .header p { opacity: 0.8; font-size: 14px; margin-top: 6px; }
  .header .meta { opacity: 0.65; font-size: 12px; margin-top: 4px; }
  .section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  .section h2 { font-size: 18px; color: #1A3A2A; border-bottom: 2px solid #1A3A2A; padding-bottom: 8px; margin-bottom: 16px; }
  .legend { display: flex; flex-wrap: wrap; gap: 12px; }
  .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .legend-dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
  .stat { background: #F0EBE1; border-radius: 6px; padding: 12px; text-align: center; }
  .stat .value { font-size: 28px; font-weight: bold; color: #1A3A2A; }
  .stat .label { font-size: 12px; color: #8B6F47; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1A3A2A; color: white; padding: 8px; text-align: left; }
  td { padding: 6px 8px; border-bottom: 1px solid #E5DDD0; vertical-align: middle; }
  tr:nth-child(even) td { background: #FAFAF6; }
  .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; }
  .footer { text-align: center; color: #8B6F47; font-size: 12px; margin-top: 24px; }
</style>
</head>
<body>
  <div class="header">
    <h1>Deer Culling Report</h1>
    ${subtitle ? `<p>${subtitle}</p>` : ""}
    <div class="meta">Generated: ${new Date().toLocaleString("en-GB")} &nbsp;&bull;&nbsp; Total Records: ${summary.total}</div>
  </div>

  <div class="section">
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="stat">
        <div class="value">${summary.total}</div>
        <div class="label">Total Culls</div>
      </div>
      <div class="stat">
        <div class="value">${summary.totalWeight.toFixed(1)} kg</div>
        <div class="label">Total Weight (recorded)</div>
      </div>
      <div class="stat">
        <div class="value">${summary.pregnant}</div>
        <div class="label">Pregnant</div>
      </div>
    </div>
    <table>
      <tr><th>Species</th><th>Count</th></tr>
      ${summaryRows}
    </table>
  </div>

  <div class="section">
    <h2>Map Key</h2>
    <div class="legend">${legendHtml}</div>
  </div>

  <div class="section">
    <h2>All Records</h2>
    <table>
      <thead>
        <tr>
          <th></th>
          <th>#</th>
          <th>Species</th>
          <th>Sex</th>
          <th>Weight</th>
          <th>Condition</th>
          <th>Pregnant</th>
          <th>Stalker</th>
          <th>Location</th>
          <th>Date &amp; Time</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Deer Culling Records &bull; Estate Management Report
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Export Deer Culling Report",
    UTI: "com.adobe.pdf",
  });
}

export async function generateAndSharePDF(culls: CullRecord[]): Promise<void> {
  return generatePDF(culls);
}
