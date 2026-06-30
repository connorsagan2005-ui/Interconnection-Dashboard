import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from .config import (
    RAW_OUTPUT_FOLDER, CLEAN_OUTPUT_FOLDER, ARCHIVE_ROOT_FOLDER,
    CLEAN_SCHEMA_VERSION, PIPELINE_VERSION, MASTER_COLUMNS,
)
from .archive import (
    normalize_snapshot_date, get_snapshot_paths, ensure_snapshot_dirs,
    save_raw_dataframe, save_clean_dataframe, read_raw_snapshot,
    write_manifest, update_snapshot_index, save_dataframe_outputs,
)
from .isos import spp, miso, ercot, isone, pjm

_ISO_STEPS = [
    ("spp",   spp.download,   spp.clean),
    ("miso",  miso.download,  miso.clean),
    ("ercot", ercot.download, ercot.clean),
    ("isone", isone.download, isone.clean),
    ("pjm",   pjm.download,   pjm.clean),
]


def build_wide_master(clean_frames):
    """Combines ISO clean frames into a wide master with shared columns first."""
    if not clean_frames:
        return pd.DataFrame()

    ordered_columns = list(MASTER_COLUMNS)
    for frame in clean_frames:
        for col in frame.columns:
            if col not in ordered_columns:
                ordered_columns.append(col)

    aligned = [frame.reindex(columns=ordered_columns) for frame in clean_frames]
    return pd.concat(aligned, ignore_index=True)


def _process_iso(iso_key, download_func, clean_func, mode, paths, raw_legacy, clean_legacy):
    """Downloads (or reads from archive) and cleans one ISO. Returns (clean_df, raw_meta, clean_meta, error)."""
    iso_upper = iso_key.upper()
    try:
        if mode == "download":
            df = download_func()
            raw_meta = {"file": f"raw/raw_{iso_key.lower()}.csv", "source_type": "csv", "download_status": "success"}
            save_raw_dataframe(df, iso_key, paths["raw_dir"], legacy_dir=raw_legacy)
            print(f"✅ {iso_upper} raw snapshot saved")
        elif mode == "reprocess":
            df = read_raw_snapshot(iso_key, paths["raw_dir"])
            raw_meta = {"file": f"raw/raw_{iso_key.lower()}.csv", "source_type": "csv", "download_status": "read_from_archive"}
            print(f"✅ {iso_upper} raw snapshot loaded for reprocess")
        else:
            raise ValueError(f"Unknown mode: {mode}")

        clean_df = clean_func(df)
        save_clean_dataframe(clean_df, iso_key, paths["clean_latest_dir"], paths["clean_archive_dir"], legacy_dir=clean_legacy)
        clean_meta = {"file": f"clean_latest/clean_{iso_key.lower()}.json", "status": "success"}
        print(f"✅ {iso_upper} clean snapshot saved")
        return clean_df.copy(), raw_meta, clean_meta, None

    except Exception as e:
        print(f"❌ {iso_upper} failed:", e)
        raw_meta = {"download_status": "failed"}
        clean_meta = {"status": "failed"}
        return None, raw_meta, clean_meta, str(e)


def run_all_downloads(
    mode="download",
    snapshot_date=None,
    archive_root=ARCHIVE_ROOT_FOLDER,
    schema_version=CLEAN_SCHEMA_VERSION,
):
    """
    mode='download': fetch fresh ISO data, archive, clean, and build master.
    mode='reprocess': read an existing dated raw snapshot and rebuild clean outputs.
    """
    snapshot_date = normalize_snapshot_date(snapshot_date)
    paths = get_snapshot_paths(snapshot_date, archive_root=archive_root, schema_version=schema_version)
    ensure_snapshot_dirs(paths)

    # Ensure legacy flat output folders exist
    Path(RAW_OUTPUT_FOLDER).mkdir(parents=True, exist_ok=True)
    Path(CLEAN_OUTPUT_FOLDER).mkdir(parents=True, exist_ok=True)

    manifest = {
        "snapshot_date": snapshot_date,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "pipeline_version": PIPELINE_VERSION,
        "clean_schema_version": schema_version,
        "raw_sources": {},
        "clean_outputs": {},
        "master_output": None,
        "errors": {},
    }

    master_list = []
    lock = threading.Lock()

    def _run(iso_key, download_func, clean_func):
        clean_df, raw_meta, clean_meta, error = _process_iso(
            iso_key, download_func, clean_func, mode, paths,
            raw_legacy=RAW_OUTPUT_FOLDER, clean_legacy=CLEAN_OUTPUT_FOLDER,
        )
        iso_upper = iso_key.upper()
        with lock:
            manifest["raw_sources"][iso_upper] = raw_meta
            manifest["clean_outputs"][iso_upper] = clean_meta
            if error:
                manifest["errors"][iso_upper] = error
            elif clean_df is not None:
                master_list.append(clean_df)

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_run, k, dl, cl): k for k, dl, cl in _ISO_STEPS}
        for future in as_completed(futures):
            future.result()  # re-raise any unexpected exception

    if master_list:
        master_df = build_wide_master(master_list)
        master_df = master_df[
            (master_df["MW Capacity"] >= 10) &
            (master_df["Fuel Type"] != "Unknown")
        ]

        latest_dir = paths["clean_latest_dir"]
        archive_dir = paths["clean_archive_dir"]
        legacy_dir = Path(CLEAN_OUTPUT_FOLDER)

        for directory in [latest_dir, archive_dir, legacy_dir]:
            directory.mkdir(parents=True, exist_ok=True)
            master_df.to_csv(directory / "master_cross_iso.csv", index=False, float_format="%.2f")
            master_df.to_json(directory / "master_cross_iso.json", orient="records", date_format="iso", indent=2)

        latest_master_json = latest_dir / "master_cross_iso.json"
        manifest["master_output"] = {
            "file": "clean_latest/master_cross_iso.json",
            "records": int(len(master_df)),
            "status": "success",
        }
        update_snapshot_index(snapshot_date, latest_master_json, paths["manifest_path"], archive_root=archive_root)
        print("✅ Master cross-ISO snapshot saved")
        print(f"✅ Snapshot index updated for {snapshot_date}")
    else:
        manifest["master_output"] = {"status": "not_created", "reason": "No ISO data collected"}
        print("⚠️  No ISO data collected — master file not created")

    write_manifest(paths, manifest)
    print(f"📁 Snapshot saved in: {paths['snapshot_dir']}")
    return manifest
