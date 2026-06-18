/**
 * fetch-geometry — match each Prop R development to City parcel polygon(s) and
 * cache the result as a committed GeoJSON the map consumes.
 *
 * Source: City of Santa Monica "Parcels Public" ArcGIS FeatureServer (the same
 * service rcb-database uses). The parcel layer exposes `situsfulla` (full situs
 * address, uppercase, abbreviated suffixes) and `ain` (== APN). There are no
 * separate street-number / street-name fields, so we match on `situsfulla`.
 *
 * Match strategy (keyed by the CSV's stable `dev_id`):
 *   1. Read data/curated/developments.csv.
 *   2. Group rows by their normalized street ("Lincoln Blvd" -> "LINCOLN BLVD",
 *      "17th Street" -> "17TH ST"). Query the parcel layer ONCE per street with
 *      a `situsfulla LIKE '%<STREET>%'` filter, returning geometry in WGS84.
 *      One network call per distinct street keeps us polite and cache-friendly.
 *   3. For each development, expand its address into a set of street numbers
 *      (a plain number, or every number across a RANGE like 2903-2931), then
 *      keep every street parcel whose leading situs number is in that set.
 *      A development may therefore match MULTIPLE parcels (multi-parcel sites);
 *      we emit one Feature per matched parcel, all sharing the dev_id.
 *   4. Developments with zero matched parcels are recorded in unmatched.json
 *      (with an approximate lon/lat centroid from the ArcGIS geocoder when we
 *      can resolve one) so the map can drop a point marker instead.
 *
 * Outputs (committed, NOT git-ignored):
 *   - data/geo/parcels.geojson   FeatureCollection, one feature per matched parcel
 *   - data/geo/unmatched.json    array of {dev_id, address, street, reason, lon?, lat?}
 *
 * Run: `npm run fetch-geo`  (or `npx tsx scripts/fetch-geometry.ts`) from site/.
 */
import { parse } from "csv-parse/sync";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  DEVELOPMENTS_CSV,
  GEO_DIR,
  GEOM_PRECISION,
  PARCELS_GEOJSON,
  PARCELS_SERVICE_URL,
  POLITE_DELAY_MS,
  UNMATCHED_JSON,
  USER_AGENT,
  expandAddressNumbers,
  fetchJson,
  normalizeStreet,
  parseSitusNumber,
  parseSitusStreetCore,
  sleep,
} from "./lib/geo.ts";

type Row = Record<string, string>;

type GeoFeature = {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
};

type ParcelHit = {
  ain: string;
  situs: string;
  num: number | null;
  streetCore: string;
  geometry: unknown;
  usetype: string;
  usedescrip: string;
};

type Unmatched = {
  dev_id: string;
  address: string;
  street: string;
  reason: string;
  lon?: number;
  lat?: number;
};

function readCsv(file: string): Row[] {
  return parse(readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];
}

/** Escape a value for an ArcGIS SQL LIKE clause (single quotes -> doubled). */
function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * Query the parcel layer for every parcel whose situs address contains the
 * given street core. Returns the parcels with geometry (paged, though one
 * street rarely exceeds the page size).
 */
async function fetchParcelsForStreet(streetCore: string): Promise<ParcelHit[]> {
  const where = encodeURIComponent(`situsfulla LIKE '%${sqlEscape(streetCore)}%'`);
  const hits: ParcelHit[] = [];
  const PAGE = 2000;
  let offset = 0;
  for (;;) {
    const url =
      `${PARCELS_SERVICE_URL}/query?where=${where}` +
      `&outFields=ain,situsfulla,usetype,usedescrip&returnGeometry=true&outSR=4326` +
      `&geometryPrecision=${GEOM_PRECISION}` +
      `&resultOffset=${offset}&resultRecordCount=${PAGE}&f=geojson`;
    const body = await fetchJson<{ features?: GeoFeature[] }>(url);
    const feats = body.features ?? [];
    for (const f of feats) {
      const p = f.properties as Record<string, unknown>;
      const situs = String(p.situsfulla ?? "").trim();
      hits.push({
        ain: String(p.ain ?? "").trim(),
        situs,
        num: parseSitusNumber(situs),
        streetCore: parseSitusStreetCore(situs),
        geometry: f.geometry,
        usetype: String(p.usetype ?? "").trim(),
        usedescrip: String(p.usedescrip ?? "").trim(),
      });
    }
    if (feats.length < PAGE) break;
    offset += PAGE;
    await sleep(POLITE_DELAY_MS);
  }
  return hits;
}

