import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type CullRecord, type Stalker, type StalkingSession } from "./schemas";
import {
  SPECIES_LABELS,
  SEX_LABELS,
  CONDITION_LABELS,
  WOODLAND_BLOCKS,
  WEATHER_CONDITIONS,
  formatSeasonLabel,
  getMarkerColor,
} from "./constants";
import { formatDate, formatTime } from "./utils";

interface PDFOptions {
  season?: number | null;
  stalker?: Stalker | null;
  sessions?: StalkingSession[];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function blockLabel(block: string): string {
  return (WOODLAND_BLOCKS as Record<string, string>)[block] ?? block;
}

function weatherLabel(w: string | null | undefined): string {
  if (!w) return "-";
  return (WEATHER_CONDITIONS as Record<string, string>)[w] ?? w;
}

function fmtDuration(mins: number | null | undefined): string {
  if (mins == null) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getY(doc: jsPDF): number {
  return (doc as any).lastAutoTable?.finalY ?? 0;
}

export function generatePDF(culls: CullRecord[], options: PDFOptions = {}) {
  const doc = new jsPDF();
  const { season, stalker, sessions = [] } = options;

  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  // ── Header banner ──────────────────────────────────────────────────────────
  doc.setFillColor(33, 80, 58);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Deer Culling Report", margin, 18);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  let y = 36;
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  y += 5;

  if (season) {
    doc.text(`Season: ${formatSeasonLabel(season)}`, margin, y);
    y += 5;
  }
  if (stalker) {
    doc.text(`Stalker filter: ${stalker.name}`, margin, y);
    y += 5;
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalMins = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
  const totalHrs = (totalMins / 60).toFixed(1);

  const summaryBody: string[][] = [
    ["Cull records", String(culls.length)],
    ["Stalking sessions", String(sessions.length)],
    ["Total time in field", sessions.length > 0 ? `${totalHrs} hours (${totalMins} min)` : "-"],
  ];

  // Species breakdown
  const speciesCounts: Record<string, number> = {};
  for (const c of culls) {
    const label = SPECIES_LABELS[c.species] ?? c.species;
    speciesCounts[label] = (speciesCounts[label] ?? 0) + 1;
  }
  for (const [sp, count] of Object.entries(speciesCounts)) {
    summaryBody.push([sp, String(count)]);
  }

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Season Summary", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [],
    body: summaryBody,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
  });

  y = getY(doc) + 8;

  // ── Per-stalker summary ────────────────────────────────────────────────────
  const byStalker = new Map<string, { count: number; weightSum: number; sessions: number; mins: number }>();
  for (const c of culls) {
    const name = c.stalkerName || "Unassigned";
    const cur = byStalker.get(name) ?? { count: 0, weightSum: 0, sessions: 0, mins: 0 };
    cur.count += 1;
    cur.weightSum += typeof c.weight === "number" ? c.weight : 0;
    byStalker.set(name, cur);
  }
  for (const s of sessions) {
    const name = s.stalkerName || "Unassigned";
    const cur = byStalker.get(name) ?? { count: 0, weightSum: 0, sessions: 0, mins: 0 };
    cur.sessions += 1;
    cur.mins += s.durationMinutes ?? 0;
    byStalker.set(name, cur);
  }
  if (byStalker.size > 0) {
    if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 16; }
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0, 0, 0);
    doc.text("By Stalker", margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Stalker", "Culls", "Total Weight (kg)", "Avg Weight (kg)", "Sessions", "Hrs"]],
      body: [...byStalker.entries()].sort((a, b) => b[1].count - a[1].count).map(([name, v]) => [
        name,
        String(v.count),
        v.weightSum > 0 ? v.weightSum.toFixed(1) : "-",
        v.count > 0 && v.weightSum > 0 ? (v.weightSum / v.count).toFixed(1) : "-",
        String(v.sessions),
        v.mins > 0 ? (v.mins / 60).toFixed(1) : "-",
      ]),
      theme: "striped",
      headStyles: { fillColor: [33, 80, 58], fontSize: 8 },
      styles: { fontSize: 8 },
    });
    y = getY(doc) + 8;
  }

  // ── Per-block summary ──────────────────────────────────────────────────────
  const byBlock = new Map<string, { count: number; sessions: number; mins: number }>();
  for (const c of culls) {
    const name = c.woodlandBlock ? blockLabel(c.woodlandBlock) : "Unspecified";
    const cur = byBlock.get(name) ?? { count: 0, sessions: 0, mins: 0 };
    cur.count += 1;
    byBlock.set(name, cur);
  }
  for (const s of sessions) {
    const name = blockLabel(s.woodlandBlock);
    const cur = byBlock.get(name) ?? { count: 0, sessions: 0, mins: 0 };
    cur.sessions += 1;
    cur.mins += s.durationMinutes ?? 0;
    byBlock.set(name, cur);
  }
  if (byBlock.size > 0) {
    if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 16; }
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0, 0, 0);
    doc.text("By Woodland Block", margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Woodland Block", "Culls", "Sessions", "Hrs", "Culls/Hr"]],
      body: [...byBlock.entries()].sort((a, b) => b[1].count - a[1].count).map(([name, v]) => [
        name,
        String(v.count),
        String(v.sessions),
        v.mins > 0 ? (v.mins / 60).toFixed(1) : "-",
        v.mins > 0 ? (v.count / (v.mins / 60)).toFixed(2) : "-",
      ]),
      theme: "striped",
      headStyles: { fillColor: [33, 80, 58], fontSize: 8 },
      styles: { fontSize: 8 },
    });
    y = getY(doc) + 8;
  }

  // ── Stalking Sessions section ──────────────────────────────────────────────
  if (sessions.length > 0) {
    // Check if we need a new page (need ~60mm minimum)
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 16;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Stalking Sessions", margin, y);
    y += 4;

    const sorted = [...sessions].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );

    const sessionRows = sorted.map((s) => [
      s.startedAt ? formatDate(s.startedAt) : "-",
      blockLabel(s.woodlandBlock),
      s.stalkerName || "-",
      s.startedAt ? formatTime(s.startedAt) : "-",
      s.endedAt ? formatTime(s.endedAt) : "Active",
      fmtDuration(s.durationMinutes),
      weatherLabel(s.weather),
      s.notes || "",
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Date", "Woodland Block", "Stalker", "Start", "End", "Duration", "Weather", "Notes"]],
      body: sessionRows,
      theme: "striped",
      headStyles: { fillColor: [33, 80, 58], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { cellWidth: 32 },
        7: { cellWidth: 28 },
      },
    });

    y = getY(doc) + 8;
  }

  // ── Cull Records section ───────────────────────────────────────────────────
  if (culls.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 16;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Cull Records", margin, y);
    y += 4;

    const tableData = culls.map((c) => [
      c.id.toString(),
      SPECIES_LABELS[c.species] ?? c.species,
      SEX_LABELS[c.sex] ?? c.sex,
      c.weight != null ? `${c.weight} kg` : "-",
      CONDITION_LABELS[c.condition] ?? c.condition,
      c.pregnant != null ? (c.pregnant ? "Yes" : "No") : "-",
      c.larderTag || "-",
      c.stalkerName || "-",
      c.latitude != null && c.longitude != null
        ? `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`
        : "-",
      c.culledAt ? `${formatDate(c.culledAt)} ${formatTime(c.culledAt)}` : "-",
      c.notes || "",
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["ID", "Species", "Sex", "Weight", "Cond.", "Preg", "Larder", "Stalker", "Location", "Date & Time", "Notes"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [33, 80, 58], fontSize: 8 },
      styles: { fontSize: 7.5 },
      columnStyles: {
        6: { fontStyle: "bold", cellWidth: 22 },
        10: { cellWidth: 24 },
      },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const cull = culls[data.row.index];
          if (cull) {
            const [r, g, b] = hexToRgb(getMarkerColor(cull.species, cull.sex));
            doc.setFillColor(r, g, b);
            doc.circle(data.cell.x + 3, data.cell.y + data.cell.height / 2, 1.5, "F");
          }
        }
        // Highlight 'poor' condition cells in red (welfare concern).
        if (data.section === "body" && data.column.index === 4) {
          const cull = culls[data.row.index];
          if (cull?.condition === "poor") {
            doc.setFillColor(254, 226, 226);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
            doc.setTextColor(153, 27, 27);
            doc.setFont("helvetica", "bold");
            doc.text(CONDITION_LABELS.poor, data.cell.x + 1.5, data.cell.y + data.cell.height / 2 + 1);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
          }
        }
      },
    });
  }

  // ── Page numbers ───────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  doc.save(`Deer_Cull_Report_${new Date().toISOString().split("T")[0]}.pdf`);
}
