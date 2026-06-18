# Source data discrepancies

Two small, isolated values in the **FY 2024-2025 Reports Regarding Proposition R**
appear to be typos in the **Attachment B** table ("Cumulative Proposition R
Achievements", page 6). Both are single display cells. The underlying counts are
correct and internally consistent, so neither affects analysis once corrected.

This page is written to be forwarded to the report's author. Every piece of
evidence below comes from the report itself, not from our own assumptions. All of
it is reproduced deterministically by `tools/verify_claims.py` in this repository.

Our curated dataset (`data/curated/`) stores the corrected values and flags both
cells in `data/curated/README.md`.

## Discrepancy 1: 2000-01 City-Funded Affordable Residences

- **Location:** Attachment B (page 6), fiscal year 2000-01 row, "City-Funded
  Affordable Residences" column.
- **Printed value:** 120
- **Value the report's own figures imply:** 20

Evidence, all from the same report:

1. The same row's "Affordable Residences" is 109. City-funded affordable units
   are a subset of affordable units, so the count cannot exceed 109.
2. The same row's "Percent Affordable City-Funded" is 18%. 20 / 109 = 18%, while
   120 / 109 = 110%.
3. The column's printed Total is 1,560. The printed cells in that column sum to
   1,660; replacing 120 with 20 makes them sum to exactly 1,560. The other three
   numeric columns (total 7,089, market-rate 4,577, affordable 2,512) already sum
   to their printed totals.

A likely mechanism: the preceding row (1999-00) has a city-funded value of 120,
so this reads like a value carried down by mistake.

## Discrepancy 2: 2024-25 Percent Affordable

- **Location:** Attachment B (page 6), fiscal year 2024-25 row, "Percent
  Affordable" column.
- **Printed value:** 79%
- **Value the report's own figures imply:** 81%

Evidence, all from the same report:

1. The same row's counts are 58 affordable of 72 total. 58 / 72 = 80.6%, which
   rounds to 81%. The row's components are themselves consistent (14 market-rate +
   58 affordable = 72 total), so only the percentage is off.
2. The page 2 table, "Multifamily Housing Completed FY 2024-25", prints
   "% Low- & Mod-Income = 81%" for the same fiscal year.
3. The page 3 narrative states "81% of new multifamily housing residences are
   affordable to low- and moderate-income households."
4. On all 30 other fiscal-year rows, Percent Affordable equals
   round(Affordable / Total). Only this row deviates, and only by the percentage
   cell.

## Impact

Minor. Both are single-cell display errors in one table. The counts that drive
every chart and map in this project are unaffected. We have recorded the
corrected values and can revert to the printed values if the author confirms a
different intent.

## Suggested note to the report author

> While building a dataset from the FY 2024-25 Proposition R report, two values in
> Attachment B (page 6) looked inconsistent with the report's own other figures.
> For 2000-01, "City-Funded Affordable Residences" reads 120, but that exceeds the
> row's 109 affordable residences, the row's 18% city-funded share implies 20, and
> the column total of 1,560 only balances with 20. For 2024-25, "Percent
> Affordable" reads 79%, but the row's counts (58 of 72) give 81%, which also
> matches the page 2 table and the page 3 narrative. Could you confirm whether 20
> and 81% are the intended values, or whether we are misreading the methodology?