/**
 * Best-effort approximate point for an unmatched development, via the public
 * ArcGIS World Geocoder (no token, light use). Returns null on any failure so
 * the map step can place the point itself.
 */
async function geocodeApprox(
  address: string,
  street: string,
): Promise<{ lon: number; lat: number } | null> {
  // Use the low number of a range as the single-line address.
  const num = address.split("-")[0].trim();
  const single = `${num} ${street}, Santa Monica, CA`;
  const url =
    "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates" +
    `?singleLine=${encodeURIComponent(single)}&outFields=&maxLocations=1` +
    `&category=Address,Street%20Address&f=json`;
  try {
    const body = await fetchJson<{
      candidates?: { location?: { x: number; y: number }; score?: number }[];
    }>(url);
    const c = body.candidates?.[0];
    if (c?.location && (c.score ?? 0) >= 80) {
      return { lon: c.location.x, lat: c.location.y };
    }
  } catch {
    /* ignore — geocoder is best-effort */
  }
  return null;
}

async function main(): Promise<void> {
  const rows = readCsv(DEVELOPMENTS_CSV);
  process.stdout.write(`Read ${rows.length} developments from ${DEVELOPMENTS_CSV}\n`);

  // Group developments by normalized street so we make one query per street.
  const streetToCore = new Map<string, string>(); // rawStreet -> LIKE core
  const byStreet = new Map<string, Row[]>(); // rawStreet -> rows
  for (const r of rows) {
    const street = (r.street ?? "").trim();
    if (!byStreet.has(street)) {
      byStreet.set(street, []);
      streetToCore.set(street, normalizeStreet(street).core);
    }
    byStreet.get(street)!.push(r);
  }
  process.stdout.write(`Distinct streets to query: ${byStreet.size}\n`);

  // Fetch the parcel set for every distinct street (cached per street core so
  // streets that normalize identically share one network call).
  const coreCache = new Map<string, ParcelHit[]>();
  for (const [street, core] of streetToCore) {
    if (!core) continue;
    if (coreCache.has(core)) continue;
    process.stdout.write(`  querying parcels for "${core}" ...`);
    let parcels: ParcelHit[] = [];
    try {
      parcels = await fetchParcelsForStreet(core);
    } catch (err) {
      process.stdout.write(` FAILED (${String(err)})\n`);
      coreCache.set(core, []);
      continue;
    }
    process.stdout.write(` ${parcels.length} parcels\n`);
    coreCache.set(core, parcels);
    await sleep(POLITE_DELAY_MS);
  }

  // Match each development to parcels by street-number membership.
  const features: GeoFeature[] = [];
  const unmatched: Unmatched[] = [];
  let matchedDevs = 0;

  for (const r of rows) {
    const devId = r.dev_id;
    const street = (r.street ?? "").trim();
    const address = (r.address ?? "").trim();
    const core = streetToCore.get(street) ?? "";
    const hasSuffix = normalizeStreet(street).suffix !== null;
    const parcels = coreCache.get(core) ?? [];
    const { numbers } = expandAddressNumbers(address);
    const wanted = new Set(numbers);

    // Require BOTH the street number AND a street-core match, so a LIKE query
    // for "5TH ST" cannot leak "15TH ST" / "25TH ST" parcels in. When the CSV
    // street carries no recognizable suffix (e.g. "10th", "Berkeley"), accept a
    // parcel whose core is the name optionally followed by one suffix token
    // (e.g. dev core "10TH" matches parcel core "10TH ST"); otherwise require
    // exact equality.
    const coreMatches = (parcelCore: string): boolean => {
      if (parcelCore === core) return true;
      if (!hasSuffix && parcelCore.startsWith(core + " ")) {
        // Only the suffix token may follow (a single word), not a different
        // street that merely starts with the same name.
        const rest = parcelCore.slice(core.length + 1);
        return !rest.includes(" ");
      }
      return false;
    };
    const matches = parcels.filter(
      (p) => p.num !== null && wanted.has(p.num) && coreMatches(p.streetCore),
    );

    // De-dup by AIN within a single development (a street query can return the
    // same parcel once; this guards against accidental repeats).
    const seen = new Set<string>();
    const devFeatures: GeoFeature[] = [];
    for (const m of matches) {
      if (m.ain && seen.has(m.ain)) continue;
      if (m.ain) seen.add(m.ain);
      devFeatures.push({
        type: "Feature",
        geometry: m.geometry,
        properties: {
          dev_id: devId,
          category: r.category ?? "",
          total_units: r.total_units === "" ? null : Number(r.total_units),
          address,
          street,
          apn: m.ain,
          ain: m.ain,
          situs_address: m.situs,
          usetype: m.usetype,
          usedescrip: m.usedescrip,
        },
      });
    }

    if (devFeatures.length > 0) {
      matchedDevs++;
      features.push(...devFeatures);
    } else {
      const reason =
        parcels.length === 0
          ? `no parcels returned for street "${core || street}"`
          : `no parcel on "${core || street}" matched address number(s) ${[...wanted].join(", ") || "(none)"}`;
      const u: Unmatched = { dev_id: devId, address, street, reason };
      const approx = await geocodeApprox(address, street);
      if (approx) {
        u.lon = approx.lon;
        u.lat = approx.lat;
      }
      unmatched.push(u);
      await sleep(POLITE_DELAY_MS);
    }
  }

  // Deterministic order so re-runs diff cleanly in git.
  features.sort((a, b) => {
    const da = String(a.properties.dev_id);
    const db = String(b.properties.dev_id);
    if (da !== db) return da.localeCompare(db);
    return String(a.properties.apn).localeCompare(String(b.properties.apn));
  });
  unmatched.sort((a, b) => a.dev_id.localeCompare(b.dev_id));

  const out = {
    type: "FeatureCollection",
    metadata: {
      source: PARCELS_SERVICE_URL,
      join_key: "dev_id",
      parcel_id_field: "ain",
      out_sr: 4326,
      geometry_precision: GEOM_PRECISION,
      total_developments: rows.length,
      matched_developments: matchedDevs,
      unmatched_developments: unmatched.length,
      matched_parcel_features: features.length,
      generated_by: "site/scripts/fetch-geometry.ts",
    },
    features,
  };

  mkdirSync(GEO_DIR, { recursive: true });
  writeFileSync(PARCELS_GEOJSON, JSON.stringify(out, null, 2) + "\n");
  writeFileSync(UNMATCHED_JSON, JSON.stringify(unmatched, null, 2) + "\n");

  process.stdout.write(
    `\nDevelopments:           ${rows.length}\n` +
      `Matched (>=1 parcel):   ${matchedDevs}\n` +
      `Unmatched (0 parcels):  ${unmatched.length}\n` +
      `Parcel features written: ${features.length}\n` +
      `\nWrote ${PARCELS_GEOJSON}\n` +
      `Wrote ${UNMATCHED_JSON}\n`,
  );
  if (unmatched.length) {
    process.stdout.write(
      `\nUnmatched dev_ids:\n` +
        unmatched.map((u) => `  - ${u.dev_id} (${u.reason})`).join("\n") +
        "\n",
    );
  }
}

main().catch((err) => {
  process.stderr.write(`fetch-geometry failed: ${String(err)}\n`);
  process.exit(1);
});
