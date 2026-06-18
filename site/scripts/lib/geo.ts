/**
 * Shared helpers for the geo-fetch scripts (fetch-geometry, fetch-boundary).
 *
 * Paths resolve relative to the repo root so the scripts can run from `site/`.
 * The committed outputs live under `data/geo/` (NOT git-ignored — they are
 * cached external inputs the map consumes at build time).
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url)); // site/scripts/lib
export const SITE_DIR = resolve(scriptDir, "..", ".."); // site
export const REPO_ROOT = resolve(SITE_DIR, ".."); // repo root

export const DEVELOPMENTS_CSV = resolve(
  REPO_ROOT,
  "data",
  "curated",
  "developments.csv",
);
export const GEO_DIR = resolve(REPO_ROOT, "data", "geo");
export const PARCELS_GEOJSON = resolve(GEO_DIR, "parcels.geojson");
export const BOUNDARY_GEOJSON = resolve(GEO_DIR, "city_boundary.geojson");
export const UNMATCHED_JSON = resolve(GEO_DIR, "unmatched.json");

/**
 * City of Santa Monica "Parcels Public" ArcGIS FeatureServer — the same source
 * rcb-database's fetch-geometry uses. Join field is `ain` (LA County Assessor
 * Identification Number, == APN). `situsfulla` holds the full situs address as
 * `<NUMBER> <STREET NAME> <SUFFIX> SANTA MONICA CA <ZIP>` (uppercase,
 * abbreviated suffixes: BLVD, AVE, ST, ...).
 */
export const PARCELS_SERVICE_URL =
  "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Santa_Monica_public_parcels/FeatureServer/0";

/** City of Santa Monica municipal boundary polygon (single feature). */
export const BOUNDARY_SERVICE_URL =
  "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Santa_Monica_city_boundary/FeatureServer/0";

export const USER_AGENT =
  "propr-report geo cache (https://github.com/BradEwing/propr-report) - Santa Monica Prop R map";

