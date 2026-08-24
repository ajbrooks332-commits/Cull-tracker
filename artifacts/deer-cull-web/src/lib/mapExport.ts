import { type CullRecord, type Stalker } from "./schemas";
import {
  SPECIES_LABELS,
  SEX_LABELS,
  CONDITION_LABELS,
  formatSeasonLabel,
  getMarkerColor,
} from "./constants";
import { formatDate, formatTime } from "./utils";

interface MapExportOptions {
  season?: number | null;
  stalker?: Stalker | null;
}

export function generateMapHTML(culls: CullRecord[], options: MapExportOptions = {}) {
  const { season, stalker } = options;

  const title = [
    "Deer Cull Map",
    season ? `Season ${formatSeasonLabel(season)}` : null,
    stalker ? stalker.name : null,
  ].filter(Boolean).join(" — ");

  const generatedAt = new Date().toLocaleString("en-GB");

  // Build species breakdown
  const speciesCounts: Record<string, number> = {};
  for (const c of culls) {
    const label = SPECIES_LABELS[c.species] ?? c.species;
    speciesCounts[label] = (speciesCounts[label] ?? 0) + 1;
  }

  const totalWeight = culls.reduce((sum, c) => sum + (c.weight ?? 0), 0);
  const pregnantCount = culls.filter(c => c.pregnant).length;

  // Serialize cull data for embedding
  const cullsJson = JSON.stringify(
    culls.map(c => ({
      id: c.id,
      lat: c.latitude,
      lng: c.longitude,
      species: SPECIES_LABELS[c.species] ?? c.species,
      sex: SEX_LABELS[c.sex] ?? c.sex,
      weight: c.weight,
      condition: CONDITION_LABELS[c.condition] ?? c.condition,
      pregnant: c.pregnant,
      stalker: c.stalkerName ?? "Unknown",
      date: formatDate(c.culledAt),
      time: formatTime(c.culledAt),
      notes: c.notes ?? "",
      color: getMarkerColor(c.species, c.sex),
    }))
  );

  // Legend rows — all species/sex combos that appear in the data
  const legendItems = new Map<string, { color: string; label: string }>();
  for (const c of culls) {
    const key = `${c.species}_${c.sex}`;
    if (!legendItems.has(key)) {
      legendItems.set(key, {
        color: getMarkerColor(c.species, c.sex),
        label: `${SPECIES_LABELS[c.species] ?? c.species} — ${SEX_LABELS[c.sex] ?? c.sex}`,
      });
    }
  }
  const legendHtml = Array.from(legendItems.values())
    .map(item => `
      <div class="legend-row">
        <span class="legend-dot" style="background:${item.color}"></span>
        <span>${item.label}</span>
      </div>`)
    .join("");

  // Species breakdown rows
  const speciesBreakdownHtml = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([sp, count]) => `
      <div class="stat-row">
        <span>${sp}</span>
        <strong>${count}</strong>
      </div>`)
    .join("");

  // Compute a centre for the map
  const avgLat = culls.length ? culls.reduce((s, c) => s + c.latitude, 0) / culls.length : 56.49;
  const avgLng = culls.length ? culls.reduce((s, c) => s + c.longitude, 0) / culls.length : -4.2;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escHtml(title)}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; background: #f5f6f4; color: #1a2e20; height: 100dvh; display: flex; flex-direction: column; }

  /* ── Header ── */
  header {
    background: #1e4d2b;
    color: #fff;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  header .title-block p { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.55); margin-bottom: 3px; }
  header .title-block h1 { font-size: 16px; font-weight: 700; line-height: 1.2; }
  header .meta { font-size: 11px; color: rgba(255,255,255,0.55); text-align: right; line-height: 1.6; }

  /* ── Controls bar ── */
  .controls {
    background: #fff;
    border-bottom: 1px solid #e0e4df;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 6px; border: 1px solid #d0d5cf;
    background: #f5f6f4; color: #1a2e20; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.15s;
  }
  .btn:hover { background: #e8ede6; }
  .btn.active { background: #1e4d2b; color: #fff; border-color: #1e4d2b; }
  .dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); display: inline-block; }
  .controls-label { font-size: 11px; color: #6b7c6e; margin-left: auto; }

  /* ── Map + sidebar layout ── */
  .layout { flex: 1; display: flex; overflow: hidden; }
  #map { flex: 1; z-index: 0; }

  /* ── Sidebar ── */
  .sidebar {
    width: 240px;
    flex-shrink: 0;
    background: #fff;
    border-left: 1px solid #e0e4df;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    font-size: 13px;
  }
  @media (max-width: 640px) {
    .layout { flex-direction: column-reverse; }
    .sidebar { width: 100%; max-height: 220px; border-left: none; border-top: 1px solid #e0e4df; flex-direction: row; flex-wrap: wrap; overflow-x: auto; }
    .sidebar-section { flex: 1; min-width: 160px; }
  }
  .sidebar-section { padding: 14px 16px; border-bottom: 1px solid #e0e4df; }
  .sidebar-section:last-child { border-bottom: none; }
  .sidebar-section h3 { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7c6e; margin-bottom: 10px; }

  /* Stats */
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .stat-card { background: #f5f6f4; border-radius: 6px; padding: 8px 10px; }
  .stat-card .num { font-size: 20px; font-weight: 700; color: #1e4d2b; line-height: 1; }
  .stat-card .lbl { font-size: 10px; color: #6b7c6e; margin-top: 2px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12px; color: #1a2e20; border-bottom: 1px solid #f0f2ef; }
  .stat-row:last-child { border-bottom: none; }
  .stat-row strong { color: #1e4d2b; }

  /* Legend */
  .legend-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); flex-shrink: 0; }

  /* Popup */
  .leaflet-popup-content-wrapper { border-radius: 8px !important; box-shadow: 0 4px 16px rgba(0,0,0,0.2) !important; }
  .leaflet-popup-content { margin: 0 !important; min-width: 200px; }
  .popup-inner { padding: 12px 14px; }
  .popup-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .popup-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); flex-shrink: 0; }
  .popup-header h4 { font-size: 13px; font-weight: 700; line-height: 1.2; color: #1a2e20; }
  .popup-row { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; border-bottom: 1px solid #f0f2ef; color: #1a2e20; }
  .popup-row:last-child { border-bottom: none; }
  .popup-row .lbl { color: #6b7c6e; }
  .popup-row .val { font-weight: 600; }
  .popup-notes { font-size: 11px; color: #6b7c6e; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f2ef; font-style: italic; }
  .popup-pregnant { display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; border-radius: 4px; padding: 2px 6px; }
</style>
</head>
<body>

<header>
  <div class="title-block">
    <p>Deer Cull Records — Estate Management</p>
    <h1>${escHtml(title)}</h1>
  </div>
  <div class="meta">
    ${escHtml(String(culls.length))} records<br/>
    Generated ${escHtml(generatedAt)}
  </div>
</header>

<div class="controls">
  <button class="btn active" id="btn-markers" onclick="showMarkers()">
    <span class="dot" style="background:#2D6A1A"></span> Markers
  </button>
  <button class="btn" id="btn-heat" onclick="showHeat()">
    🔥 Heatmap
  </button>
  <button class="btn" id="btn-satellite" onclick="toggleTiles()">
    🛰 Satellite
  </button>
  <span class="controls-label" id="controls-label">Click a marker for details</span>
</div>

<div class="layout">
  <div id="map"></div>
  <aside class="sidebar">
    <div class="sidebar-section">
      <h3>Summary</h3>
      <div class="stat-grid">
        <div class="stat-card"><div class="num">${culls.length}</div><div class="lbl">Total Culls</div></div>
        <div class="stat-card"><div class="num">${totalWeight > 0 ? totalWeight.toFixed(0) + " kg" : "—"}</div><div class="lbl">Total Weight</div></div>
        <div class="stat-card"><div class="num">${pregnantCount}</div><div class="lbl">Pregnant</div></div>
        <div class="stat-card"><div class="num">${Object.keys(speciesCounts).length}</div><div class="lbl">Species</div></div>
      </div>
    </div>

    ${speciesBreakdownHtml ? `
    <div class="sidebar-section">
      <h3>By Species</h3>
      ${speciesBreakdownHtml}
    </div>` : ""}

    ${legendHtml ? `
    <div class="sidebar-section">
      <h3>Colour Key</h3>
      ${legendHtml}
    </div>` : ""}
  </aside>
</div>

<script>
const CULLS = ${cullsJson};
const AVG_LAT = ${avgLat};
const AVG_LNG = ${avgLng};

// ── Map setup ──
const map = L.map('map').setView([AVG_LAT, AVG_LNG], 12);

const streetLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 18, attribution: '© OpenStreetMap' }
);

const satelliteLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 18, attribution: 'Tiles © Esri' }
);

satelliteLayer.addTo(map);
let isSatellite = true;

// ── Marker layer ──
const markersLayer = L.layerGroup();

CULLS.forEach(function(c) {
  const icon = L.divIcon({
    className: '',
    html: '<svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="' + c.color + '" stroke="white" stroke-width="2.5" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4))"/></svg>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  const popupRows = [
    ['Date', c.date + ' ' + c.time],
    ['Weight', c.weight ? c.weight + ' kg' : 'Not recorded'],
    ['Condition', c.condition],
    ['Stalker', c.stalker],
    ['GPS', c.lat.toFixed(5) + '°N, ' + c.lng.toFixed(5) + '°E'],
  ];

  const popupHtml =
    '<div class="popup-inner">' +
    '<div class="popup-header">' +
    '<span class="popup-dot" style="background:' + c.color + '"></span>' +
    '<h4>' + escHtml(c.species) + ' — ' + escHtml(c.sex) + '</h4>' +
    '</div>' +
    popupRows.map(function(r) {
      return '<div class="popup-row"><span class="lbl">' + escHtml(r[0]) + '</span><span class="val">' + escHtml(String(r[1])) + '</span></div>';
    }).join('') +
    (c.pregnant ? '<div class="popup-pregnant">Pregnant</div>' : '') +
    (c.notes ? '<div class="popup-notes">' + escHtml(c.notes) + '</div>' : '') +
    '</div>';

  L.marker([c.lat, c.lng], { icon: icon })
    .bindPopup(popupHtml, { maxWidth: 260 })
    .addTo(markersLayer);
});

markersLayer.addTo(map);

// ── Heatmap layer ──
const heatPoints = CULLS.map(function(c) { return [c.lat, c.lng, 1]; });
const heatLayer = L.heatLayer(heatPoints, {
  radius: 28,
  blur: 20,
  maxZoom: 17,
  gradient: { 0.2: '#3b82f6', 0.4: '#22c55e', 0.6: '#eab308', 0.8: '#f97316', 1.0: '#dc2626' }
});

// Fit bounds
if (CULLS.length > 0) {
  const bounds = L.latLngBounds(CULLS.map(function(c) { return [c.lat, c.lng]; }));
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
}

// ── Controls ──
function showMarkers() {
  map.removeLayer(heatLayer);
  markersLayer.addTo(map);
  document.getElementById('btn-markers').classList.add('active');
  document.getElementById('btn-heat').classList.remove('active');
  document.getElementById('controls-label').textContent = 'Click a marker for details';
}

function showHeat() {
  map.removeLayer(markersLayer);
  heatLayer.addTo(map);
  document.getElementById('btn-heat').classList.add('active');
  document.getElementById('btn-markers').classList.remove('active');
  document.getElementById('controls-label').textContent = 'Density heatmap — zoom in for detail';
}

function toggleTiles() {
  const btn = document.getElementById('btn-satellite');
  if (isSatellite) {
    map.removeLayer(satelliteLayer);
    streetLayer.addTo(map);
    btn.textContent = '🗺 Street';
    isSatellite = false;
  } else {
    map.removeLayer(streetLayer);
    satelliteLayer.addTo(map);
    btn.textContent = '🛰 Satellite';
    isSatellite = true;
  }
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
</script>
</body>
</html>`;

  // Trigger download
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Deer_Cull_Map_${new Date().toISOString().split("T")[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
