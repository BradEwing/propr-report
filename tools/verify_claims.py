"""Deterministic, reproducible audit of two claims about the FY2024-25 report's
Attachment B (Cumulative Proposition R Achievements).

Claim A: the 2000-01 "City-Funded Affordable Residences" cell, printed as 120,
         is internally inconsistent with the rest of the report.
Claim B: the reported "Percent Affordable" does not always equal the count
         ratio (cited example: 2024-25 prints 79% while 58/72 = 80.6%).

This script encodes the values AS PRINTED in the report (so the 2000-01
city-funded cell is 120 here, not the corrected 20) and the printed Total row,
then checks internal consistency by computation only. No mental math, no OCR
needed: every conclusion follows from the report's own other printed numbers.

External corroboration (not needed for the checks, but confirms them):
- Claim A: substituting 20 makes the city-funded column sum to the printed 1560.
- Claim B: the SAME report states 81% (not 79%) twice: the page 2 table
  ("% Low & Mod-Income = 81%") and the page 3 narrative ("81% of new multifamily
  housing residences are affordable"). A separate report (FY2019-2023) has
  cumulative subtotals that reconcile exactly with this series.

Run: py tools/verify_claims.py
"""
from fractions import Fraction

# As-printed Attachment B (FY2024-25 report). Columns:
# year, total, market, affordable, pct_affordable, pct_vll, city_funded,
#       pct_affordable_city_funded, compliance
# The two values under dispute are read from the page as printed:
#   2000-01 city_funded = 120   (Claim A)
#   2024-25 pct_affordable = 79  (Claim B)
ROWS = [
    ("1994-95", 11, 9, 2, 18, 18, 0, 0, "N/A"),
    ("1995-96", 0, 0, 0, 0, 0, 0, 0, "N/A"),
    ("1996-97", 108, 10, 98, 91, 36, 95, 97, "Yes"),
    ("1997-98", 111, 43, 68, 61, 40, 60, 88, "Yes"),
    ("1998-99", 168, 22, 146, 87, 33, 91, 62, "No"),
    ("1999-00", 166, 43, 123, 74, 72, 120, 98, "Yes"),
    ("2000-01", 420, 311, 109, 26, 14, 120, 18, "N/A"),   # city_funded as printed
    ("2001-02", 702, 491, 211, 30, 22, 110, 52, "Yes"),
    ("2002-03", 212, 211, 1, 0, 0, 0, 0, "N/A"),
    ("2003-04", 235, 195, 40, 17, 12, 13, 33, "N/A"),
    ("2004-05", 55, 29, 26, 47, 27, 0, 0, "No"),
    ("2005-06", 39, 37, 2, 5, 0, 0, 0, "N/A"),
    ("2006-07", 272, 186, 86, 32, 32, 85, 99, "Yes"),
    ("2007-08", 296, 201, 95, 32, 32, 91, 96, "Yes"),
    ("2008-09", 537, 289, 248, 46, 15, 82, 33, "No"),
    ("2009-10", 189, 169, 20, 11, 7, 20, 100, "N/A"),
    ("2010-11", 134, 126, 8, 6, 6, 0, 0, "No"),
    ("2011-12", 156, 55, 101, 65, 2, 0, 0, "No"),
    ("2012-13", 483, 237, 246, 51, 31, 145, 59, "Yes"),
    ("2013-14", 458, 201, 257, 56, 56, 253, 98, "Yes"),
    ("2014-15", 157, 127, 30, 19, 7, 0, 0, "N/A"),
    ("2015-16", 175, 141, 34, 19, 19, 32, 94, "N/A"),
    ("2016-17", 100, 87, 13, 13, 12, 0, 0, "N/A"),
    ("2017-18", 46, 44, 2, 4, 2, 0, 0, "N/A"),
    ("2018-19", 116, 48, 68, 59, 58, 0, 0, "No"),
    ("2019-20", 85, 78, 7, 8, 5, 0, 0, "No"),
    ("2020-21", 559, 458, 101, 18, 17, 39, 39, "N/A"),
    ("2021-22", 268, 211, 57, 21, 20, 40, 70, "N/A"),
    ("2022-23", 484, 320, 164, 34, 32, 158, 96, "Yes"),
    ("2023-24", 275, 184, 91, 33, 32, 106, 100, "N/A"),
    ("2024-25", 72, 14, 58, 79, 25, 0, 0, "No"),    # pct_affordable as printed
]

