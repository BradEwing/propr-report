"""Validate the curated CSVs against the totals printed in the source PDFs.

Every assertion encodes a number that appears as a "Total" row (or a documented
cross-check) in the reports. A failure means a transcription slip in the CSV.
Run: py tools/validate_curated.py
"""
import sys
import pandas as pd
from pathlib import Path

CURATED = Path(__file__).resolve().parent.parent / "data" / "curated"
failures = []


def check(label, got, want):
    ok = got == want
    print(f"  [{'OK' if ok else 'FAIL'}] {label}: got {got}, want {want}")
    if not ok:
        failures.append(label)


# --- Cumulative (Attachment B, FY2024-25 report = authoritative) ---
print("cumulative_prop_r_achievements.csv")
cum = pd.read_csv(CURATED / "cumulative_prop_r_achievements.csv")
check("rows (FY1994-95..2024-25)", len(cum), 31)
check("sum total_residences", int(cum.total_residences.sum()), 7089)
check("sum market_rate_residences", int(cum.market_rate_residences.sum()), 4577)
check("sum affordable_residences", int(cum.affordable_residences.sum()), 2512)
check("sum city_funded_affordable", int(cum.city_funded_affordable_residences.sum()), 1560)
# Per-row identity printed in the table: market + affordable = total.
bad = cum[(cum.market_rate_residences + cum.affordable_residences) != cum.total_residences]
check("per-row market+affordable==total (bad rows)", len(bad), 0)

# --- Completed (Attachment A) ---
print("completed_developments.csv")
comp = pd.read_csv(CURATED / "completed_developments.csv")
a2324 = comp[comp.source_fiscal_year == "2023-24"]
a2425 = comp[comp.source_fiscal_year == "2024-25"]
check("FY23-24 above_moderate", int(a2324.above_moderate.sum()), 184)
check("FY23-24 vli", int(a2324.vli.sum()), 81)
check("FY23-24 li", int(a2324.li.sum()), 8)
check("FY23-24 moderate", int(a2324.moderate.sum()), 2)
check("FY24-25 above_moderate", int(a2425.above_moderate.sum()), 14)
check("FY24-25 eli", int(a2425.eli.sum()), 17)
check("FY24-25 vli", int(a2425.vli.sum()), 0)
check("FY24-25 li", int(a2425.li.sum()), 1)
check("FY24-25 moderate", int(a2425.moderate.sum()), 40)
check("FY24-25 total_units", int(a2425.total_units.sum()), 72)

# --- Under construction (Attachment C) ---
print("under_construction.csv")
uc = pd.read_csv(CURATED / "under_construction.csv")
c2324 = uc[uc.source_fiscal_year == "2023-24"]
c2425 = uc[uc.source_fiscal_year == "2024-25"]
for fy, df, units, a30, a50, a80, a120, above in [
    ("2023-24", c2324, 849, 113, 37, 26, 67, 606),
    ("2024-25", c2425, 927, 133, 57, 45, 86, 606),
]:
    check(f"{fy} num_units", int(df.num_units.sum()), units)
    check(f"{fy} ami_30", int(df.ami_30.sum()), a30)
    check(f"{fy} ami_50", int(df.ami_50.sum()), a50)
    check(f"{fy} ami_80", int(df.ami_80.sum()), a80)
    check(f"{fy} ami_120", int(df.ami_120.sum()), a120)
    check(f"{fy} above_moderate", int(df.above_moderate.sum()), above)

# --- Planning approvals (Attachment D) ---
print("planning_approvals.csv")
pa = pd.read_csv(CURATED / "planning_approvals.csv")
p2324 = pa[pa.source_fiscal_year == "2023-24"]
p2425 = pa[pa.source_fiscal_year == "2024-25"]
for fy, df, mod, li, vli, above in [
    ("2023-24", p2324, 7, 8, 73, 756),
    ("2024-25", p2425, 134, 166, 67, 1779),
]:
    check(f"{fy} moderate", int(df.moderate.sum()), mod)
    check(f"{fy} li", int(df.li.sum()), li)
    check(f"{fy} vli", int(df.vli.sum()), vli)
    check(f"{fy} above_moderate", int(df.above_moderate.sum()), above)

print()
if failures:
    print(f"{len(failures)} CHECK(S) FAILED: {failures}")
    sys.exit(1)
print("All curated totals reconcile against the source PDFs.")
