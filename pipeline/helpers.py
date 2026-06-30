import re
import pandas as pd
from .config import FUEL_MAPPINGS


def map_fuel(value, iso):
    """Maps raw ISO fuel values into standardized fuel categories."""
    if pd.isna(value):
        return "Other"

    fuel = str(value).strip()
    fuel_upper = fuel.upper()

    mapping = FUEL_MAPPINGS.get(iso, {})

    if fuel in mapping:
        return mapping[fuel]

    if fuel_upper in mapping:
        return mapping[fuel_upper]

    if iso == "PJM":
        parts = [p.strip() for p in fuel.split(",")]
        if len(parts) > 1:
            if any(p in ["Solar", "Wind", "Storage"] for p in parts):
                return "Hybrid"
            return "Thermal"
        if parts and parts[0] in mapping:
            return mapping[parts[0]]

    if iso == "ISO-NE":
        parts = fuel.split()
        if len(parts) > 1:
            return mapping.get(fuel_upper, "Thermal")
        return mapping.get(fuel_upper, "Other")

    return "Other"


def clean_mw_value(value):
    """Cleans ISO-NE MW values that may contain stray quote characters."""
    if pd.isna(value):
        return pd.NA

    text = str(value).strip()
    text = (
        text.replace("’", "")
            .replace("‘", "")
            .replace("'", "")
            .replace("`", "")
            .replace('"', "")
            .strip()
    )
    text = text.replace(",", "")

    match = re.search(r"-?\d+(\.\d+)?", text)
    if not match:
        return pd.NA

    return round(float(match.group(0)), 2)


def normalize_frame(df):
    df.columns = df.columns.astype(str).str.strip()
    return df.loc[:, ~df.columns.duplicated()]


def clean_numeric_columns(df, columns):
    for col in columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").round(2)
        else:
            df[col] = pd.NA
    return df


def clean_date_columns(df, columns):
    for col in columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
        else:
            df[col] = pd.NaT
    return df


def set_default_columns(df, columns, default=None):
    for col in columns:
        if col not in df.columns:
            df[col] = default
    return df
