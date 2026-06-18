# Santa Monica Proposition R Report

Turns the City of Santa Monica's annual **Proposition R** fiscal-year reports
(public-record PDFs) into a clean, auditable dataset and two visual products: a
**cumulative time series** of the *Proposition R Achievements* table
(FY 1994-95 through FY 2024-25) and an **interactive 3D map** of multifamily
developments by address, where each site is extruded to a height set by its total
unit count and colored by category (completed, under construction, planning
approvals).

Proposition R (approved by Santa Monica voters on Nov 6, 1990) requires that 30%
of newly constructed multifamily housing be affordable to low- and
moderate-income households, with at least half of that affordable share going to
low-income households. It is implemented by the Affordable Housing Production
Program (AHPP), Santa Monica Municipal Code §9.64.150.

## Live site

**https://bradewing.github.io/propr-report/**

## What's in the repo

| Path | Contents |
|------|----------|
| `data/` | Source report PDFs, the curated CSVs (`data/curated/`), and cached parcel/boundary geometry (`data/geo/`) |
| `tools/` | Python pipeline (PDF rendering, developments build) and validation scripts |
| `site/` | The Astro site: map (`/`), `/charts`, `/about`, plus build-time data scripts |
| `docs/` | Source-data discrepancy writeup and task notes |

## Quickstart

> **Windows note:** Python 3.11 is reachable only through the `py` launcher
> (`python` / `python3` are not on the Git Bash PATH). Run Python from PowerShell
> with `py`. Node is v25 locally; CI uses Node 20 LTS.

### Build / validate the data

The curated CSVs are the source of truth and are committed. `developments.csv` is
generated from the three address tables, and the validation harness reconciles
every column against the totals printed in the reports.

```powershell
# Regenerate data/curated/developments.csv from the address tables
py tools/build_developments.py

# Reconcile the curated CSVs against the report totals (run after any edit)
py tools/validate_curated.py
```

### Run the site

```powershell
cd site
npm install
npm run dev        # local dev server

npm run build      # production build into site/dist
```

`npm run build` runs a `prebuild` hook (`npm run build-data`) that generates the
client-facing JSON and GeoJSON in `site/public/data/` from the committed
`data/curated/*.csv` and `data/geo/*.geojson` inputs. Those generated outputs are
git-ignored and rebuilt on every build (including in CI).

## Deployment

The site is a static build deployed to GitHub Pages by GitHub Actions
(`.github/workflows/pages.yml`) on pushes to `main` that touch `site/**` or
`data/**`. The Pages source is set to "GitHub Actions". The site is served under
the project base path `/propr-report`.

## Data sources & attribution

- **Proposition R reports** — the City of Santa Monica's annual "Reports
  Regarding Proposition R" (Information Items to the Mayor and City Council).
  Public records.
- **Basemap** — [CARTO](https://carto.com/) Positron vector basemap.
  © CARTO, © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors.
- **Parcel geometry** — City of Santa Monica / LA County parcels, via the City of
  Santa Monica Parcels Public ArcGIS FeatureServer.

## Licensing

This repository is **dual-licensed**:

- **Code** — [MIT License](LICENSE).
- **Data** — the curated dataset (`data/curated/` and data derived from it) is
  dedicated to the public domain under [CC0 1.0 Universal](LICENSE-data).

The source Prop R report PDFs are public records.

## Known source typos

Two cells in the FY 2024-25 Attachment B table are typos in the source report.
The curated dataset stores the corrected values and flags both cells; each was
confirmed three ways (the report's own other figures, a deterministic check in
`tools/verify_claims.py`, and adversarial review):

- **2000-01 City-Funded Affordable:** printed `120`, stored `20`.
- **2024-25 % Affordable:** printed `79`, stored `81`.

Full evidence is in [`docs/README.md`](docs/README.md) (a forwardable writeup for
the report's author) and [`data/curated/README.md`](data/curated/README.md).
