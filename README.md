# Interconnection Queue Dashboard

A developer-facing interconnection queue intelligence dashboard covering
**ERCOT, ISO-NE, MISO, PJM, and SPP**. It tracks project volumes, fuel-mix
shifts, and queue timing across all major U.S. markets, with per-ISO deep-dive
pages, filterable charts, and sortable project tables.

This is the Flask-served edition of the original standalone `dashboard.html`.
All dashboard functionality is preserved verbatim — only the delivery mechanism
changed (a Flask server now serves the page and data instead of opening a
single HTML file directly).

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the server

```bash
python app.py
```

### 3. Open in browser

```
http://localhost:5000
```

The dashboard automatically loads the newest snapshot listed in
`snapshot_index.json`. You can also use the **Upload JSON (manual fallback)**
control to load a `master_cross_iso.json` file by hand.

---

## Project Structure

```
New Interconnection Project/
├── app.py                     Flask server (serves page + snapshot data)
├── requirements.txt           Python dependencies (Flask)
├── README.md                  This file
├── snapshot_index.json        Index of available data snapshots
├── snapshots/                 Dated snapshot data (raw + cleaned JSON/CSV)
│   └── <YYYY-MM-DD>/
│       ├── manifest.json
│       ├── raw/
│       ├── clean_latest/
│       │   └── master_cross_iso.json   (loaded by the dashboard)
│       └── clean_archive/
├── templates/
│   └── index.html             Main page (Jinja2 template)
└── static/
    ├── css/
    │   └── styles.css         Full dashboard theme + layout
    └── js/
        └── app.js             All dashboard logic (Plotly charts, filters,
                               per-ISO deep dives, tables, normalization)
```

---

## How Data Loading Works

The front-end is a pure client-side dashboard. On load it:

1. `fetch("snapshot_index.json")` — gets the list of available snapshots.
2. `fetch("snapshots/<date>/clean_latest/master_cross_iso.json")` — loads the
   selected snapshot's master cross-ISO dataset.
3. Normalizes the records (ISO, Fuel, State, MW, QueueDate, ProjectID, year …)
   and renders every chart, KPI, and table.

Flask serves these two relative paths from the project root via dedicated
routes (`/snapshot_index.json` and `/snapshots/<path>`), so the original
relative `fetch` calls work unchanged. A manual JSON upload control remains
available as a fallback.

---

## Dashboard Sections

| Tab | Description |
|-----|-------------|
| Developer Insights | Cross-ISO summary KPIs, developer readout, queue-timing bubble chart, fuel-mix (stacked / pie), flexible capacity / projects / average comparison view. ISO vs State filter, fuel multi-select, year range. |
| ERCOT | Deep dive: zone / county / fuel / status / developer filters, queue & proposed year ranges, zone & county charts, fuel mix over time, queue advancement summary, queue-vs-proposed scatter, sortable/searchable project table. |
| ISO-NE | Deep dive: zone / state / county / fuel / status filters, KPIs (incl. withdrawal share, median queue→proposed), fuel mix over time, zone status concentration, queue-vs-proposed scatter, project table. |
| MISO | Deep dive: state / county / fuel / status / study-cycle / study-group / service-type filters, fuel mix over time, combined cycle/group view, queue-vs-proposed scatter, project table. |
| PJM | Deep dive: study-cycle / study-phase / status / fuel / transmission-owner filters, fuel mix over time, queue-vs-proposed scatter, study-phase advancement summary, project table. |
| SPP | Deep dive: state / county / fuel / status / study-cycle / study-group / service-type / transmission-owner filters, fuel mix over time, study cycle & group views, queue-vs-proposed scatter, top counties, project table. |

---

## External Libraries (CDN)

- [Plotly](https://cdn.plot.ly/plotly-latest.min.js) — all charts
- [Google Fonts](https://fonts.googleapis.com) — Inter + DM Mono

These remain absolute CDN URLs and require an internet connection.

---

## Preserved Features

- 100% of the original `dashboard.html` HTML, CSS, and JavaScript.
- All five ISO deep-dive pages, filters, charts, and tables.
- Snapshot auto-loading via `snapshot_index.json` + manual JSON upload fallback.
- All data normalization, calculations, and field mappings.
- All chart rendering and per-table sort/search behavior.
