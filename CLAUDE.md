# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

Turn the City of Santa Monica's annual **Proposition R** fiscal-year reports (PDFs in `data/`) into a
clean dataset and two visual products:

1. **Time series** of the *Cumulative Proposition R Achievements* table (FY 1994‑95 → FY 2024‑25):
   total residences, market-rate vs. affordable, % affordable, % very-low/low income, city-funded
   affordable, and Prop R compliance.
2. **Interactive web map** of multifamily developments by address, in three categories — **completed**,
   **under construction**, and **planning approvals** — each category styled distinctly, with a
   **3D extrusion whose height scales by a development's total unit count**.

### Decided stack

Mirror the sibling repo **[`BradEwing/rcb-database`](https://github.com/BradEwing/rcb-database)**
(`site/`) — same author, same city, same hosting target. Match its scaffolding and conventions.

- **Python** for the *PDF → clean dataset* pipeline (extraction, cleaning); **TypeScript/Node** for the
  site and its build-time geo steps (so the deployed site is one toolchain, per the RCB pattern).
- **Site:** **Astro 5** static site in its own `site/` directory (own `package.json`). Ships zero JS by
  default; the map is a single client island; static `/about` + `/charts` pages alongside.
- **Map:** **MapLibre GL JS** (vector, no token) with the **CARTO Positron** key-free basemap
  (attribution required — no secret to manage on a static host). **No deck.gl** — see 3D below.
- **Charts:** **Observable Plot** (`@observablehq/plot`) for the cumulative time series and breakdowns.
- **3D extrusion:** MapLibre **`fill-extrusion`** of **parcel polygons**, `fill-extrusion-height` ∝ a
  development's **total units** (RCB's "skyline" approach). Toggleable, off by default, pitches the
  camera when on. This replaces the earlier deck.gl `ColumnLayer` idea: because the geo source already
  yields parcel polygons, polygon extrusion needs no extra library. (If a development can't be matched to
  a parcel, fall back to a small point-marker; only reach for deck.gl if point-column extrusion is later
  required.) Category — completed / under-construction / planning-approval — drives fill color.
