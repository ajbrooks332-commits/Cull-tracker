import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import {
  Plus, LocateFixed, Globe, Map as MapIcon, Loader2, X,
  CloudDownload, CheckCircle2, Trash2, WifiOff,
} from "lucide-react";
import { useCulls, useCreateCull, useUpdateCull, useDeleteCull, usePendingCulls } from "@/hooks/use-api";
import {
  formatSeasonLabel,
  getAvailablePlanYears,
  getCurrentPlanYear,
  getMarkerColor,
  isInPlanYear,
} from "@/lib/constants";
import { CullForm } from "@/components/CullForm";
import { CullDetailSheet } from "@/components/CullDetailSheet";
import type { CullRecord, PendingCullRecord } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import {
  countTiles,
  downloadTiles,
  getCachedTileCount,
  clearCachedTiles,
  type MapBounds,
} from "@/lib/offlineMap";

const DEFAULT_CENTER: [number, number] = [56.4907, -4.2026];

function getCustomIcon(color: string, pending = false) {
  return L.divIcon({
    className: "bg-transparent border-none",
    html: pending
      ? `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="9" fill="${color}" stroke="white" stroke-width="2.5" stroke-dasharray="4 2" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))"/>
        </svg>`
      : `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="13" cy="13" r="9" fill="${color}" stroke="white" stroke-width="2.5" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45))"/>
         </svg>`,
    iconSize: pending ? [28, 28] : [26, 26],
    iconAnchor: pending ? [14, 14] : [13, 13],
  });
}

function MapController({ center }: { center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 14, { duration: 1.5 });
  }, [center, map]);
  return null;
}

