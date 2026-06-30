import ast
import pandas as pd
from ..http import session
from ..helpers import map_fuel, clean_numeric_columns, clean_date_columns, set_default_columns

_URL = "https://ercotqueue.com/data/projects.json"

_MILESTONE_COLUMNS = [
    ("screening_started",  "Screening Started Date",    "Screening Started"),
    ("screening_complete", "Screening Complete Date",   "Screening Complete"),
    ("fis_requested",      "FIS Requested Date",        "FIS Requested"),
    ("fis_approved",       "FIS Approved Date",         "FIS Approved"),
    ("ia_signed",          "IA Signed Date",            "IA Signed"),
    ("construction_start", "Construction Start Date",   "Construction Start"),
    ("construction_end",   "Construction End Date",     "Construction End"),
    ("approved_energization", "Approved Energization Date", "Approved Energization"),
    ("approved_sync",      "Approved Sync Date",        "Approved Sync"),
]

_CLEAN_COLUMNS = [
    "Project ID", "Name", "Developer", "POI", "County", "Zone",
    "Queue Date", "Fuel Type", "MW Capacity", "Proposed Date", "Status",
    "Completion Probability", "State", "ISO",
    "Screening Started Date", "Screening Complete Date",
    "FIS Requested Date", "FIS Approved Date", "IA Signed Date",
    "Construction Start Date", "Construction End Date",
    "Approved Energization Date", "Approved Sync Date",
    "Latest Milestone", "Latest Milestone Date", "Milestones",
]


def _parse_milestones(value):
    if pd.isna(value):
        return {}
    text = str(value).strip()
    if not text:
        return {}
    try:
        parsed = ast.literal_eval(text)
    except (ValueError, SyntaxError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _parse_milestone_date(value):
    if pd.isna(value) or value is None:
        return pd.NaT
    if isinstance(value, pd.Timestamp):
        return value
    text = str(value).strip()
    if not text or text.lower() in {"none", "nan", "null", "unknown"}:
        return pd.NaT
    return pd.to_datetime(text, errors="coerce")


def _extract_milestone_date(mapping, key):
    if not isinstance(mapping, dict):
        return pd.NaT
    return _parse_milestone_date(mapping.get(key))


def download():
    print("Downloading ERCOT...")
    data = session.get(_URL, timeout=60).json()
    return pd.DataFrame(data["projects"])


def clean(df):
    print("Creating clean ERCOT sheet...")
    df = df.copy()

    df["Status"] = (
        df["funnel_stage"].apply(
            lambda x: "Done" if str(x).strip() == "5_commissioned" else "Active"
        ) if "funnel_stage" in df.columns else "Active"
    )

    rename_map = {
        "inr": "Project ID",
        "name": "Name",
        "developer": "Developer",
        "poi_location": "POI",
        "county": "County",
        "zone": "Zone",
        "fuel_display": "Fuel Type",
        "capacity_mw": "MW Capacity",
        "projected_cod": "Proposed Date",
        "completion_probability": "Completion Probability",
        "milestones": "Milestones",
    }
    df = df.rename(columns=rename_map)

    df["Fuel Type"] = (
        df["Fuel Type"].apply(lambda x: map_fuel(x, "ERCOT"))
        if "Fuel Type" in df.columns else "Other"
    )
    df["ISO"] = "ERCOT"
    df["State"] = "TX"

    if "Milestones" in df.columns:
        parsed = df["Milestones"].apply(_parse_milestones)
        for key, col, _ in _MILESTONE_COLUMNS:
            df[col] = parsed.apply(lambda m: _extract_milestone_date(m, key))
        df["Queue Date"] = parsed.apply(lambda m: _extract_milestone_date(m, "screening_started"))

        df["Latest Milestone"] = None
        df["Latest Milestone Date"] = pd.NaT
        for _, col, label in _MILESTONE_COLUMNS:
            unfilled = df["Latest Milestone"].isna() & df[col].notna()
            df.loc[unfilled, "Latest Milestone"] = label
            df.loc[unfilled, "Latest Milestone Date"] = df.loc[unfilled, col]
    else:
        for _, col, _ in _MILESTONE_COLUMNS:
            df[col] = pd.NaT
        df["Queue Date"] = pd.NaT
        df["Latest Milestone"] = None
        df["Latest Milestone Date"] = pd.NaT

    date_cols = ["Queue Date", "Proposed Date"] + [c for _, c, _ in _MILESTONE_COLUMNS] + ["Latest Milestone Date"]
    df = clean_numeric_columns(df, ["MW Capacity", "Completion Probability"])
    df = clean_date_columns(df, date_cols)

    df = df[df["MW Capacity"] >= 5]

    df = set_default_columns(df, _CLEAN_COLUMNS, default=None)
    return df[_CLEAN_COLUMNS].reset_index(drop=True)
