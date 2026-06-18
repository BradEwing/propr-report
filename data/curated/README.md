# Curated Prop R data

Hand-transcribed from the two source PDFs in `../` (see top-level `CLAUDE.md` for
why they need visual transcription). Every column total was reconciled against
the "Total" rows printed in the reports by `tools/validate_curated.py`. Run that
script after any edit.

Counts are integers. Blank cells mean the source left the cell empty (read as a
blank, not a zero). Percent columns hold the integer percent printed in the
report (so `18` means 18%), kept verbatim. Dates are verbatim strings in the
report's mixed formats (`8/6/2024`, `05/23/2024`); normalize them downstream.

## Files

### `cumulative_prop_r_achievements.csv`

Attachment B, the cumulative time series, one row per fiscal year 1994-95 through
2024-25. Taken from the FY2024-25 report, which restates the full history and is
the authoritative copy. Columns: `fiscal_year`, `total_residences`,
`market_rate_residences`, `affordable_residences`, `pct_affordable`,
`pct_very_low_and_low_income`, `city_funded_affordable_residences`,
`pct_affordable_city_funded`, `prop_r_compliance` (`Yes`/`No`/`N/A`).

`total_residences = market_rate_residences + affordable_residences` on every row.
`city_funded_affordable_residences` is a subset of `affordable_residences`. See
top-level `CLAUDE.md` for what "total" counts (all citywide multifamily, not just
city-funded).

### `completed_developments.csv`

Attachment A from both reports, one row per completed development, tagged by
`source_fiscal_year`. The FY2023-24 and FY2024-25 sets are disjoint (a building
completes once). Income columns: `above_moderate`, `eli`, `vli`, `li`,
`moderate`, plus `total_units`. `eli` and `total_units` exist only in FY2024-25;
they are blank for FY2023-24 rows, where the source omitted those columns.

### `under_construction.csv`

Attachment C from both reports, tagged by `source_fiscal_year`. Each report is a
point-in-time snapshot, so addresses repeat across the two years. The FY2023-24
snapshot is the FY2024-25 snapshot minus the one `1634 20th St` row (permitted
Feb 2025). Income columns are by AMI band: `ami_30`, `ami_50`, `ami_80`,
`ami_120`, plus `above_moderate`. `num_units` and `pct_affordable` come straight
from the report. `note` holds text the source placed in the affordable-units
area: `in-lieu fee` (developer paid a fee instead of building affordable units
onsite, so the AMI columns are blank) or an offsite-affordable reference.

### `planning_approvals.csv`

Attachment D from both reports, tagged by `source_fiscal_year`. Income columns:
`moderate`, `li`, `vli`, `above_moderate`. `project_id` exists only in FY2023-24;
it is blank for FY2024-25 rows, where the source omitted that column.

### `developments.csv`

Generated, not hand-edited. `tools/build_developments.py` unions the three
address tables above into one row per development for the interactive map. Run
that script after editing any of the source address CSVs; do not edit
`developments.csv` directly. Unified schema:

`dev_id`, `category`, `project_id`, `address`, `street`, `description`,
`zoning`, `date_iso`, `date_raw`, `eli`, `vli`, `li`, `moderate`,
`above_moderate`, `affordable_units`, `market_units`, `total_units`,
`source_fiscal_year`, `note`.

- `dev_id` is the stable join key the geo step keys parcels off. It is
  `${category}-${address}-${street}` lowercased, with every run of
  non-alphanumeric characters collapsed to a single hyphen and the ends
  trimmed. Collisions get a numeric suffix (`-2`, `-3`, ...). Unique across all
  rows.
- `category` is `completed`, `under_construction`, or `planning`.
- Income bands are integer unit counts; a blank source cell reads as `0`.
  Under-construction AMI bands map to named bands: `ami_30 -> eli`,
  `ami_50 -> vli`, `ami_80 -> li`, `ami_120 -> moderate`. Planning has no ELI
  column, so `eli` is `0` there.