# Printed "Total" row of Attachment B (as read from the report).
PRINTED_TOTAL = dict(total=7089, market=4577, affordable=2512, city_funded=1560,
                     pct_affordable=35, pct_vll=24, pct_affordable_city_funded=84)


def rnd(x):
    """Round-half-up to nearest integer (the convention a spreadsheet uses for
    a displayed integer percent). Avoids Python's banker's rounding so results
    are unambiguous and reproducible."""
    from math import floor
    return floor(x + 0.5)


def pct(num, den):
    return None if den == 0 else 100 * Fraction(num, den)


print("=" * 72)
print("1. COLUMN SUMS vs PRINTED TOTAL ROW")
print("=" * 72)
for key, idx in [("total", 1), ("market", 2), ("affordable", 3), ("city_funded", 6)]:
    s = sum(r[idx] for r in ROWS)
    p = PRINTED_TOTAL[key]
    flag = "OK" if s == p else f"MISMATCH (diff {s - p:+d})"
    print(f"  sum({key:12}) = {s:5d}   printed total = {p:5d}   [{flag}]")

print()
print("=" * 72)
print("2. CLAIM A  -  2000-01 city-funded printed as 120")
print("=" * 72)
y, tot, mkt, aff, pa, pvll, cf, pcf, comp = next(r for r in ROWS if r[0] == "2000-01")
print(f"  Row 2000-01 as printed: affordable={aff}, city_funded={cf}, "
      f"pct_affordable_city_funded={pcf}%")
print(f"  (a) city_funded <= affordable ?  {cf} <= {aff}  ->  {cf <= aff} "
      f"{'(VIOLATED: a subset cannot exceed its parent)' if cf > aff else ''}")
ratio = pct(cf, aff)
print(f"  (b) printed%% implies city_funded/affordable. As printed: "
      f"{cf}/{aff} = {float(ratio):.1f}%  vs printed {pcf}%  "
      f"->  {'MATCH' if ratio is not None and rnd(ratio)==pcf else 'MISMATCH'}")
# What integer city_funded reproduces the printed 18%?
cands = [c for c in range(0, aff + 1) if rnd(100 * Fraction(c, aff)) == pcf]
print(f"  (c) integer city_funded values in [0,{aff}] that round to {pcf}%: {cands}")
print(f"  (d) column-sum gap from check 1 above: as-printed sum exceeds the "
      f"printed 1560 total by exactly {sum(r[6] for r in ROWS) - 1560}.")
print("  => Three independent printed figures (the 18% cell, the 1560 column")
print("     total, and the affordable<=parent constraint) all imply ~20, not 120.")

print()
print("=" * 72)
print("3. CLAIM B  -  does pct_affordable equal round(affordable/total)?")
print("=" * 72)
mismatches = []
for r in ROWS:
    y, tot, mkt, aff = r[0], r[1], r[2], r[3]
    pa = r[4]
    # identity the report asserts elsewhere: market + affordable == total
    ident = (mkt + aff == tot)
    if tot == 0:
        # 0 residences -> percent is vacuously 0; not a real mismatch.
        continue
    ratio = pct(aff, tot)
    calc = rnd(ratio)
    if calc != pa:
        mismatches.append((y, aff, tot, float(ratio), calc, pa))
    if not ident:
        print(f"  [!] {y}: market+affordable ({mkt}+{aff}) != total ({tot})")
print(f"  Rows (with total>0) where round(affordable/total) != printed "
      f"pct_affordable: {len(mismatches)}")
for y, aff, tot, ratio, calc, pa in mismatches:
    print(f"    {y}: {aff}/{tot} = {ratio:.2f}% -> rounds to {calc}%, "
          f"but printed {pa}%")

print()
print("=" * 72)
print("4. EMPIRICAL FORMULA CHECK  -  which denominator fits pct_affordable?")
print("=" * 72)
# Test candidate denominators across all rows; report exact-match counts.
for name, den_fn in [
    ("affordable/total", lambda r: (r[3], r[1])),
    ("affordable/market", lambda r: (r[3], r[2])),
    ("affordable/(market+affordable)", lambda r: (r[3], r[2] + r[3])),
]:
    hits = 0
    for r in ROWS:
        num, den = den_fn(r)
        ratio = pct(num, den)
        if ratio is not None and rnd(ratio) == r[4]:
            hits += 1
    print(f"  pct_affordable == round({name}): {hits}/{len(ROWS)} rows match")
