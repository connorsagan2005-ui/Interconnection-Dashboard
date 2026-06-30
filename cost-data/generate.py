import json
import numpy as np
import pandas as pd
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

COL_MAP = {
    "Project #": "project_id",
    "Name": "name",
    "State": "state",
    "Study Group": "study_group",
    "Fuel": "fuel",
    "Summer MW": "summer_mw",
    "Winter MW": "winter_mw",
    "ERIS Upgrades ($mm)": "eris_cost",
    "NRIS Upgrades ($mm)": "nris_cost",
    "Interconnection Facility Cost ($mm)": "interconnection_cost",
    "Total Upgrades ($mm)": "total_cost",
    "ERIS $/kW": "eris_per_kw",
    "NRIS $/kW": "nris_per_kw",
    "Interconnection Facility Cost $/kW": "interconnection_per_kw",
    "Total $/kW": "total_per_kw",
}

NUMERIC = [
    "summer_mw", "winter_mw", "eris_cost", "nris_cost",
    "interconnection_cost", "total_cost", "eris_per_kw",
    "nris_per_kw", "interconnection_per_kw", "total_per_kw",
]


def load_data():
    candidates = list(SCRIPT_DIR.glob("*.xlsx")) + list(SCRIPT_DIR.glob("*.xls"))
    if not candidates:
        raise FileNotFoundError("No xlsx file found in cost-data/. Place your workbook there.")
    path = candidates[0]
    print(f"Loading: {path}")

    try:
        df = pd.read_excel(path, sheet_name="ProjectCost_Sorted", dtype=str)
    except Exception:
        df = pd.read_excel(path, sheet_name=0, dtype=str)

    df.columns = df.columns.str.strip()
    rename = {k: v for k, v in COL_MAP.items() if k in df.columns}
    df = df.rename(columns=rename)
    df = df.dropna(how="all")

    if "project_id" in df.columns:
        df = df[df["project_id"].notna() & (df["project_id"].str.strip() != "")]

    for col in NUMERIC:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    for col in ["project_id", "name", "state", "fuel", "study_group"]:
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str).str.strip()

    if "total_cost" in df.columns and "summer_mw" in df.columns:
        df["cost_per_mw"] = df.apply(
            lambda r: (r["total_cost"] / r["summer_mw"]) if r["summer_mw"] > 0 else 0.0, axis=1
        )

    for src, dst in [
        ("eris_cost", "eris_pct"),
        ("nris_cost", "nris_pct"),
        ("interconnection_cost", "interconnection_pct"),
    ]:
        if src in df.columns and "total_cost" in df.columns:
            df[dst] = df.apply(
                lambda r, s=src: (r[s] / r["total_cost"] * 100) if r["total_cost"] > 0 else 0.0, axis=1
            )

    if "total_cost" in df.columns:
        df["overall_rank"] = df["total_cost"].rank(ascending=False, method="min").astype(int)

    if "state" in df.columns and "total_cost" in df.columns:
        df["state_rank"] = (
            df.groupby("state")["total_cost"].rank(ascending=False, method="min").astype(int)
        )

    return df


def compute_filters(df):
    def safe_range(col):
        s = df[df[col] > 0][col] if col in df.columns else pd.Series()
        return [float(s.min()), float(s.max())] if len(s) else [0, 0]

    return {
        "states": sorted(df["state"].replace("", np.nan).dropna().unique().tolist()) if "state" in df.columns else [],
        "fuels": sorted(df["fuel"].replace("", np.nan).dropna().unique().tolist()) if "fuel" in df.columns else [],
        "study_groups": sorted(df["study_group"].replace("", np.nan).dropna().unique().tolist()) if "study_group" in df.columns else [],
        "mw_range": safe_range("summer_mw"),
        "cost_range": safe_range("total_cost"),
        "cpkw_range": safe_range("total_per_kw"),
    }


if __name__ == "__main__":
    df = load_data()

    data = json.loads(df.where(pd.notnull(df), None).to_json(orient="records"))
    projects_path = SCRIPT_DIR / "projects.json"
    with open(projects_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {len(data)} projects → {projects_path}")

    filters = compute_filters(df)
    filters_path = SCRIPT_DIR / "filters.json"
    with open(filters_path, "w") as f:
        json.dump(filters, f, indent=2)
    print(f"Wrote filters → {filters_path}")
    print("Done. Commit cost-data/projects.json and cost-data/filters.json.")
