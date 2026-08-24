/**
 * Offline map tile utilities.
 * Downloads and caches map tiles so the app works without a data connection.
 */

const CACHE_NAME = "deer-cull-tiles-v1";

// ── Tile maths ─────────────────────────────────────────────────────────

function latLngToTile(lat: number, lng: number, zoom: number) {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
  return { x, y };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const MIN_ZOOM = 10;
const MAX_ZOOM = 16;

/** Count tiles (both layers) without building the full URL list. */
export function countTiles(bounds: MapBounds): number {
  let count = 0;
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const nw = latLngToTile(bounds.north, bounds.west, z);
    const se = latLngToTile(bounds.south, bounds.east, z);
    count += (se.x - nw.x + 1) * (se.y - nw.y + 1);
  }
  return count * 2; // satellite + street layers
}

function getTileUrls(bounds: MapBounds): string[] {
  const urls: string[] = [];
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const nw = latLngToTile(bounds.north, bounds.west, z);
    const se = latLngToTile(bounds.south, bounds.east, z);
    for (let x = nw.x; x <= se.x; x++) {
      for (let y = nw.y; y <= se.y; y++) {
        // Esri satellite  ─ note: Esri uses /tile/{z}/{y}/{x}
        urls.push(
          `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
        );
        // OpenStreetMap (street view)
        urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }
  return urls;
}

// ── Cache API helpers ───────────────────────────────────────────────────

/** Returns the total number of cached tile entries. */
export async function getCachedTileCount(): Promise<number> {
  if (!("caches" in window)) return 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

/** Deletes the entire tile cache. */
export async function clearCachedTiles(): Promise<void> {
  if (!("caches" in window)) return;
  await caches.delete(CACHE_NAME);
}

/**
 * Downloads and caches every tile that covers the given bounds
 * at zoom levels 10–16 (both satellite and street layers).
 *
 * @param bounds   The map area to cache.
 * @param onProgress  Called after each tile with (done, total).
 * @param signal   Optional AbortSignal to cancel mid-download.
 */
export async function downloadTiles(
  bounds: MapBounds,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!("caches" in window)) {
    throw new Error("This browser does not support offline caching.");
  }

  const urls = getTileUrls(bounds);
  const cache = await caches.open(CACHE_NAME);
  let done = 0;

  for (const url of urls) {
    if (signal?.aborted) break;
    try {
      const existing = await cache.match(url);
      if (!existing) {
        const res = await fetch(url, { mode: "no-cors" });
        // Cache opaque (no-cors) responses — they display fine as tile images
        await cache.put(url, res);
      }
    } catch {
      // Network or CORS failure — skip this tile; it may load from network later
    }
    done++;
    onProgress(done, urls.length);
  }
}

/** Register the service worker so cached tiles are served while offline. */
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL }
    );
  } catch (e) {
    console.warn("Service worker registration failed:", e);
  }
}
