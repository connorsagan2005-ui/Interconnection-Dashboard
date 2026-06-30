import argparse
from pipeline.config import ARCHIVE_ROOT_FOLDER, CLEAN_SCHEMA_VERSION
from pipeline.pipeline import run_all_downloads


def main():
    parser = argparse.ArgumentParser(
        description="Download, archive, clean, and build interconnection dashboard data snapshots."
    )
    parser.add_argument(
        "--mode", choices=["download", "reprocess"], default="download",
        help="download fresh raw data or reprocess an existing raw snapshot",
    )
    parser.add_argument(
        "--snapshot-date", default=None,
        help="Snapshot date in YYYY-MM-DD format. Defaults to today.",
    )
    parser.add_argument(
        "--archive-root", default=ARCHIVE_ROOT_FOLDER,
        help="Root folder for dated snapshots.",
    )
    parser.add_argument(
        "--schema-version", default=CLEAN_SCHEMA_VERSION,
        help="Clean schema version label used under clean_archive/.",
    )
    args = parser.parse_args()

    run_all_downloads(
        mode=args.mode,
        snapshot_date=args.snapshot_date,
        archive_root=args.archive_root,
        schema_version=args.schema_version,
    )
    print("\n🎉 Pipeline complete.")


if __name__ == "__main__":
    main()
