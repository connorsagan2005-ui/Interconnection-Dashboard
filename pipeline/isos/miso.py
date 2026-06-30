import pandas as pd
from ..http import session
from ..helpers import map_fuel, clean_numeric_columns, clean_date_columns, set_default_columns

_URL = "https://www.misoenergy.org/api/giqueue/getprojects"

_STATUS_MAP = {
    "active": "Active",
    "done": "Done",
    "legacy: done": "Done",
    "pending revision approval": "Active",
    "pending transfer": "Active",
    "withdrawn": "Withdrawn",
}

_CLEAN_COLUMNS = [
    "Project ID",
    "ISO",
    "Queue Date",
    "Status",
    "County",
    "State",
    "POI Name",
    "MW Capacity",
    "Fuel Type",
    "Proposed Date",
    "Transmission Owner",
    "Study Cycle",
    "Study Group",
    "Service Type",
    "Done Date",
]


def download():
    print("Downloading MISO...")
    data = session.get(_URL, timeout=60).json()
    return pd.DataFrame(data)


def clean(df):
    print("Creating clean MISO sheet...")
    df = df.copy()

    rename_map = {
        "projectNumber": "Project ID",
        "queueDate": "Queue Date",
        "applicationStatus": "Status",
        "county": "County",
        "state": "State",
        "poiName": "POI Name",
        "summerNetMW": "MW Capacity",
        "fuelType": "Fuel Type",
        "inService": "Proposed Date",
        "transmissionOwner": "Transmission Owner",
        "studyCycle": "Study Cycle",
        "studyGroup": "Study Group",
        "svcType": "Service Type",
        "doneDate": "Done Date",
    }
    df = df.rename(columns=rename_map)
    df["ISO"] = "MISO"

    df["Status"] = (
        df["Status"].apply(
            lambda x: _STATUS_MAP.get(str(x).strip().lower(), "Active") if pd.notna(x) and str(x).strip() else "Active"
        ) if "Status" in df.columns else "Active"
    )

    df["Fuel Type"] = (
        df["Fuel Type"].apply(lambda x: map_fuel(x, "MISO"))
        if "Fuel Type" in df.columns else "Other"
    )

    df = clean_numeric_columns(df, ["MW Capacity"])
    df = clean_date_columns(df, ["Queue Date", "Proposed Date", "Done Date"])

    df = df[df["MW Capacity"] >= 5]
    df = df[df["Queue Date"].isna() | (df["Queue Date"].dt.year >= 2015)]

    df = set_default_columns(df, _CLEAN_COLUMNS, default=None)
    return df[_CLEAN_COLUMNS].reset_index(drop=True)
