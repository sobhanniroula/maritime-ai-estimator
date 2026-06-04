export interface EmodnetDepthResult {
  depthM: number;
  dataSource: string;
}

/** Creates a fetch with a manual timeout via AbortController (more compatible than AbortSignal.timeout). */
function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal, cache: "no-store" }).finally(() =>
    clearTimeout(id),
  );
}

/** Parses an ASCII Grid (AAIGrid) text response and returns the raw elevation number. */
function parseAsciiGrid(text: string): number | null {
  let nodataVal = -9999;
  let elevation: number | null = null;

  for (const line of text.trim().split(/\r?\n/)) {
    const t = line.trim();
    if (t.toLowerCase().startsWith("nodata_value")) {
      nodataVal = parseFloat(t.split(/\s+/)[1]);
    } else if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(t)) {
      elevation = parseFloat(t);
    }
  }

  if (elevation === null || elevation === nodataVal || Math.abs(elevation) > 9000)
    return null;
  return elevation;
}

/**
 * EMODnet Bathymetry WCS — European waters, ~115 m resolution.
 * Tries both CRS:84 (lon,lat) and EPSG:4326 (lat,lon strict axis order).
 */
async function tryEmodnet(
  lat: number,
  lng: number,
): Promise<EmodnetDepthResult | null> {
  const d = 0.01;
  const base = "https://ows.emodnet-bathymetry.eu/wcs";

  const bboxAttempts = [
    // CRS:84 — OGC standard for geographic lon-first; most GeoServer deployments accept this
    `SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=emodnet:mean&CRS=CRS:84&BBOX=${lng - d},${lat - d},${lng + d},${lat + d}&WIDTH=1&HEIGHT=1&FORMAT=image/x-aaigrid`,
    // EPSG:4326 strict axis order is lat,lon
    `SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=emodnet:mean&CRS=EPSG:4326&BBOX=${lat - d},${lng - d},${lat + d},${lng + d}&WIDTH=1&HEIGHT=1&FORMAT=image/x-aaigrid`,
  ];

  for (const qs of bboxAttempts) {
    try {
      console.log("[depth] EMODnet attempt:", `${base}?${qs}`);
      const res = await fetchWithTimeout(`${base}?${qs}`, 8000);
      console.log("[depth] EMODnet status:", res.status);

      if (!res.ok) continue;

      const text = await res.text();
      console.log("[depth] EMODnet body (first 200):", text.slice(0, 200));

      if (text.startsWith("<") || text.includes("Exception")) continue;

      const elev = parseAsciiGrid(text);
      console.log("[depth] EMODnet parsed elevation:", elev);

      if (elev === null || elev >= 0) continue;

      const depthM = Math.round(Math.abs(elev) * 10) / 10;
      if (depthM < 0.1) continue;

      return { depthM, dataSource: "EMODnet Bathymetry (~115 m grid)" };
    } catch (err) {
      console.log("[depth] EMODnet error:", err);
      continue;
    }
  }

  return null;
}

/**
 * opentopodata.org — free global API, no key required.
 * Uses ETOPO1 (1 arc-min, ~1.8 km) which reliably covers ocean depth worldwide.
 * Negative elevation = below sea level.
 */
async function tryOpenTopoData(
  lat: number,
  lng: number,
): Promise<EmodnetDepthResult | null> {
  const url = `https://api.opentopodata.org/v1/etopo1?locations=${lat},${lng}`;

  try {
    console.log("[depth] opentopodata attempt:", url);
    const res = await fetchWithTimeout(url, 10000);
    console.log("[depth] opentopodata status:", res.status);

    if (!res.ok) {
      const errText = await res.text();
      console.log("[depth] opentopodata error body:", errText.slice(0, 200));
      return null;
    }

    const json = await res.json();
    console.log("[depth] opentopodata response:", JSON.stringify(json));

    if (json.status !== "OK" || !json.results?.[0]) return null;

    const elev = json.results[0].elevation;
    if (typeof elev !== "number" || elev >= 0) return null;

    const depthM = Math.round(Math.abs(elev) * 10) / 10;
    if (depthM < 0.1) return null;

    return { depthM, dataSource: "ETOPO1 (~1.8 km grid)" };
  } catch (err) {
    console.log("[depth] opentopodata error:", err);
    return null;
  }
}

/**
 * Returns an estimated water depth for the given coordinate.
 * Primary: EMODnet Bathymetry (European waters, ~115 m resolution).
 * Fallback: ETOPO1 via opentopodata.org (global, ~1.8 km resolution).
 * Returns null if both sources fail or the location is on land.
 */
export async function getEmodnetDepth(
  lat: number,
  lng: number,
): Promise<EmodnetDepthResult | null> {
  const result = (await tryEmodnet(lat, lng)) ?? (await tryOpenTopoData(lat, lng));
  console.log("[depth] final result for", lat, lng, ":", result);
  return result;
}