- `affordable_units = eli + vli + li + moderate`; `market_units = above_moderate`.
- `total_units` derivation by source: completed FY2024-25 uses the source
  `total_units` column; completed FY2023-24 (which omitted it) derives it as the
  sum of the income bands; under_construction uses the source `num_units`;
  planning sums its bands (`moderate + li + vli + above_moderate`).
- `date_iso` normalizes the verbatim US `M/D/YYYY` date (`final_date` for
  completed/planning, `building_permit_date` for under_construction) to ISO
  `YYYY-MM-DD`; `date_raw` keeps the original string. Both blank if the source
  is blank.
- `note` carries the under-construction `note` (e.g. `in-lieu fee`, offsite
  references); blank for the other categories.

Dedup / snapshot decisions:

- **completed**: the two fiscal-year sets are disjoint (a building completes
  once), so all rows from both years are kept.
- **under_construction**: each report is a point-in-time snapshot and addresses
  repeat across years, so only the latest snapshot (`source_fiscal_year`
  `2024-25`, a superset of `2023-24`) is kept; the `2023-24` rows are dropped.
- **planning**: the two years' approvals are distinct projects with disjoint
  addresses, so all rows from both years are kept; if any `address`+`street`
  ever collides across years, the latest `source_fiscal_year` wins.

Current output: 58 rows (12 completed, 23 under_construction, 23 planning).

## PDF extraction decision

The hand-curated, validated CSVs stay the source of truth; we are **not**
building an automated PDF extractor. Rationale: the source PDFs have no text
layer (glyphs are vector outlines, OCR-only), and for a two-report dataset that
is restated annually, visual transcription checked by the 38-assertion
validation harness (`tools/validate_curated.py`) is more reliable than fragile
OCR.

## Known source anomalies

Two cells in the FY2024-25 Attachment B table are wrong in the source. Each was
confirmed three ways: by the report's own other figures, by an independent
deterministic check (`tools/verify_claims.py`), and by adversarial review. In
both cases we store the value the report's own evidence establishes and flag the
printed cell here. A forwardable writeup for the report's author is in
`docs/README.md`.

- **2000-01 city-funded count: stored `20`, printed `120`.** `120` exceeds the
  year's 109 affordable residences (a subset cannot exceed its parent), the row's
  own `18%` implies `20` (20/109 = 18%), and the column Total of `1,560` only
  reconciles with `20` (summing the printed column gives 1,660). All three force
  `20`.
- **2024-25 percent affordable: stored `81`, printed `79`.** The counts give
  58/72 = 80.6%, which rounds to 81%, and the same report states 81% twice
  elsewhere: the page 2 table (`% Low & Mod-Income = 81%`) and the page 3
  narrative ("81% of new multifamily housing residences are affordable"). The
  `79%` in the page 6 table is an isolated typo, not a different calculation. Its
  own components (14 + 58 = 72) are correct, so only the percent glyph is wrong.

Note on percent columns generally: they are the report's rounded display values.
Where they disagree with the counts, trust the counts (recompute as
`round(affordable / total)`), which match the printed percent on every other row.

## What the counts represent (verified)

`total_residences` is **all new multifamily residences completed citywide** that
fiscal year, the base the 30% Prop R mandate is measured against. It is not
limited to Prop-R-funded or inclusionary units; it even includes 100%
market-rate projects that complied by paying an in-lieu fee. It is multifamily
only (single-family excluded; ADUs not counted). `pct_affordable` uses this same
`total_residences` as its denominator. Confirmed against the City's AHPP
guidelines, the FY2018-19 summary report, and a third report (FY2019-2023) whose
cumulative subtotals reconcile exactly with this series.

## Schema drift across years (do not assume stable columns)

- Completed (A): FY2024-25 adds `eli` and `total_units`; FY2023-24 has neither.
- Planning (D): FY2023-24 has `project_id`; FY2024-25 does not.