function MapEvents({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({ click: onMapClick });
  return null;
}

function MapCapture({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

type DownloadPhase = "idle" | "confirm" | "downloading" | "done" | "error";

export default function MapPage() {
  const { data: culls = [] } = useCulls();
  const { data: pendingCulls = [] } = usePendingCulls();
  const createMutation = useCreateCull();
  const updateMutation = useUpdateCull();
  const deleteMutation = useDeleteCull();

  const [mapType, setMapType] = useState<"satellite" | "street">("satellite");
  const [selectedPlanYear, setSelectedPlanYear] = useState(getCurrentPlanYear);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCull, setSelectedCull] = useState<CullRecord | null>(null);
  const [editingCull, setEditingCull] = useState<CullRecord | null>(null);
  const [dropCoords, setDropCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [myLocation, setMyLocation] = useState<[number, number] | undefined>(undefined);
  const [locating, setLocating] = useState(false);
  const [gettingGPS, setGettingGPS] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // ── Offline tile download ───────────────────────────────────────────
  const mapRef = useRef<L.Map | null>(null);
  const [downloadPhase, setDownloadPhase] = useState<DownloadPhase>("idle");
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const [pendingTileCount, setPendingTileCount] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const visibleCulls = useMemo(
    () => culls.filter(cull => isInPlanYear(cull.culledAt, selectedPlanYear)),
    [culls, selectedPlanYear],
  );
  const visiblePendingCulls = useMemo(
    () => pendingCulls.filter(cull => isInPlanYear(cull.culledAt, selectedPlanYear)),
    [pendingCulls, selectedPlanYear],
  );
  const visibleCullCount = visibleCulls.length + visiblePendingCulls.length;

  const refreshCachedCount = useCallback(async () => {
    const count = await getCachedTileCount();
    setCachedCount(count);
  }, []);

  useEffect(() => {
    refreshCachedCount();
    handleLocate();
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setMyLocation([pos.coords.latitude, pos.coords.longitude]); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  };

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    setDropCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    setEditingCull(null);
    setShowForm(true);
  };

  const handleFabClick = () => {
    if (!navigator.geolocation) {
      setGpsError("GPS not available on this device. Tap the map to place a pin manually.");
      setDropCoords(myLocation ? { lat: myLocation[0], lng: myLocation[1] } : null);
      setEditingCull(null);
      setShowForm(true);
      return;
    }
    setGettingGPS(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyLocation([coords.lat, coords.lng]);
        setDropCoords(coords);
        setGettingGPS(false);
        setEditingCull(null);
        setShowForm(true);
      },
      () => {
        setGettingGPS(false);
        if (myLocation) {
          setDropCoords({ lat: myLocation[0], lng: myLocation[1] });
          setEditingCull(null);
          setShowForm(true);
        } else {
          setGpsError("Could not get GPS location. Tap the map to place a pin manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFormSubmit = async (data: any) => {
    if (editingCull) {
      await updateMutation.mutateAsync({ id: editingCull.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setShowForm(false);
    setEditingCull(null);
    setDropCoords(null);
  };

  // ── Offline tile download ────────────────────────────────────────────
  const openConfirm = () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const bounds: MapBounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
    setPendingTileCount(countTiles(bounds));
    setDownloadPhase("confirm");
  };

  const handleConfirmDownload = async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const bounds: MapBounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
    const abort = new AbortController();
    abortRef.current = abort;
    setDownloadPhase("downloading");
    setDownloadProgress({ done: 0, total: pendingTileCount });
    setDownloadError(null);
    try {
      await downloadTiles(bounds, (done, total) => setDownloadProgress({ done, total }), abort.signal);
      if (!abort.signal.aborted) { setDownloadPhase("done"); refreshCachedCount(); }
      else setDownloadPhase("idle");
    } catch (e: any) {
      setDownloadError(e?.message || "Download failed. Please try again.");
      setDownloadPhase("error");
    }
  };

  const progressPct = downloadProgress.total > 0
    ? Math.round((downloadProgress.done / downloadProgress.total) * 100)
    : 0;

  return (
    <div className="w-full h-full relative" style={{ background: "#e8e4df" }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        {mapType === "satellite" ? (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxZoom={18}
          />
        ) : (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
            maxZoom={18}
          />
        )}

        <MapCapture mapRef={mapRef} />
        <MapEvents onMapClick={handleMapClick} />
        {myLocation && <MapController center={myLocation} />}

        {myLocation && (
          <Marker
            position={myLocation}
            icon={L.divIcon({
              className: "bg-transparent",
              html: `<div style="position:relative;width:16px;height:16px;">
                <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:1;"></div>
                <div style="position:absolute;inset:-4px;background:rgba(59,130,246,0.25);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
              </div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })}
          />
        )}

        {/* Synced culls */}
        {visibleCulls.map(cull => (
          <Marker
            key={cull.id}
            position={[cull.latitude, cull.longitude]}
            icon={getCustomIcon(getMarkerColor(cull.species, cull.sex))}
            eventHandlers={{ click: () => { setSelectedCull(cull); setShowDetail(true); } }}
          />
        ))}

        {/* Pending (offline) culls — dashed border marker */}
        {visiblePendingCulls.map(cull => (
          <Marker
            key={cull._localId}
            position={[cull.latitude, cull.longitude]}
            icon={getCustomIcon(getMarkerColor(cull.species, cull.sex), true)}
            eventHandlers={{ click: () => { setSelectedCull(cull as CullRecord); setShowDetail(true); } }}
          />
        ))}
      </MapContainer>

      {/* Top-left: cull count */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <div className="glass-panel px-3.5 py-2 rounded-md flex items-center gap-2 pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-sm tabular-nums">{visibleCullCount}</span>
          <span className="text-sm text-muted-foreground font-medium">
            {visibleCullCount === 1 ? "cull" : "culls"} logged
          </span>
          {visiblePendingCulls.length > 0 && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5">
              {visiblePendingCulls.length} unsynced
            </span>
          )}
        </div>
        <label className="sr-only" htmlFor="map-cull-season">Cull season</label>
        <select
          id="map-cull-season"
          value={selectedPlanYear}
          onChange={event => setSelectedPlanYear(Number(event.target.value))}
          className="mt-2 glass-panel h-9 w-full rounded-md px-3 text-xs font-semibold text-foreground shadow-sm outline-none focus:ring-2 focus:ring-primary pointer-events-auto"
        >
          {getAvailablePlanYears().map(year => (
            <option key={year} value={year}>
              Cull season {formatSeasonLabel(year)} (May–Apr)
            </option>
          ))}
        </select>
      </div>

      {/* Top-right: map controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 pointer-events-none items-end">
        <button
          onClick={() => setMapType(m => m === "satellite" ? "street" : "satellite")}
          title={mapType === "satellite" ? "Switch to street map" : "Switch to satellite"}
          className="w-10 h-10 glass-panel rounded-md flex items-center justify-center text-foreground hover:bg-white transition-colors pointer-events-auto shadow-sm"
        >
          {mapType === "satellite" ? <MapIcon className="w-4.5 h-4.5" /> : <Globe className="w-4.5 h-4.5" />}
        </button>

        <button
          onClick={handleLocate}
          title="Centre on my location"
          className={cn(
            "w-10 h-10 glass-panel rounded-md flex items-center justify-center transition-colors pointer-events-auto shadow-sm",
            locating ? "text-primary/60" : "text-primary hover:bg-white"
          )}
        >
          {locating ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <LocateFixed className="w-4.5 h-4.5" />}
        </button>

        {/* Offline tile download */}
        <button
          onClick={() => downloadPhase === "idle" ? openConfirm() : (downloadPhase === "done" || downloadPhase === "error") ? openConfirm() : undefined}
          title="Download map area for offline use"
          className={cn(
            "w-10 h-10 glass-panel rounded-md flex items-center justify-center transition-colors pointer-events-auto shadow-sm",
            downloadPhase === "done" && cachedCount > 0 ? "text-emerald-600 hover:bg-white" : "text-foreground hover:bg-white"
          )}
        >
          {downloadPhase === "downloading"
            ? <Loader2 className="w-4.5 h-4.5 animate-spin text-primary" />
            : downloadPhase === "done" && cachedCount > 0
              ? <CheckCircle2 className="w-4.5 h-4.5" />
              : <CloudDownload className="w-4.5 h-4.5" />
          }
        </button>

        {/* Offline download panel */}
        {(downloadPhase === "confirm" || downloadPhase === "downloading" || downloadPhase === "done" || downloadPhase === "error") && (
          <div className="glass-panel rounded-md shadow-lg p-4 w-64 pointer-events-auto space-y-3">
            {downloadPhase === "confirm" && (
              <>
                <div className="flex items-start gap-2.5">
                  <CloudDownload className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-tight">Download area for offline</p>
                    <p className="text-xs text-muted-foreground mt-1">Saves map tiles so the map works without a signal.</p>
                  </div>
                </div>
                <div className="bg-muted/60 rounded px-3 py-2 text-xs space-y-0.5">
                  <div className="flex justify-between"><span className="text-muted-foreground">Zoom levels</span><span className="font-medium">10–16</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tiles to cache</span><span className="font-medium tabular-nums">{pendingTileCount.toLocaleString()}</span></div>
                  {cachedCount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Already cached</span><span className="font-medium tabular-nums text-emerald-600">{cachedCount.toLocaleString()}</span></div>}
                </div>
                <p className="text-[11px] text-muted-foreground">Zoom to your beat first for best results.</p>
                <div className="flex gap-2">
                  <button onClick={() => setDownloadPhase("idle")} className="flex-1 h-8 rounded border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                  <button onClick={handleConfirmDownload} className="flex-1 h-8 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">Download</button>
                </div>
              </>
            )}
            {downloadPhase === "downloading" && (
              <>
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  <p className="text-sm font-semibold text-foreground">Downloading tiles…</p>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{downloadProgress.done.toLocaleString()} / {downloadProgress.total.toLocaleString()}</span>
                    <span className="font-semibold text-foreground">{progressPct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-150" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <button onClick={() => { abortRef.current?.abort(); setDownloadPhase("idle"); }} className="w-full h-8 rounded border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
              </>
            )}
            {downloadPhase === "done" && (
              <>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Area saved for offline</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cachedCount.toLocaleString()} tiles cached.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => { await clearCachedTiles(); setCachedCount(0); setDownloadPhase("idle"); }} className="flex items-center gap-1.5 h-8 px-3 rounded border border-border text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"><Trash2 className="w-3 h-3" />Clear</button>
                  <button onClick={openConfirm} className="flex-1 h-8 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">Download another area</button>
                </div>
                <button onClick={() => setDownloadPhase("idle")} className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors">Close</button>
              </>
            )}
            {downloadPhase === "error" && (
              <>
                <div className="flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Download failed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{downloadError}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDownloadPhase("idle")} className="flex-1 h-8 rounded border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Dismiss</button>
                  <button onClick={handleConfirmDownload} className="flex-1 h-8 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">Retry</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom: hint + FAB */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2.5 w-full px-4 pointer-events-none">
        {gpsError && (
          <div className="glass-panel px-4 py-2.5 rounded-md flex items-start gap-2.5 max-w-xs w-full pointer-events-auto">
            <span className="text-xs text-destructive font-medium flex-1">{gpsError}</span>
            <button onClick={() => setGpsError(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {!gpsError && (
          <div className="glass-panel px-3.5 py-1.5 rounded-full pointer-events-auto">
            <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
              {gettingGPS ? "Acquiring GPS…" : "Tap map to drop pin"}
            </span>
          </div>
        )}
        <button
          onClick={handleFabClick}
          disabled={gettingGPS}
          className="pointer-events-auto bg-primary text-primary-foreground h-13 px-7 rounded-full shadow-lg shadow-primary/30 flex items-center gap-2.5 hover:-translate-y-0.5 transition-all active:translate-y-0 active:scale-95 disabled:opacity-80 disabled:cursor-wait disabled:translate-y-0 font-semibold text-base"
        >
          {gettingGPS
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Getting GPS…</>
            : <><Plus className="w-5 h-5" /> Log Cull</>
          }
        </button>
      </div>

      <CullForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingCull(null); setDropCoords(null); }}
        onSubmit={handleFormSubmit}
        initialData={editingCull || undefined}
        defaultLat={dropCoords?.lat}
        defaultLng={dropCoords?.lng}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <CullDetailSheet
        cull={showDetail ? selectedCull : null}
        onClose={() => setShowDetail(false)}
        onEdit={cull => {
          // Only allow editing synced records
          if ((cull as any)._pending) return;
          setEditingCull(cull); setShowDetail(false); setShowForm(true);
        }}
        onDelete={async id => {
          if (id < 0) return; // pending — not on server yet
          await deleteMutation.mutateAsync(id);
          setShowDetail(false);
          setSelectedCull(null);
        }}
      />
    </div>
  );
}
