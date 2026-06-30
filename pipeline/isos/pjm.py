import json
import pandas as pd
from io import BytesIO
from ..http import session
from ..helpers import map_fuel, clean_numeric_columns, clean_date_columns, set_default_columns

_URL = "https://www.pjm.com/m/ProjectTransition/GenerateExcelTransitionProjectsAll"

_JSON_MODEL = {
    "GridName": "ProjectTransition",
    "ItemType": 0,
    "Items": [
        {"ItemType": 3, "FilterName": "ProjectTypesTabs", "IsSingleItem": False, "Filter": ["Select Project Type"]},
        {"ItemType": 1, "FilterName": "HiddenTab", "IsSingleItem": True, "Filter": "Desc"},
        {"ItemType": 1, "FilterName": "ReportType", "IsSingleItem": True, "Filter": "SISReport"},
    ],
    "Paginator": {"ItemType": 7, "CurrentItmsPerPageValue": "5000", "CurrentPageIndex": "1"},
    "Sort": "QueueNumber",
    "SortDirection": "asc",
    "RelatedGridsFilters": "",
}

_HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0",
    "Accept": "*/*",
    "Origin": "https://www.pjm.com",
    "Referer": "https://www.pjm.com/",
}

_STATUS_MAP = {
    "EP": "Done",
    "UC": "Done",
    "UC-ISP": "Done",
}

_CLEAN_COLUMNS = [
    "Project ID", "ISO", "Queue Date", "Status", "Withdrawn Date",
    "Proposed Date", "Study Cycle", "Study Phase", "POI Name",
    "Transmission Owner", "MW Capacity", "Fuel Type",
]


def download():
    print("Downloading PJM...")
    payload = {"jsonModel": json.dumps(_JSON_MODEL)}
    response = session.post(_URL, data=payload, headers=_HEADERS, timeout=60)

    print("Status code:", response.status_code)
    content_type = response.headers.get("Content-Type", "")
    if "html" in content_type.lower():
        print("PJM returned HTML instead of Excel")
        return pd.DataFrame()

    return pd.read_excel(BytesIO(response.content), engine="openpyxl")


def clean(df):
    print("Creating clean PJM sheet...")
    df = df.copy()

    rename_map = {
        "Submitted Date": "Queue Date",
        "Requested In-Service Date": "Proposed Date",
        "Cycle": "Study Cycle",
        "Stage": "Study Phase",
        "Name": "POI Name",
        "Fuel": "Fuel Type",
        "Withdrawn Date": "Withdrawn Date",
        "Transmission Owner": "Transmission Owner",
        "Status": "Status",
    }
    df = df.rename(columns=rename_map)
    df["ISO"] = "PJM"

    if "Status" in df.columns:
        df["Status"] = df["Status"].apply(
            lambda x: _STATUS_MAP.get(str(x).strip(), x) if pd.notna(x) else x
        )

    df["Fuel Type"] = (
        df["Fuel Type"].apply(lambda x: map_fuel(x, "PJM"))
        if "Fuel Type" in df.columns else "Other"
    )

    df = clean_numeric_columns(df, ["MW Capacity"])
    df = clean_date_columns(df, ["Queue Date", "Proposed Date", "Withdrawn Date"])

    df = df[df["MW Capacity"] >= 5]
    df = df[df["Queue Date"].isna() | (df["Queue Date"].dt.year >= 2015)]

    df = set_default_columns(df, _CLEAN_COLUMNS, default=None)
    return df[_CLEAN_COLUMNS].reset_index(drop=True)
