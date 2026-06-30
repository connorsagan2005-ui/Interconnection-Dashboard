import os

from flask import Flask, render_template, send_from_directory, abort, make_response
from flask_compress import Compress

app = Flask(__name__)
Compress(app)  # gzip all responses automatically

# Project root (folder containing this file). The dashboard's data snapshots
# live here, mirroring the original standalone layout so the front-end's
# relative fetches (snapshot_index.json + snapshots/...) keep working.
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
SNAPSHOTS_DIR = os.path.join(BASE_DIR, "snapshots")


# ── Routes ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main dashboard page."""
    return render_template("index.html")


@app.route("/snapshot_index.json")
def snapshot_index():
    path = os.path.join(BASE_DIR, "snapshot_index.json")
    if not os.path.exists(path):
        abort(404)
    resp = make_response(send_from_directory(BASE_DIR, "snapshot_index.json",
                                             mimetype="application/json"))
    resp.headers["Cache-Control"] = "public, max-age=300"
    return resp


@app.route("/snapshots/<path:filename>")
def snapshots(filename):
    if not os.path.isdir(SNAPSHOTS_DIR):
        abort(404)
    resp = make_response(send_from_directory(SNAPSHOTS_DIR, filename))
    # Snapshot files are immutable once written — cache aggressively in browser
    resp.headers["Cache-Control"] = "public, max-age=86400"
    return resp


if __name__ == "__main__":
    print("=" * 60)
    print("  Interconnection Queue Dashboard")
    print("=" * 60)
    index_path = os.path.join(BASE_DIR, "snapshot_index.json")
    if os.path.exists(index_path):
        print(f"  Snapshot index: {index_path}")
    else:
        print("  WARNING: snapshot_index.json not found.")
        print("  Use the manual JSON upload control as a fallback.")
    print("  Open http://localhost:5000")
    print("=" * 60)
    app.run(debug=False, port=5000)
