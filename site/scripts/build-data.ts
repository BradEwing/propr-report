/**
 * Build-time data pipeline.
 *
 * Reads the committed curated CSVs from the repo's `data/curated/` directory and
 * emits the client-facing JSON into `site/public/data/`. That output directory is
 * git-ignored: it is regenerated on every build via the `prebuild` hook.
 *
 * A later agent extends this script to merge parcel geometry and emit GeoJSON.
 * For now it produces:
 *   - cumulative.json    (the cumulative achievements time series)
 *   - developments.json  (the address-level developments; empty until curated)
 */
import { parse } from 'csv-parse/sync';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url)); // site/scripts
const siteDir = resolve(scriptDir, '..'); // site
const repoRoot = resolve(siteDir, '..'); // repo root
const curatedDir = resolve(repoRoot, 'data', 'curated');
const geoDir = resolve(repoRoot, 'data', 'geo');
const outDir = resolve(siteDir, 'public', 'data');

/** Columns from developments.csv coerced to numbers when merged into GeoJSON. */
const DEV_NUMERIC = new Set([
  'eli',
  'vli',
  'li',
  'moderate',
  'above_moderate',
  'affordable_units',
  'market_units',
  'total_units',
]);

/** Numeric columns in the cumulative series (kept as numbers; blanks -> null). */
const CUMULATIVE_NUMERIC = new Set([
  'total_residences',
  'market_rate_residences',
  'affordable_residences',
  'pct_affordable',
  'pct_very_low_and_low_income',
  'city_funded_affordable_residences',
  'pct_affordable_city_funded',
]);

type Row = Record<string, string>;

function readCsv(file: string): Row[] {
  const text = readFileSync(file, 'utf8');
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];
}

/** Coerce listed columns to numbers (blank cell -> null), leave the rest as strings. */
function coerceNumbers(rows: Row[], numericCols: Set<string>): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (numericCols.has(key)) {
        out[key] = value === '' ? null : Number(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  });
}

function writeJson(name: string, data: unknown): void {
  const target = resolve(outDir, name);
  writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
  const count = Array.isArray(data) ? data.length : '?';
  console.log(`  wrote ${name} (${count} rows)`);
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

type GeoFeature = {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
};
type GeoCollection = { type: 'FeatureCollection'; features: GeoFeature[] };

/** Build the per-feature properties for a development, coercing numeric fields. */
function devProperties(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = DEV_NUMERIC.has(key) ? (value === '' ? null : Number(value)) : value;
  }
  return out;
}

/**
 * Emit the map artifacts:
 *   - developments.geojson : parcel polygons + point fallbacks, each carrying the
 *     full development record merged from developments.csv (joined on dev_id).
 *   - boundary.geojson     : the Santa Monica city boundary (orientation overlay).
 */
function buildMapArtifacts(devRows: Row[]): void {
  const parcelsPath = resolve(geoDir, 'parcels.geojson');
  const unmatchedPath = resolve(geoDir, 'unmatched.json');
  const boundaryPath = resolve(geoDir, 'city_boundary.geojson');

  // Index developments by their join key.
  const devById = new Map<string, Row>();
  for (const row of devRows) {
    if (row.dev_id) devById.set(row.dev_id, row);
  }

  const features: GeoFeature[] = [];
  let polygonCount = 0;
  let pointCount = 0;

  // 1. Polygon features from matched parcels, merged with the development record.
  if (existsSync(parcelsPath)) {
    const parcels = readJson<GeoCollection>(parcelsPath);
    for (const f of parcels.features) {
      const devId = String(f.properties?.dev_id ?? '');
      const dev = devById.get(devId);
      if (!dev) {
        console.warn(`  warning: parcel dev_id "${devId}" not found in developments.csv; skipping`);
        continue;
      }
      features.push({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          ...devProperties(dev),
          apn: f.properties?.apn ?? null,
          ain: f.properties?.ain ?? null,
          is_point: false,
        },
      });
      polygonCount += 1;
    }
  } else {
    console.warn(`  warning: ${parcelsPath} not found; no polygon features emitted`);
  }

  // 2. Point fallback features for unmatched developments that have coordinates.
  if (existsSync(unmatchedPath)) {
    const unmatched = readJson<Array<Record<string, unknown>>>(unmatchedPath);
    for (const u of unmatched) {
      const devId = String(u.dev_id ?? '');
      const lon = typeof u.lon === 'number' ? u.lon : undefined;
      const lat = typeof u.lat === 'number' ? u.lat : undefined;
      const dev = devById.get(devId);
      if (!dev) {
        console.warn(`  warning: unmatched dev_id "${devId}" not in developments.csv; skipping`);
        continue;
      }
      if (lon === undefined || lat === undefined) {
        console.warn(`  warning: unmatched dev_id "${devId}" has no parcel and no coords; skipping`);
        continue;
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          ...devProperties(dev),
          apn: null,
          ain: null,
          is_point: true,
        },
      });
      pointCount += 1;
    }
  } else {
    console.warn(`  warning: ${unmatchedPath} not found; no point fallback features emitted`);
  }

  writeJson('developments.geojson', {
    type: 'FeatureCollection',
    features,
  });
  console.log(`    -> ${polygonCount} polygon features, ${pointCount} point features`);

  // 3. City boundary overlay (normalized to a bare FeatureCollection).
  if (existsSync(boundaryPath)) {
    const boundary = readJson<GeoCollection>(boundaryPath);
    writeJson('boundary.geojson', {
      type: 'FeatureCollection',
      features: boundary.features,
    });
  } else {
    console.warn(`  warning: ${boundaryPath} not found; emitting empty boundary.geojson`);
    writeJson('boundary.geojson', { type: 'FeatureCollection', features: [] });
  }
}

function main(): void {
  mkdirSync(outDir, { recursive: true });
  console.log(`build-data: curated=${curatedDir}`);
  console.log(`build-data: out=${outDir}`);

  // 1. Cumulative achievements time series (required input).
  const cumulativePath = resolve(curatedDir, 'cumulative_prop_r_achievements.csv');
  if (!existsSync(cumulativePath)) {
    throw new Error(`Missing required input: ${cumulativePath}`);
  }
  const cumulative = coerceNumbers(readCsv(cumulativePath), CUMULATIVE_NUMERIC);
  writeJson('cumulative.json', cumulative);

  // 2. Address-level developments (optional until curated; never break the build).
  const developmentsPath = resolve(curatedDir, 'developments.csv');
  let developments: Row[] = [];
  if (existsSync(developmentsPath)) {
    developments = readCsv(developmentsPath);
    writeJson('developments.json', developments);
  } else {
    console.warn(
      `  warning: ${developmentsPath} not found; emitting empty developments.json`,
    );
    writeJson('developments.json', []);
  }

  // 3. Map artifacts (developments.geojson + boundary.geojson).
  buildMapArtifacts(developments);

  console.log('build-data: done');
}

main();
