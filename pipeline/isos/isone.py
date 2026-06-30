import pandas as pd
from io import BytesIO
from datetime import datetime, timezone
from ..http import session
from ..helpers import map_fuel, clean_mw_value, normalize_frame, clean_date_columns, set_default_columns

_BASE_URL = "https://irtt.iso-ne.com/reports/exportpublicqueue"

_CLEAN_COLUMNS = [
    "Project ID", "Name", "ISO", "Status",
    "Queue Date", "Withdrawn Date", "County", "State", "Zone",
    "MW Capacity", "Fuel Type", "Proposed Date",
]


_PROJECT_STATUS_MAP = {
    "under study": "Active",
    "under construction": "Active",
    "suspended": "Active",
    "partially in service": "Done",
    "in service": "Done",
}


def _isone_status(row):
    official = str(row.get("Project Status") or "").strip().lower()
    if official in _PROJECT_STATUS_MAP:
        return _PROJECT_STATUS_MAP[official]

    if pd.notna(row.get("Withdrawn Date")):
        return "Withdrawn"

    return "Active"


def download():
    print("Downloading ISO-NE...")
    dotnet_epoch = datetime(1, 1, 1)
    ticks = int((datetime.now(timezone.utc).replace(tzinfo=None) - dotnet_epoch).total_seconds() * 1e7)
    url = f"{_BASE_URL}?ReportDate={ticks}&Status=&Jurisdiction="
    response = session.get(url, timeout=60)
    response.raise_for_status()

    df = pd.read_excel(BytesIO(response.content), header=4)
    df = normalize_frame(df)
    df = df.dropna(how="all").reset_index(drop=True)

    mw_columns = [col for col in df.columns if "mw" in col.lower()]
    for col in mw_columns:
        df[col] = (
            df[col].astype(str)
            .str.replace("'", "", regex=False)
            .str.replace("'", "", regex=False)
            .str.replace("'", "", regex=False)
            .str.replace('"', "", regex=False)
            .str.strip()
        )
        df[col] = pd.to_numeric(df[col], errors="coerce").round(2)

    return df


def clean(df):
    print("Creating clean ISO-NE sheet...")
    df = df.copy()

    rename_map = {
        "Position": "Project ID",
        "Alternative Name": "Name",
        "Requested": "Queue Date",
        "W/ D Date": "Withdrawn Date",
        "County": "County",
        "Sate": "State",
        "State": "State",
        "Zone": "Zone",
        "Summer MW": "MW Capacity",
        "Fuel Type": "Fuel Type",
        "Op Date": "Proposed Date",
        "Project Status": "Project Status",
    }
    df = df.rename(columns=rename_map)
    df["ISO"] = "ISONE"

    df["Fuel Type"] = (
        df["Fuel Type"].apply(lambda x: map_fuel(x, "ISO-NE"))
        if "Fuel Type" in df.columns else "Other"
    )

    if "MW Capacity" in df.columns:
        df["MW Capacity"] = pd.to_numeric(
            df["MW Capacity"].apply(clean_mw_value), errors="coerce"
        ).round(2)
    else:
        df["MW Capacity"] = pd.NA

    df = clean_date_columns(df, ["Queue Date", "Withdrawn Date", "Proposed Date"])
    df["Status"] = df.apply(_isone_status, axis=1)

    df = df[df["MW Capacity"] >= 5]
    df = df[df["Queue Date"].isna() | (df["Queue Date"].dt.year >= 2015)]

    df = set_default_columns(df, _CLEAN_COLUMNS, default=None)
    return df[_CLEAN_COLUMNS].reset_index(drop=True)