- **Geo source:** the **City of Santa Monica Parcels Public ArcGIS FeatureServer** (same source RCB's
  `fetch-geometry` uses), keyed by APN/AIN, joined from the report's `Address + Street`. Cache the
  geometry as a committed input; append `", Santa Monica, CA"` when matching. A city-boundary overlay
  (RCB's `fetch-boundary`) is a nice orientation aid.

Pipeline/site directories are **not yet scaffolded** — build the Python extraction + clean dataset first,
then the Astro site.

## Hosting — GitHub Pages (acceptance criterion)

The charts and map ship as a **static site on GitHub Pages**, deployed by GitHub Actions, exactly like
rcb-database:

- **Deploy workflow** `.github/workflows/pages.yml`: on push to `main` touching `site/**` or `data/**`,
  `npm ci` → `astro check` → `astro build` in `site/`, then `actions/upload-pages-artifact` (path
  `site/dist`) + `actions/deploy-pages`. Permissions `pages: write`, `id-token: write`; Pages source set
  to "GitHub Actions".
- **Project Pages base path is load-bearing.** The site lives at `https://bradewing.github.io/<repo>/`,
  so `astro.config.mjs` sets `site: 'https://bradewing.github.io'` + `base: '/<repo>'`. **Every asset and
  data URL must be base-relative** via `import.meta.env.BASE_URL` (a `dataUrl()` helper) — root-relative
  URLs 404 on Pages.
- **Build-time data, gitignored outputs.** Site data artifacts (the JSON/GeoJSON the client fetches) are
  **generated at build time** by `tsx` scripts run from a `prebuild` hook (`npm run build-data`) and are
  **git-ignored**; only external *inputs* we cache (e.g. parcel geometry, city boundary) are committed.
- **Licensing/attribution:** code MIT, data CC0; attribute the CARTO basemap and the SM/LA County parcel
  geometry. The source Prop R reports are public records.

## Domain knowledge (read before touching the data)

**Proposition R** is a Santa Monica ballot measure approved by voters **Nov 6, 1990**. It mandates that
**30% of newly constructed multifamily housing** be affordable to low- and moderate-income households,
and that **at least 50% of that affordable share** go to low-income households (i.e. **15% of all new
multifamily units**). It is implemented through the **Affordable Housing Production Program (AHPP)**,
Santa Monica Municipal Code **§9.64.150**, which requires this annual report to the City Council.

**Income bands** used in the tables (relative to **LA County AMI**):
- **ELI** extremely-low ≈ 30% AMI · **VLI** very-low ≈ 50% AMI · **LI** low ≈ 80% AMI ·
  **Moderate** ≈ 120% AMI · **Above Moderate** = market rate.
- "Low income" is defined as ≤ 60% AMI and "moderate" as ≤ 120% AMI (the moderate ceiling was updated
  from 100% to 120% AMI; reflected in recent reports).

**Key semantic clarification — what "Total Residences" means** (resolved by reading the reports):
In Attachment B's cumulative table, **Total Residences is ALL new multifamily residences produced
citywide**, *not* only units that received Prop R / city funding. Prop R is a **citywide regulatory
mandate** applied to all new multifamily construction (largely via inclusionary requirements on
market-rate projects), plus a separate stream of **city-funded 100%-affordable** projects. The table
isolates that city-funded subset in its own columns (*City-Funded Affordable Residences*,
*% Affordable City Funded*, *Prop R Compliance Achieved Due to City Funding*). So:
`Total = Market Rate + Affordable` (citywide), and city-funded affordable is a **subset** of Affordable.

## Source documents

`data/FY 2023-2024 Reports Regarding Proposition R.pdf` and
`data/FY 2024-2025 Reports Regarding Proposition R.pdf` — 8-page "Information Item" memos to the Mayor
and City Council from the Director of Housing and Human Services.

**These PDFs have no usable text layer.** The text is drawn as **vector-outlined glyphs**:
`page.get_text()` returns empty and there are **no embedded raster images**, so OCR-of-an-image won't
work either. Extract content by **rendering each page to PNG and transcribing visually** (what
`tools/render_pdf.py` does), or by running OCR on the rendered PNGs. Claude Code's native PDF `Read`
fails here because `poppler`/`pdftoppm` is not installed — use the render tool instead.

### Report layout (identical 8-page skeleton in both years)

| Page | Content |
|------|---------|
| 1–4 | Narrative: Prop R background, mandates, FY summary (completed / under-construction / planning counts) |
| 5 | **Attachment A** — Completed Multifamily Development *by Address* (this FY) |
| 6 | **Attachment B** — **Cumulative Proposition R Achievements** (the master time series) |
| 7 | **Attachment C** — Multifamily Development *Under Construction* by Address |
| 8 | **Attachment D** — Multifamily Development *with Planning Approvals* by Address |

**Attachment B is cumulative and restated every year** — each report contains the full history plus one
new row. The **FY 2024‑25 report is the authoritative copy** for the complete 1994‑95 → 2024‑25 series;
the FY 2023‑24 report is a strict prefix. Its columns:
`Reporting Period (FY) | Total Residences | Market Rate | Affordable | % Affordable | % Very-Low & Low Income | City-Funded Affordable | % Affordable City-Funded | Prop R Compliance Achieved Due to City Funding`.
Cross-check totals: FY23‑24 cumulative = **7,017** (4,503 market / 2,454 affordable / 1,560 city-funded);
FY24‑25 = **7,089** (4,577 / 2,512 / 1,560). The +72 delta equals FY24‑25 completions — use this as an
extraction sanity check.

### Schema drift to handle in the pipeline

The address attachments are **not column-stable across years** — do not hardcode one header row:
- **Attachment A** FY24‑25 columns: `Project ID, Address, Street, Description, Zoning, Final Date, Above Moderate, ELI, VLI, LI, Moderate, Total Units`.
  FY23‑24 **omits ELI and Total Units** (`… Above Moderate, VLI, LI, Moderate`).
- The address-level attachments (A/C/D) carry **street addresses, zoning codes** (R2, NC, MUB, GC, TA, …),
  **a permit/approval date**, and **per-income-band unit counts**. Geocoding keys off `Address + Street`
  (all sites are in Santa Monica, CA — append ", Santa Monica, CA" when geocoding).

## Tooling & commands

**Windows environment quirk:** Python 3.11 is reachable **only via the `py` launcher**
(`C:\Windows\py.exe`); `python` / `python3` are **not on the Git Bash PATH**. Run Python through
**PowerShell** with `py`. Already installed: `pandas`, `pymupdf` (a.k.a. `fitz`). Node is **v25**.
`poppler`/`pdftoppm` is **not** installed.

```powershell
# Render a report's pages to PNGs (150 dpi) for visual/OCR transcription
py tools/render_pdf.py "data/FY 2024-2025 Reports Regarding Proposition R.pdf" _render/fy2425

# Attempt raw text extraction (expected to come back EMPTY for these reports — confirms the no-text-layer reality)
py tools/extract_text.py "data/FY 2024-2025 Reports Regarding Proposition R.pdf"

# Install a Python dependency
py -m pip install <package>
```

`_render/` is throwaway (regenerable, large) and git-ignored.

## Conventions

- Treat each report's **Attachment B** as the source of truth for the cumulative series; prefer the
  newest report when both cover a year, and verify older reports agree on overlapping rows.
- When transcribing tables from rendered pages, **keep raw cell values verbatim** in the extracted data
  (including blanks) and derive percentages/rollups downstream, so totals stay auditable against the PDF.
