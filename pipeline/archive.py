import json
import pandas as pd
from datetime import datetime, date, timezone
from pathlib import Path

from .config import SNAPSHOT_INDEX_FILE, CLEAN_SCHEMA_VERSION, PIPELINE_VERSION


def get_today_snapshot_date():
    return date.today().isoformat()


def normalize_snapshot_date(snapshot_date=None):
    if snapshot_date is None or str(snapshot_date).strip() == "":
        return get_today_snapshot_date()
    value = str(snapshot_date).strip()
    datetime.strptime(value, "%Y-%m-%d")
    return value


def get_snapshot_paths(snapshot_date, archive_root, schema_version=CLEAN_SCHEMA_VERSION):
    snapshot_date = normalize_snapshot_date(snapshot_date)
    root = Path(archive_root)
    snapshot_dir = root / snapshot_date
    raw_dir = snapshot_dir / "raw"
    clean_latest_dir = snapshot_dir / "clean_latest"
    clean_archive_dir = snapshot_dir / "clean_archive" / schema_version
    manifest_path = snapshot_dir / "manifest.json"
    return {
        "snapshot_date": snapshot_date,
        "root": root,
        "snapshot_dir": snapshot_dir,
        "raw_dir": raw_dir,
        "clean_latest_dir": clean_latest_dir,
        "clean_archive_dir": clean_archive_dir,
        "manifest_path": manifest_path,
    }


def ensure_snapshot_dirs(paths):
    for key in ["root", "snapshot_dir", "raw_dir", "clean_latest_dir", "clean_archive_dir"]:
        paths[key].mkdir(parents=True, exist_ok=True)


def save_dataframe_outputs(df, base_name, directory, legacy_dir=None, float_format="%.2f"):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    csv_path = directory / f"{base_name}.csv"
    json_path = directory / f"{base_name}.json"
    df.to_csv(csv_path, index=False, float_format=float_format)
    df.to_json(json_path, orient="records", date_format="iso", indent=2)

    if legacy_dir:
        legacy_dir = Path(legacy_dir)
        legacy_dir.mkdir(parents=True, exist_ok=True)
        df.to_csv(legacy_dir / f"{base_name}.csv", index=False, float_format=float_format)
        df.to_json(legacy_dir / f"{base_name}.json", orient="records", date_format="iso", indent=2)

    return {"csv": str(csv_path), "json": str(json_path)}


def save_raw_dataframe(df, iso_key, raw_dir, legacy_dir):
    return save_dataframe_outputs(df, f"raw_{iso_key.lower()}", raw_dir, legacy_dir=legacy_dir)


def save_clean_dataframe(df, iso_key, clean_latest_dir, clean_archive_dir, legacy_dir):
    base_name = f"clean_{iso_key.lower()}"
    latest_paths = save_dataframe_outputs(df, base_name, clean_latest_dir, legacy_dir=legacy_dir)
    save_dataframe_outputs(df, base_name, clean_archive_dir)
    return latest_paths


def read_raw_snapshot(iso_key, raw_dir):
    path = Path(raw_dir) / f"raw_{iso_key.lower()}.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing raw snapshot file: {path}")
    return pd.read_csv(path)


def write_manifest(paths, manifest):
    paths["manifest_path"].write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")


def update_snapshot_index(snapshot_date, master_path, manifest_path, archive_root):
    index_path = Path(archive_root) / "snapshot_index.json"
    public_index_path = Path(SNAPSHOT_INDEX_FILE)
    index_path.parent.mkdir(parents=True, exist_ok=True)

    existing = {"snapshots": []}
    if index_path.exists():
        try:
            existing = json.loads(index_path.read_text(encoding="utf-8"))
        except Exception:
            existing = {"snapshots": []}

    snapshots = existing.get("snapshots", [])
    snapshots = [s for s in snapshots if s.get("date") != snapshot_date]
    snapshots.append({
        "date": snapshot_date,
        "label": datetime.strptime(snapshot_date, "%Y-%m-%d").strftime("%B %d, %Y"),
        "path": str(master_path).replace("\\", "/"),
        "manifest": str(manifest_path).replace("\\", "/"),
        "clean_schema_version": CLEAN_SCHEMA_VERSION,
        "pipeline_version": PIPELINE_VERSION,
    })
    snapshots = sorted(snapshots, key=lambda d: d.get("date", ""), reverse=True)

    updated = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "archive_root": str(Path(archive_root)).replace("\\", "/"),
        "snapshots": snapshots,
    }
    index_path.write_text(json.dumps(updated, indent=2), encoding="utf-8")
    public_index_path.write_text(json.dumps(updated, indent=2), encoding="utf-8")
    return index_path
