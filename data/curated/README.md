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

## Known source anomalies

- **2000-01 city-funded count.** The FY2024-25 Attachment B prints `120` in the
  city-funded cell for 2000-01. That is impossible (it exceeds the year's 109
  affordable residences), and the row's own `18%` plus the column Total of 1,560
  both imply `20`. We record `20` and treat the printed `120` as a source typo.
- **Percentages are not exact ratios.** Reported percents are rounded and do not
  always equal the count ratio. For example 2024-25 prints 79% affordable while
  58/72 is 80.6%. Keep the reported percents for fidelity; recompute from counts
  if you need exact values.

## Schema drift across years (do not assume stable columns)

- Completed (A): FY2024-25 adds `eli` and `total_units`; FY2023-24 has neither.
- Planning (D): FY2023-24 has `project_id`; FY2024-25 does not.