export const GEOM_PRECISION = 6; // ~0.1 m; trims file size, plenty for a city map
export const POLITE_DELAY_MS = 300; // be gentle to the City's public GIS server

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Fetch JSON with modest retry/backoff. Polite to a public GIS service. */
export async function fetchJson<T>(url: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 429 || res.status === 503) {
        const wait = (attempt + 1) * 2000;
        process.stderr.write(`  ${res.status}; backing off ${wait}ms\n`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const body = (await res.json()) as T & { error?: unknown };
      if (body && (body as { error?: unknown }).error) {
        throw new Error(`ArcGIS error: ${JSON.stringify((body as { error?: unknown }).error)}`);
      }
      return body as T;
    } catch (err) {
      lastErr = err;
      await sleep((attempt + 1) * 1000);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${String(lastErr)}`);
}

/**
 * Normalize a street-suffix word to the abbreviation the parcel layer uses in
 * `situsfulla`. Unknown suffixes pass through uppercased.
 */
const SUFFIX_MAP: Record<string, string> = {
  BOULEVARD: "BLVD",
  BLVD: "BLVD",
  AVENUE: "AVE",
  AVE: "AVE",
  STREET: "ST",
  ST: "ST",
  DRIVE: "DR",
  DR: "DR",
  PLACE: "PL",
  PL: "PL",
  ROAD: "RD",
  RD: "RD",
  COURT: "CT",
  CT: "CT",
  LANE: "LN",
  LN: "LN",
  WAY: "WAY",
  TERRACE: "TER",
  TER: "TER",
  CIRCLE: "CIR",
  CIR: "CIR",
};

/**
 * Build the LIKE search core for a street: the street name plus its normalized
 * suffix, uppercased. e.g. "Lincoln Blvd" -> "LINCOLN BLVD",
 * "17th Street" -> "17TH ST", "Santa Monica Blvd" -> "SANTA MONICA BLVD".
 * Trailing punctuation (e.g. "Franklin St.") is stripped. If no recognizable
 * suffix is present, returns just the uppercased name (broader match).
 */
export function normalizeStreet(street: string): { core: string; suffix: string | null } {
  const cleaned = street.trim().replace(/\./g, "").replace(/\s+/g, " ");
  if (!cleaned) return { core: "", suffix: null };
  const parts = cleaned.toUpperCase().split(" ");
  const last = parts[parts.length - 1];
  const mapped = SUFFIX_MAP[last];
  if (mapped && parts.length > 1) {
    const name = parts.slice(0, -1).join(" ");
    return { core: `${name} ${mapped}`, suffix: mapped };
  }
  return { core: parts.join(" "), suffix: null };
}

/**
 * Expand an address cell into the set of street numbers it covers.
 * Plain "1413" -> [1413]. A range "2903-2931" -> every number from 2903..2931
 * (capped). Returns numbers as strings for exact-token comparison plus the
 * numeric low/high for range tests.
 */
export function expandAddressNumbers(address: string): {
  numbers: number[];
  low: number | null;
  high: number | null;
} {
  const a = address.trim();
  const range = a.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    let lo = parseInt(range[1], 10);
    let hi = parseInt(range[2], 10);
    // Some "ranges" repeat the leading digits only on the high side
    // (e.g. 1650-1660). Treat lo>hi defensively by swapping.
    if (lo > hi) [lo, hi] = [hi, lo];
    const nums: number[] = [];
    // Cap the expansion so a malformed range can't explode; real parcel runs
    // on one block are short. We still record low/high for endpoint matching.
    const CAP = 200;
    for (let n = lo; n <= hi && nums.length < CAP; n++) nums.push(n);
    return { numbers: nums, low: lo, high: hi };
  }
  const single = a.match(/^(\d+)/);
  if (single) {
    const n = parseInt(single[1], 10);
    return { numbers: [n], low: n, high: n };
  }
  return { numbers: [], low: null, high: null };
}

/** Parse the leading street number out of a parcel `situsfulla` string. */
export function parseSitusNumber(situs: string): number | null {
  const m = situs.trim().match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Extract the street "core" (NAME + SUFFIX) from a parcel `situsfulla`, dropping
 * the leading number, any unit/suite token, and the trailing
 * "SANTA MONICA CA <ZIP>". e.g.
 *   "1418 15TH ST SANTA MONICA CA 90404"      -> "15TH ST"
 *   "1419 15TH ST 3 SANTA MONICA CA 90404"    -> "15TH ST"
 *   "2601 LINCOLN BLVD SANTA MONICA CA 90405" -> "LINCOLN BLVD"
 * Returns "" if it can't be parsed. Used to reject LIKE false-positives where
 * "%5TH ST%" also matches "15TH ST" / "25TH ST".
 */
export function parseSitusStreetCore(situs: string): string {
  let s = situs.trim().toUpperCase();
  // Drop a trailing "SANTA MONICA CA <ZIP>" (zip optional).
  s = s.replace(/\s+SANTA MONICA\s+CA(\s+\d{5}(-\d{4})?)?\s*$/, "");
  // Drop the leading street number.
  s = s.replace(/^\d+\s+/, "");
  // Collapse whitespace first so multi-space unit tokens ("UNIT   D") parse.
  s = s.replace(/\s+/g, " ").trim();
  // Drop a trailing unit token introduced by a keyword: "UNIT D", "NO 1-6",
  // "STE 200", "APT 3", "# 5", "SP 12".
  s = s.replace(/\s+(NO|UNIT|STE|SUITE|APT|SP|#)\s+\S+$/i, "").trim();
  // Drop a bare trailing unit token (a lone number or single letter) left after
  // the street suffix, e.g. "15TH ST 3" -> "15TH ST", "5TH ST D" -> "5TH ST".
  s = s.replace(/\s+(\d+[A-Z]?|[A-Z])$/i, "").trim();
  return s;
}
