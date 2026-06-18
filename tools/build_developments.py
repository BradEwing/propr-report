"""Build the unified `developments` table for the interactive map.

Reads the three curated address CSVs (completed, under construction, planning
approvals) and emits `data/curated/developments.csv`, one row per development
with a shared schema, a stable `dev_id` join key, normalized ISO dates, an
affordability breakdown, and a single derived `total_units`.

Source of truth stays the hand-curated CSVs (see data/curated/README.md). Do
not edit those inputs; this script only unions and shapes them.

Run: py tools/build_developments.py
"""
import re
import csv
from pathlib import Path

import pandas as pd

CURATED = Path(__file__).resolve().parent.parent / "data" / "curated"

OUT_COLUMNS = [
    "dev_id",
    "category",
    "project_id",
    "address",
    "street",
    "description",
    "zoning",
    "date_iso",
    "date_raw",
    "eli",
    "vli",
    "li",
    "moderate",
    "above_moderate",
    "affordable_units",
    "market_units",
    "total_units",
    "source_fiscal_year",
    "note",
]


def s(val):
    """Verbatim string of a cell, blank for missing/NaN."""
    if val is None:
        return ""
    if isinstance(val, float) and pd.isna(val):
        return ""
    text = str(val).strip()
    return "" if text.lower() == "nan" else text


def n(val):
    """Integer unit count; blank/NaN source reads as 0."""
    text = s(val)
    if text == "":
        return 0
    return int(float(text))


def iso_date(raw):
    """Normalize mixed US M/D/YYYY or MM/DD/YYYY to ISO YYYY-MM-DD."""
    raw = s(raw)
    if raw == "":
        return ""
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if not m:
        raise ValueError(f"Unparseable date: {raw!r}")
    month, day, year = (int(g) for g in m.groups())
    return f"{year:04d}-{month:02d}-{day:02d}"


def slugify(text):
    """Lowercase, collapse non-alphanumerics to single hyphens, trim."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def make_dev_id(category, address, street, seen):
    base = slugify(f"{category}-{address}-{street}")
    dev_id = base
    suffix = 2
    while dev_id in seen:
        dev_id = f"{base}-{suffix}"
        suffix += 1
    seen.add(dev_id)
    return dev_id


def row(category, *, project_id="", address, street, description="", zoning="",
        date_raw, eli, vli, li, moderate, above_moderate, total_units,
        source_fiscal_year, note=""):
    affordable = eli + vli + li + moderate
    return {
        "category": category,
        "project_id": project_id,
        "address": address,
        "street": street,
        "description": description,
        "zoning": zoning,
        "date_iso": iso_date(date_raw),
        "date_raw": s(date_raw),
        "eli": eli,
        "vli": vli,
        "li": li,
        "moderate": moderate,
        "above_moderate": above_moderate,
        "affordable_units": affordable,
        "market_units": above_moderate,
        "total_units": total_units,
        "source_fiscal_year": source_fiscal_year,
        "note": note,
    }


def build_completed():
    df = pd.read_csv(CURATED / "completed_developments.csv", dtype=str)
    rows = []
    for _, r in df.iterrows():
        eli, vli, li, moderate, above_moderate = (
            n(r.eli), n(r.vli), n(r.li), n(r.moderate), n(r.above_moderate))
        # FY2024-25 has total_units; FY2023-24 omitted it -> sum of bands.
        if s(r.total_units) != "":
            total = n(r.total_units)
        else:
            total = above_moderate + eli + vli + li + moderate
        rows.append(row(
            "completed",
            project_id=s(r.project_id),
            address=s(r.address),
            street=s(r.street),
            description=s(r.description),
            zoning=s(r.zoning),
            date_raw=r.final_date,
            eli=eli, vli=vli, li=li, moderate=moderate,
            above_moderate=above_moderate,
            total_units=total,
            source_fiscal_year=s(r.source_fiscal_year),
        ))
    return rows


def build_under_construction():
    df = pd.read_csv(CURATED / "under_construction.csv", dtype=str)
    # Each report is a point-in-time snapshot; keep only the latest, which is a
    # superset of the prior year. Drop earlier snapshots.
    latest = df.source_fiscal_year.map(s).max()
    df = df[df.source_fiscal_year.map(s) == latest]
    rows = []
    for _, r in df.iterrows():
        rows.append(row(
            "under_construction",
            address=s(r.address),
            street=s(r.street),
            date_raw=r.building_permit_date,
            eli=n(r.ami_30),       # ami_30 -> ELI
            vli=n(r.ami_50),       # ami_50 -> VLI
            li=n(r.ami_80),        # ami_80 -> LI
            moderate=n(r.ami_120),  # ami_120 -> Moderate
            above_moderate=n(r.above_moderate),
            total_units=n(r.num_units),
            source_fiscal_year=s(r.source_fiscal_year),
            note=s(r.note),
        ))
    return rows


def build_planning():
    df = pd.read_csv(CURATED / "planning_approvals.csv", dtype=str)
    # Two years' approvals are distinct projects. If any address+street collides
    # across years, keep the latest source_fiscal_year.
    df = df.copy()
    df["_fy"] = df.source_fiscal_year.map(s)
    df = df.sort_values("_fy").drop_duplicates(
        subset=[df.address.name, df.street.name], keep="last")
    rows = []
    for _, r in df.iterrows():
        # Planning has no ELI column -> 0.
        vli, li, moderate, above_moderate = (
            n(r.vli), n(r.li), n(r.moderate), n(r.above_moderate))
        rows.append(row(
            "planning",
            project_id=s(r.project_id),
            address=s(r.address),
            street=s(r.street),
            description=s(r.description),
            zoning=s(r.zoning),
            date_raw=r.final_date,
            eli=0, vli=vli, li=li, moderate=moderate,
            above_moderate=above_moderate,
            total_units=moderate + li + vli + above_moderate,
            source_fiscal_year=s(r.source_fiscal_year),
        ))
    return rows


def main():
    rows = build_completed() + build_under_construction() + build_planning()

    seen = set()
    for r in rows:
        r["dev_id"] = make_dev_id(
            r["category"], r["address"], r["street"], seen)

    out_path = CURATED / "developments.csv"
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_COLUMNS)
        writer.writeheader()
        for r in rows:
            writer.writerow({col: r[col] for col in OUT_COLUMNS})

    # --- Sanity summary ---
    df = pd.DataFrame(rows)
    print(f"Wrote {out_path} ({len(df)} rows)")
    assert df.dev_id.is_unique, "dev_id collision"
    print(f"  dev_id unique: {df.dev_id.is_unique}")
    print("  rows per category:")
    for cat, grp in df.groupby("category"):
        print(f"    {cat:20s} {len(grp):3d} rows, "
              f"total_units = {int(grp.total_units.sum())}")
    print(f"  total rows: {len(df)}")
    print(f"  total_units (all): {int(df.total_units.sum())}")
    # affordable + market should equal total on every row.
    bad = df[(df.affordable_units + df.market_units) != df.total_units]
    print(f"  rows where affordable+market != total: {len(bad)}")
    for _, b in bad.iterrows():
        print(f"    {b.dev_id}: aff={b.affordable_units} "
              f"mkt={b.market_units} total={b.total_units}")


if __name__ == "__main__":
    main()
