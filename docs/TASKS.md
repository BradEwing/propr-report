# Tasks

Outstanding work to deliver the two products described in `CLAUDE.md`: the
cumulative time-series charts and the interactive 3D map, both hosted on GitHub
Pages. Checked items are complete and in the repo.

The site is live: **https://bradewing.github.io/propr-report/**

## Done

- [x] Transcribe both report PDFs into curated CSVs (`data/curated/`): the
      cumulative series plus the completed, under-construction, and
      planning-approval address tables.
- [x] Validation harness `tools/validate_curated.py` reconciling every column
      against the printed totals (38 checks pass).
- [x] Confirm what "Total Residences" represents (all citywide multifamily
      completions) via internal arithmetic, external research, and a third
      report's cross-validation.
- [x] Verify and document the two Attachment B source typos
      (`tools/verify_claims.py`, `docs/README.md`); corrections recorded in the
      curated data.
- [x] Project guidance (`CLAUDE.md`) and local git repository.

## Prerequisites

- [x] Create the GitHub remote `BradEwing/propr-report`, push, and set the Pages
      source to "GitHub Actions". The repo is public; Pages build type is
      `workflow`; the deploy workflow runs green and the site is live.

## Data pipeline (Python)

The canonical dataset already exists as the curated CSVs. These tasks shape it
for the site.

- [x] Build a unified `developments` table for the map (`tools/build_developments.py`
      → `data/curated/developments.csv`, 58 rows): union of the completed,
      under-construction, and planning-approval rows with a `category` field, a
      single `total_units`, an affordability breakdown, ISO date, zoning, and
      description. Under-construction keeps only the latest report's snapshot;
      completed and planning keep all rows (disjoint across years).
- [x] Derive `total_units` for the FY2023-24 completed rows, where the source
      omitted that column (sum of the income-band counts).
- [x] Normalize the verbatim mixed-format dates (`8/6/2024`, `05/23/2024`) to ISO
      (`date_iso`, with `date_raw` preserved).
- [x] PDF extractor decision: the hand-curated, validated CSVs stay the source of
      truth (no automated extractor). Rationale recorded in
      `data/curated/README.md` ("PDF extraction decision").

## Geo enrichment

- [x] `fetch-geometry` (`site/scripts/fetch-geometry.ts`): match each development
      (`Address` plus `Street`, `", Santa Monica, CA"`) to the City of Santa
      Monica Parcels Public ArcGIS FeatureServer, resolve its APN/AIN, and cache
      the parcel polygons as a committed GeoJSON input (`data/geo/parcels.geojson`).
      Handles address ranges and multi-parcel developments. 54/58 matched →
      88 parcel features.
- [x] `fetch-boundary` (`site/scripts/fetch-boundary.ts`): cache the
      city-boundary GeoJSON (`data/geo/city_boundary.geojson`).
- [x] Point-marker fallback for the 4 developments with no matched parcel
      (`data/geo/unmatched.json`, with geocoded lon/lat).

## Site scaffolding (Astro)

- [x] Create the `site/` Astro 5 project with its own `package.json`
      (astro, maplibre-gl, @observablehq/plot, tsx).
- [x] `astro.config.mjs` with `site: 'https://bradewing.github.io'` and
      `base: '/propr-report'`.
- [x] Layout plus pages: map (`/`), `/charts`, `/about`.
- [x] `dataUrl()` helper built on `import.meta.env.BASE_URL` (every asset and data
      URL base-relative).
- [x] `build-data` tsx script and a `prebuild` hook that emits the client JSON and
      GeoJSON artifacts (git-ignored outputs).

## Visualizations

- [x] Time-series charts (Observable Plot) from the cumulative CSV: total vs
      market vs affordable over time, percent affordable against the 30% Prop R
      line, city-funded affordable, and compliance by year.
- [x] Map (MapLibre GL plus CARTO Positron): the three category layers,
      color-coded, with a toggleable legend and a per-development detail popup.
- [x] 3D `fill-extrusion` toggle (off by default, pitches the camera), height
      proportional to a development's total units, with the point-marker fallback.

## Hosting and release

- [x] `.github/workflows/pages.yml` per `CLAUDE.md` (npm ci, astro check,
      `npm run build` so the prebuild hook generates data, upload `site/dist`,
      deploy-pages).
- [x] Attribution for the CARTO basemap and the SM/LA County parcel geometry
      (site footer + README); LICENSE (code MIT) and LICENSE-data (data CC0).
- [x] Root `README.md` with the live Pages link.

## Open external question (non-blocking)

- [ ] Await the report author's confirmation on the two Attachment B
      discrepancies in `docs/README.md`. Does not block the build. (Third-party
      wait; nothing to implement.)
