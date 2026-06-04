import { NextRequest } from "next/server";
import { getEmodnetDepth } from "@/tools/emodnetDepth";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  if (debug) {
    // Diagnostic mode: test each source individually and return raw results.
    // Call: /api/depth?lat=60.17&lng=24.94&debug=1
    const fetchWithTimeout = (url: string, ms: number) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { signal: ctrl.signal, cache: "no-store" }).finally(
        () => clearTimeout(id),
      );
    };

    const emodnetUrl = `https://ows.emodnet-bathymetry.eu/wcs?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=emodnet:mean&CRS=CRS:84&BBOX=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&WIDTH=1&HEIGHT=1&FORMAT=image/x-aaigrid`;
    const opentopoUrl = `https://api.opentopodata.org/v1/etopo1?locations=${lat},${lng}`;

    const [emodnetRaw, opentopoRaw] = await Promise.allSettled([
      fetchWithTimeout(emodnetUrl, 8000).then(async (r) => ({
        status: r.status,
        ok: r.ok,
        body: await r.text(),
      })),
      fetchWithTimeout(opentopoUrl, 10000).then(async (r) => ({
        status: r.status,
        ok: r.ok,
        body: await r.text(),
      })),
    ]);

    return Response.json({
      coords: { lat, lng },
      emodnet: emodnetRaw.status === "fulfilled" ? emodnetRaw.value : { error: String((emodnetRaw as PromiseRejectedResult).reason) },
      opentopodata: opentopoRaw.status === "fulfilled" ? opentopoRaw.value : { error: String((opentopoRaw as PromiseRejectedResult).reason) },
    });
  }

  const result = await getEmodnetDepth(lat, lng);
  return Response.json(result);
}
