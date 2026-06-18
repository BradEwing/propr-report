# `data/geo/` — committed geo inputs for the map

These files are **cached external inputs** consumed by the map at build time. They are
**committed** (not git-ignored) so the site builds without a live network call. Regenerate them
only occasionally (see below) — they change rarely.

| File | What it is |
|------|------------|
| `parcels.geojson` | One polygon **per matched parcel**; a development may span several. Join to the developments dataset on `dev_id`. |
| `city_boundary.geojson` | The City of Santa Monica municipal boundary polygon (single feature), for map orientation. |
| `unmatched.json` | Developments that matched **zero** parcels; the map renders these as **point markers** instead. |

## Source services (City of Santa Monica Parcels Public ArcGIS — same source rcb-database uses)

- **Parcels** (`fetch-geometry.ts`):
  `https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Santa_Monica_public_parcels/FeatureServer/0`
  Relevant fields: `ain` (LA County Assessor Identification Number == APN), `situsfulla`
  (full situs address, uppercase, abbreviated suffixes, e.g. `2601 LINCOLN BLVD SANTA MONICA CA 90405`),
  `usetype`, `usedescrip`. The layer has **no** separate street-number / street-name fields.
- **City boundary** (`fetch-boundary.ts`):
  `https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Santa_Monica_city_boundary/FeatureServer/0`
- **Approximate geocoder** (fallback for unmatched developments, best-effort):
  `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates`
  (token-free, light use; only candidates with score ≥ 80 are kept).

All geometry is requested in **WGS84 (`outSR=4326`)** at `geometryPrecision=6` so it drops straight
onto the MapLibre map.

## Join key

**`dev_id`** — the stable slug in `data/curated/developments.csv`. It is the only join key. Each
parcel feature carries the `dev_id` of the development it belongs to. Multiple features may share a
`dev_id` (multi-parcel sites).

## Match strategy (`fetch-geometry.ts`)

Because the parcel layer only exposes `situsfulla`, matching is done on that address string:

1. Read `data/curated/developments.csv`.
2. Group rows by their **normalized street** (`"Lincoln Blvd"` → `LINCOLN BLVD`,
   `"17th Street"` → `17TH ST`, `"Franklin St."` → `FRANKLIN ST`). Query the parcel layer **once per
   distinct street** with `situsfulla LIKE '%<STREET>%'`, returning geometry — one network call per
   street, throttled with a polite delay and a descriptive `User-Agent`.
3. **Address ranges** (e.g. `2903-2931`, `601-611`, `1430-1444`) are expanded into the full set of
   street numbers they cover. A plain address like `1413` expands to `{1413}`.
4. For each development, keep every queried parcel whose **leading situs number** is in that set
   **and** whose parsed **street core matches** the development's street. The street-core check
   prevents the `LIKE '%5TH ST%'` query from leaking `15TH ST` / `25TH ST` parcels, and tolerates
   suffix-less CSV streets (`"10th"` matches a `10TH ST` parcel). Unit tokens in the situs
   (`UNIT D`, `NO 1-6`, `STE 200`, trailing `3`) are stripped before comparison.
5. A development can match **multiple parcels** → one GeoJSON feature per matched parcel, all sharing
   the `dev_id`. Features are de-duped by `ain` within a development.
6. Developments with **zero** matches go to `unmatched.json`, with an approximate `lon`/`lat` from
   the ArcGIS geocoder when one resolves (score ≥ 80).

Output ordering is deterministic (sorted by `dev_id`, then `apn`) so re-runs diff cleanly.

## `parcels.geojson` feature property schema

```jsonc
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [ ... ] },   // WGS84
  "properties": {
    "dev_id":        "planning-2601-2645-lincoln-blvd",  // JOIN KEY
    "category":      "planning",            // completed | under_construction | planning
    "total_units":   521,                   // number | null (development total, repeated on each parcel)
    "address":       "2601-2645",           // verbatim CSV address (may be a range)
    "street":        "Lincoln Blvd",        // verbatim CSV street
    "apn":           "4283017001",          // resolved parcel id (== ain)
    "ain":           "4283017001",          // alias of apn
    "situs_address": "2601 LINCOLN BLVD SANTA MONICA CA 90405",  // raw parcel situs
    "usetype":       "...",                 // raw county assessor use type
    "usedescrip":    "..."                  // raw county assessor use description
  }
}
```

The FeatureCollection also carries a `metadata` block (source URL, join key, counts).

## `unmatched.json` schema

```jsonc
[
  {
    "dev_id":  "planning-1217-euclid",   // JOIN KEY
    "address": "1217",
    "street":  "Euclid",
    "reason":  "no parcel on \"EUCLID\" matched address number(s) 1217",
    "lon":     -118.489201,              // optional approx. centroid (ArcGIS geocoder)
    "lat":     34.025588                 // optional
  }
]
```

## How the map step consumes these

- Render `parcels.geojson` as the parcel layer; **join to the developments dataset on `dev_id`** to
  pull any extra fields. Color by `category`; set `fill-extrusion-height` from `total_units`.
  Remember a `dev_id` can have **several** features (union them visually per development).
- For every entry in `unmatched.json`, render a **point marker** (use `lon`/`lat` when present;
  otherwise the map step supplies a placement). Style by category to match the parcels.

## Regenerate

From the `site/` directory:

```bash
npm run fetch-geo            # runs fetch-geometry then fetch-boundary
# or individually:
npx tsx scripts/fetch-geometry.ts
npx tsx scripts/fetch-boundary.ts
```

## Current state (last regeneration)

- Total developments: **58**
- Matched (≥ 1 parcel): **54** → **88** parcel features
- Unmatched (0 parcels, point fallback): **4**
  - `planning-1217-euclid`
  - `planning-528-arizona-ave`
  - `planning-700-santa-monica-blvd`
  - `under-construction-2512-7th-st`

  All four are recent planning/under-construction sites whose project address has no matching
  assessor situs number in the parcel layer (likely re-addressed or assessor situs differs). All
  four resolved an approximate `lon`/`lat` via the geocoder, so the map can place point markers.
