import pandas as pd
from io import BytesIO
from ..http import session
from ..helpers import map_fuel, normalize_frame, clean_numeric_columns, clean_date_columns, set_default_columns

_URL = "https://opsportal.spp.org/Studies/GenerateActiveCSV"

_SERVICE_TYPE_MAP = {
    "ER": "ERIS",
    "NR": "NRIS",
    "ER/NR": "ERIS/NRIS",
}

_DONE_STATUSES = {
    "IA FULLY EXECUTED/ON SCHEDULE",
    "IA FULLY EXECUTED/ON SUSPENSION",
    "IA FULLY EXECUTED/COMMERCIAL OPERATION",
}

_CLEAN_COLUMNS = [
    "Project ID",
    "ISO",
    "Status",
    "Queue Date",
    "Proposed Date",
    "Transmission Owner",
    "Service Type",
    "County",
    "State",
    "Study Cycle",
    "Study Group",
    "MW Capacity",
    "Fuel Type",
]


def download():
    print("Downloading SPP...")
    response = session.get(_URL, timeout=60)
    response.raise_for_status()
    df = pd.read_csv(BytesIO(response.content), skiprows=1)
    df = df.dropna(how="all").reset_index(drop=True)
    return df


def clean(df):
    print("Creating clean SPP sheet...")
    df = normalize_frame(df.copy())

    rename_map = {
        "Generation Interconnection Number": "Project ID",
        "Request Received": "Queue Date",
        "In-Service Date": "Proposed Date",
        "TO at POI": "Transmission Owner",
        "Nearest Town or County": "County",
        "Capacity": "MW Capacity",
        "Generation Type": "Fuel Type",
        "Service Type": "Service Type",
        "Status": "Raw Status",
        "Current Cluster": "Study Cycle",
        "Cluster Group": "Study Group",
    }
    df = df.rename(columns=rename_map)
    df = df.loc[:, ~df.columns.duplicated()]

    df["ISO"] = "SPP"

    df["Status"] = (
        df["Raw Status"].apply(
            lambda x: "Done" if pd.notna(x) and str(x).strip().upper() in _DONE_STATUSES else "Active"
        ) if "Raw Status" in df.columns else "Active"
    )

    df["Fuel Type"] = (
        df["Fuel Type"].apply(lambda x: map_fuel(x, "SPP"))
        if "Fuel Type" in df.columns else "Other"
    )

    if "Service Type" in df.columns:
        df["Service Type"] = df["Service Type"].apply(
            lambda x: _SERVICE_TYPE_MAP.get(str(x).strip(), x) if pd.notna(x) else x
        )

    df = clean_numeric_columns(df, ["MW Capacity"])
    df = clean_date_columns(df, ["Queue Date", "Proposed Date"])

    df = df[df["MW Capacity"] >= 5]
    df = df[df["Queue Date"].isna() | (df["Queue Date"].dt.year >= 2015)]

    df = set_default_columns(df, _CLEAN_COLUMNS, default=None)
    return df[_CLEAN_COLUMNS].reset_index(drop=True)
