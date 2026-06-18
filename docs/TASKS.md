# Tasks

Outstanding work to deliver the two products described in `CLAUDE.md`: the
cumulative time-series charts and the interactive 3D map, both hosted on GitHub
Pages. Checked items are complete and in the repo.

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

- [ ] Create the GitHub remote `BradEwing/propr-report`, push, and set the Pages
      source to "GitHub Actions". Required before any Pages deploy.

## Data pipeline (Python)

The canonical dataset already exists as the curated CSVs. These tasks shape it
for the site.

- [ ] Build a unified `developments` table for the map: union the completed,
      under-construction, and planning-approval rows with a `category` field, a
      single `total_units`, an affordability breakdown, date, zoning, and
      description. Decide how to handle the repeated under-construction snapshots
      (default: keep the latest report's snapshot).
- [ ] Derive `total_units` for the FY2023-24 completed rows, where the source
      omitted that column (sum of the income-band counts).
- [ ] Normalize the verbatim mixed-format dates (`8/6/2024`, `05/23/2024`) to ISO.
- [ ] Decide whether an automated PDF extractor is worth building, or whether the
      hand-curated, validated CSVs stay the source of truth (current assumption:
      they stay the source of truth).

## Geo enrichment

- [ ] `fetch-geometry`: match each development (`Address` plus `Street`, with
      `", Santa Monica, CA"`) to the City of Santa Monica Parcels Public ArcGIS
      FeatureServer, resolve its APN/AIN, and cache the parcel polygons as a
      committed GeoJSON input. Handle address ranges (e.g. `2903-2931`) and
      developments spanning multiple parcels.
- [ ] `fetch-boundary`: cache the city-boundary GeoJSON for the orientation
      overlay.
- [ ] Point-marker fallback for any development with no matched parcel.

## Site scaffolding (Astro)

- [ ] Create the `site/` Astro 5 project with its own `package.json`
      (astro, maplibre-gl, @observablehq/plot, tsx).
- [ ] `astro.config.mjs` with `site: 'https://bradewing.github.io'` and
      `base: '/propr-report'`.
- [ ] Layout plus pages: map (`/`), `/charts`, `/about`.
- [ ] `dataUrl()` helper built on `import.meta.env.BASE_URL` (every asset and data
      URL must be base-relative).
- [ ] `build-data` tsx script and a `prebuild` hook that emits the client JSON and
      GeoJSON artifacts (git-ignored outputs).

## Visualizations

- [ ] Time-series charts (Observable Plot) from the cumulative CSV: total vs
      market vs affordable over time, percent affordable against the 30% Prop R
      line, city-funded affordable, and compliance by year.
- [ ] Map (MapLibre GL plus CARTO Positron): the three category layers,
      color-coded, with a legend and a per-development detail popup.
- [ ] 3D `fill-extrusion` toggle (off by default, pitches the camera), height
      proportional to a development's total units, with the point-marker fallback.

## Hosting and release

- [ ] `.github/workflows/pages.yml` per `CLAUDE.md` (npm ci, astro check, astro
      build, upload `site/dist`, deploy-pages).
- [ ] Attribution for the CARTO basemap and the SM/LA County parcel geometry; add
      a LICENSE (code MIT, data CC0).
- [ ] Root `README.md` with the live Pages link.

## Open external question (non-blocking)

- [ ] Await the report author's confirmation on the two Attachment B
      discrepancies in `docs/README.md`. Does not block the build.
