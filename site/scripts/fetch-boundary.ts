/**
 * fetch-boundary — cache the City of Santa Monica municipal boundary polygon
 * for the map's city-limits orientation overlay. Mirrors rcb-database's
 * fetch-boundary.
 *
 * Source: City of Santa Monica "Santa_Monica_city_boundary" ArcGIS
 * FeatureServer (a single polygon feature). Requested in WGS84 (outSR=4326) so
 * it drops straight onto the MapLibre map at the parcel cache's precision.
 *
 * Output (committed, NOT git-ignored): data/geo/city_boundary.geojson
 *
 * Run: `npm run fetch-geo` (or `npx tsx scripts/fetch-boundary.ts`) from site/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  BOUNDARY_GEOJSON,
  BOUNDARY_SERVICE_URL,
  GEO_DIR,
  GEOM_PRECISION,
  fetchJson,
} from "./lib/geo.ts";

type GeoFeature = {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
};

async function main(): Promise<void> {
  const url =
    `${BOUNDARY_SERVICE_URL}/query?where=1%3D1` +
    `&outFields=*&returnGeometry=true&outSR=4326` +
    `&geometryPrecision=${GEOM_PRECISION}&f=geojson`;

  const body = await fetchJson<{ features?: GeoFeature[] }>(url);
  const feats = body.features ?? [];
  if (feats.length === 0) {
    throw new Error("City boundary layer returned no features — endpoint changed?");
  }

  const features: GeoFeature[] = feats.map((f) => ({
    type: "Feature",
    geometry: f.geometry,
    properties: { name: "City of Santa Monica" },
  }));

  const out = {
    type: "FeatureCollection",
    metadata: {
      source: BOUNDARY_SERVICE_URL,
      out_sr: 4326,
      geometry_precision: GEOM_PRECISION,
      feature_count: features.length,
      generated_by: "site/scripts/fetch-boundary.ts",
    },
    features,
  };

  mkdirSync(GEO_DIR, { recursive: true });
  writeFileSync(BOUNDARY_GEOJSON, JSON.stringify(out, null, 2) + "\n");
  process.stdout.write(
    `Wrote ${features.length} boundary feature(s) to ${BOUNDARY_GEOJSON}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`fetch-boundary failed: ${String(err)}\n`);
  process.exit(1);
});
