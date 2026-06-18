# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

Turn the City of Santa Monica's annual **Proposition R** fiscal-year reports (PDFs in `data/`) into a
clean dataset and two visual products:

1. A **time series** of the *Cumulative Proposition R Achievements* table (FY 1994-95 through FY 2024-25).
   It tracks total residences, market-rate vs. affordable counts, percent affordable, percent
   very-low/low income, city-funded affordable, and Prop R compliance.
2. An **interactive web map** of multifamily developments by address. Each development falls in one of
   three categories (completed, under construction, planning approvals), styled distinctly. A 3D
   extrusion raises each site to a height set by its total unit count.

### Decided stack

Mirror the sibling repo **[`BradEwing/rcb-database`](https://github.com/BradEwing/rcb-database)**
(`site/`). It has the same author, the same city, and the same hosting target, so match its scaffolding
and conventions.

- **Python** runs the PDF-to-dataset pipeline (extraction and cleaning). **TypeScript/Node** runs the
  site and its build-time geo steps, so the deployed site stays on one toolchain (the RCB pattern).
- **Site:** **Astro 5**, in its own `site/` directory with its own `package.json`. It ships no JS by
  default. The map is a single client island. Static `/about` and `/charts` pages live alongside it.
- **Map:** **MapLibre GL JS** (vector, no token) on the **CARTO Positron** key-free basemap. Positron
  needs attribution but no secret, which suits a static host.
- **Charts:** **Observable Plot** (`@observablehq/plot`).
- **3D extrusion:** MapLibre **`fill-extrusion`** on parcel polygons, with `fill-extrusion-height` set
  proportional to a development's total units (the RCB "skyline"). It is toggleable, off by default, and
  pitches the camera when on. This supersedes the earlier deck.gl `ColumnLayer` plan: the geo source
  already returns parcel polygons, so polygon extrusion needs no extra library. Where a development has no
  matching parcel, render a point marker instead. Category sets the fill color.
- **Geo source:** the **City of Santa Monica Parcels Public ArcGIS FeatureServer**, the source RCB's
  `fetch-geometry` uses. Match it from the report's `Address` plus `Street`, keyed by APN/AIN, and append
  `", Santa Monica, CA"`. Cache the geometry as a committed input. RCB's `fetch-boundary` adds a
  city-boundary overlay for orientation.

The pipeline and site directories are **not yet scaffolded**. Build the Python extraction and clean
dataset first, then the Astro site.

## Hosting: GitHub Pages (acceptance criterion)

The charts and map ship as a **static site on GitHub Pages**, deployed by GitHub Actions, the way
rcb-database does it.

- **Deploy workflow** `.github/workflows/pages.yml`: on a push to `main` that touches `site/**` or
  `data/**`, run `npm ci`, `astro check`, and `astro build` inside `site/`, then
  `actions/upload-pages-artifact` (path `site/dist`) followed by `actions/deploy-pages`. Set permissions
  `pages: write` and `id-token: write`, with the Pages source set to "GitHub Actions".
- **Project Pages base path.** The site lives at `https://bradewing.github.io/<repo>/`, so
  `astro.config.mjs` sets `site: 'https://bradewing.github.io'` and `base: '/<repo>'`. Build every asset
  and data URL base-relative through `import.meta.env.BASE_URL` (a `dataUrl()` helper). Root-relative
  URLs return 404 on Pages.
- **Build-time data, gitignored outputs.** The JSON and GeoJSON the client fetches is generated at build
  time by `tsx` scripts run from a `prebuild` hook (`npm run build-data`), and is git-ignored. Only cached
  external inputs such as parcel geometry and the city boundary are committed.
- **Licensing and attribution:** code is MIT, data is CC0. Attribute the CARTO basemap and the SM/LA
  County parcel geometry. The source Prop R reports are public records.

## Domain knowledge (read before touching the data)

**Proposition R** is a Santa Monica ballot measure that voters approved on **Nov 6, 1990**. It requires
that **30% of newly constructed multifamily housing** be affordable to low- and moderate-income
households, and that **at least 50% of that affordable share** go to low-income households (so 15% of all
new multifamily units). The **Affordable Housing Production Program (AHPP)**, Santa Monica Municipal Code
**§9.64.150**, implements it and requires this annual report to the City Council.

**Income bands** in the tables are relative to **LA County AMI**:

- **ELI** extremely-low, about 30% AMI
- **VLI** very-low, about 50% AMI
- **LI** low, about 80% AMI
- **Moderate**, about 120% AMI
- **Above Moderate**, market rate

"Low income" means at or below 60% AMI and "moderate" at or below 120% AMI. The moderate ceiling rose from
100% to 120% AMI, which recent reports reflect.

**What "Total Residences" means** (verified, see below): in Attachment B's cumulative table, Total
Residences counts **all new multifamily residences completed citywide** that fiscal year, not only units
that received Prop R or city funding. It even includes 100% market-rate projects that complied by paying
an in-lieu fee. It is multifamily only: single-family homes are excluded and ADUs are not counted. Prop R
is a citywide regulatory mandate on all new multifamily construction, measured as the affordable share of
this total. A separate stream of city-funded 100%-affordable projects sits inside it; the table breaks out
that subset in its own columns (*City-Funded Affordable Residences*, *% Affordable City Funded*, and
*Prop R Compliance Achieved Due to City Funding*). So `Total = Market Rate + Affordable` citywide,
`pct_affordable` uses this same Total as its denominator, and city-funded affordable is a subset of
Affordable.

This was confirmed against the City's AHPP guidelines, the FY2018-19 summary report, and a third report
(FY2019-2023) whose cumulative subtotals reconcile exactly with this series. See
`data/curated/README.md` for the sources and for two confirmed typos in the FY2024-25 Attachment B table
(2000-01 city-funded prints 120 but is 20; 2024-25 percent affordable prints 79 but is 81, per the same
report's page 2 and page 3). `tools/verify_claims.py` reproduces both findings deterministically.

## Source documents

`data/FY 2023-2024 Reports Regarding Proposition R.pdf` and
`data/FY 2024-2025 Reports Regarding Proposition R.pdf` are 8-page "Information Item" memos to the Mayor
and City Council from the Director of Housing and Human Services.

**These PDFs have no usable text layer.** The text is drawn as vector-outlined glyphs. `page.get_text()`
returns empty, and there are no embedded raster images, so OCR of an embedded image will not work either.
Extract content by rendering each page to PNG and transcribing it visually (`tools/render_pdf.py`), or by
running OCR on those PNGs. Claude Code's native PDF `Read` fails here because `poppler`/`pdftoppm` is not
installed, so use the render tool instead.

### Report layout (same 8-page skeleton in both years)

| Page | Content |
|------|---------|
| 1-4 | Narrative: Prop R background, mandates, and the FY summary counts (completed, under construction, planning) |
| 5 | **Attachment A**: Completed Multifamily Development *by Address* (this FY) |
| 6 | **Attachment B**: Cumulative Proposition R Achievements (the master time series) |
| 7 | **Attachment C**: Multifamily Development *Under Construction* by Address |
| 8 | **Attachment D**: Multifamily Development *with Planning Approvals* by Address |

**Attachment B is cumulative and restated every year.** Each report holds the full history plus one new
row. The **FY 2024-25 report is the authoritative copy** of the complete 1994-95 through 2024-25 series;
the FY 2023-24 report is a strict prefix. Its columns are:
`Reporting Period (FY) | Total Residences | Market Rate | Affordable | % Affordable | % Very-Low & Low Income | City-Funded Affordable | % Affordable City-Funded | Prop R Compliance Achieved Due to City Funding`.

Cross-check the totals when extracting. FY23-24 cumulative is **7,017** (4,563 market, 2,454 affordable,
1,560 city-funded). FY24-25 is **7,089** (4,577 market, 2,512 affordable, 1,560 city-funded). The 72-unit
difference equals FY24-25 completions, and market plus affordable equals total on every row. These are a
good sanity check.

### Schema drift to handle in the pipeline

The address attachments do not keep stable columns across years, so do not hardcode one header row.

- **Attachment A** in FY24-25 has columns
  `Project ID, Address, Street, Description, Zoning, Final Date, Above Moderate, ELI, VLI, LI, Moderate, Total Units`.
  FY23-24 drops ELI and Total Units (`... Above Moderate, VLI, LI, Moderate`).
- The address attachments (A, C, D) carry street addresses, zoning codes (R2, NC, MUB, GC, TA, and
  others), a permit or approval date, and per-income-band unit counts. Geocoding keys off `Address` plus
  `Street`. Every site is in Santa Monica, CA, so append ", Santa Monica, CA" when geocoding.

## Tooling & commands

**Windows environment quirk:** Python 3.11 is reachable only through the `py` launcher
(`C:\Windows\py.exe`). `python` and `python3` are not on the Git Bash PATH, so run Python from PowerShell
with `py`. `pandas` and `pymupdf` (`fitz`) are installed. Node is v25. `poppler`/`pdftoppm` is not
installed.

```powershell
# Render a report's pages to PNGs (150 dpi) for visual or OCR transcription
py tools/render_pdf.py "data/FY 2024-2025 Reports Regarding Proposition R.pdf" _render/fy2425

# Attempt raw text extraction. It returns empty for these reports, which confirms the missing text layer.
py tools/extract_text.py "data/FY 2024-2025 Reports Regarding Proposition R.pdf"

# Install a Python dependency
py -m pip install <package>
```

`_render/` is regenerable and large, and it is git-ignored.

## Conventions

- Treat each report's **Attachment B** as the source of truth for the cumulative series. Prefer the newest
  report where two reports cover a year, and confirm the older report agrees on the overlapping rows.
- When transcribing tables from rendered pages, keep raw cell values verbatim in the extracted data,
  blanks included. Derive percentages and rollups downstream so the totals stay auditable against the PDF.
