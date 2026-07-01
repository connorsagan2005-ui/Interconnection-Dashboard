
// ---------------- THEME (dark / light) ----------------
function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
}

// ---------------- GLOBAL PLOTLY THEME (theme-aware) + HOVER BEHAVIOR ----------------
// PLOTLY_THEME is rebuilt whenever the theme changes (see applyPlotlyTheme()).
// It is intentionally a `let` so the monkey-patched Plotly.newPlot below always
// reads the current theme's colors. Chart data/trace logic is untouched.
let PLOTLY_THEME = buildPlotlyTheme();

function buildPlotlyTheme() {
    const dark = isDark();
    const grid   = dark ? "#30363d" : "#deebd7";
    const line   = dark ? "#30363d" : "#c8dbbf";
    const axis   = dark ? "#e6edf3" : "#4a5e40";
    const strong = dark ? "#e6edf3" : "#182314";
    return {
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { family: "Inter, system-ui, sans-serif", color: axis, size: 12 },
        xaxis: {
            gridcolor: grid,
            linecolor: line,
            tickfont: { color: axis, size: 11 },
            titlefont: { color: axis, size: 12 }
        },
        yaxis: {
            gridcolor: grid,
            linecolor: line,
            tickfont: { color: axis, size: 11 },
            titlefont: { color: axis, size: 12 }
        },
        legend: {
            bgcolor: dark ? "rgba(22,27,34,0.95)" : "rgba(255,255,255,0.95)",
            bordercolor: line,
            borderwidth: 1,
            font: { color: axis, size: 11 }
        },
        hoverlabel: {
            bgcolor: dark ? "#161b22" : "#ffffff",
            bordercolor: line,
            font: { color: strong, size: 12, family: "Inter, system-ui, sans-serif" }
        },
        title: { font: { color: strong, size: 14, family: "Inter, system-ui, sans-serif" } }
    };
}

function applyPlotlyTheme() {
    PLOTLY_THEME = buildPlotlyTheme();
}

if (typeof Plotly !== "undefined" && !Plotly.__themePatched) {
    const _origNewPlot = Plotly.newPlot.bind(Plotly);
    Plotly.newPlot = function(div, data, layout, config) {
        const merged = Object.assign({}, PLOTLY_THEME, layout || {});
        merged.hovermode = "closest";
        merged.xaxis = Object.assign({}, PLOTLY_THEME.xaxis, (layout || {}).xaxis);
        merged.yaxis = Object.assign({}, PLOTLY_THEME.yaxis, (layout || {}).yaxis);
        merged.legend = Object.assign({}, PLOTLY_THEME.legend, (layout || {}).legend);
        merged.hoverlabel = Object.assign({}, PLOTLY_THEME.hoverlabel, (layout || {}).hoverlabel);
        merged.font = Object.assign({}, PLOTLY_THEME.font, (layout || {}).font);
        if ((layout || {}).title && typeof layout.title === "string") {
            merged.title = { text: layout.title, font: PLOTLY_THEME.title.font };
        }
        const el = typeof div === "string" ? document.getElementById(div) : div;
        if (el) el.classList.remove("chart-loading");
        return _origNewPlot(div, data, merged, config);
    };
    Plotly.__themePatched = true;
}

// ---------------- THEME TOGGLE / INIT ----------------
function markChartsLoading(panelId) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    panel.querySelectorAll(".chart-box").forEach(function(el) {
        if (!el.children.length) el.classList.add("chart-loading");
    });
}

function refreshActiveTabCharts() {
    // Rebuild Plotly theme then re-render whichever tab is active so charts
    // pick up the new dark/light colors. Uses existing update functions only.
    applyPlotlyTheme();
    const activeBtn = document.querySelector(".tab-button.active");
    const tabId = activeBtn ? activeBtn.dataset.tab : "developer-insights";
    try {
        if (tabId === "developer-insights" && typeof render === "function") render();
        else if (tabId === "scorecard" && typeof updateScorecard === "function") updateScorecard();
        else if (tabId === "ercot" && typeof updateErcotDeepDive === "function") updateErcotDeepDive();
        else if (tabId === "isone" && typeof updateIsoneDeepDive === "function") updateIsoneDeepDive();
        else if (tabId === "miso" && typeof updateMisoDeepDive === "function") updateMisoDeepDive();
        else if (tabId === "pjm" && typeof updatePjmDeepDive === "function") updatePjmDeepDive();
        else if (tabId === "spp" && typeof updateSppDeepDive === "function") updateSppDeepDive();
    } catch (e) {
        console.warn("Chart theme refresh skipped:", e);
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const dark = html.getAttribute("data-theme") === "dark";
    const next = dark ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    const btn = document.getElementById("theme-btn");
    if (btn && btn.childNodes.length) {
        btn.childNodes[btn.childNodes.length - 1].textContent = next === "dark" ? " Light Mode" : " Dark Mode";
    }
    refreshActiveTabCharts();
}

function initTheme() {
    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    applyPlotlyTheme();
    const btn = document.getElementById("theme-btn");
    if (btn && btn.childNodes.length) {
        btn.childNodes[btn.childNodes.length - 1].textContent = saved === "dark" ? " Light Mode" : " Dark Mode";
    }
}

// ---------------- SIDEBAR TOGGLE ----------------
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("collapsed");
}

// ---------------- LOADING / TOAST UTILITIES ----------------
function hideLoading() {
    const el = document.getElementById("loading");
    if (el) el.remove();
}

function showToast(msg, type) {
    const c = document.getElementById("toast-container");
    if (!c) return;
    const t = document.createElement("div");
    t.className = "toast " + (type || "info");
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// Apply saved theme as early as possible, then hide the loading overlay once
// the page has finished its first paint of the dashboard.
initTheme();
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { initTheme(); setTimeout(hideLoading, 350); });
} else {
    setTimeout(hideLoading, 350);
}


// ==========================================
// STANDARDIZED DATA SCHEMA FOR DASHBOARD
// ==========================================
// This dashboard expects Python to provide a standardized dataset.
// HTML should not contain ISO-specific logic.
//
// Each record should effectively contain:
// ISO       : string
// Fuel      : string
// State     : string
// MW        : number
// QueueDate : valid date or null
// ProjectID : string
// year      : number or null
//
// Defensive handling below makes the dashboard more robust if
// something is missing, but Python remains the source of truth.
// ==========================================

let masterData = [];
let ercotData = [];

const fuelColors = {
    "Solar":   "#f0c040",
    "Wind":    "#4ade80",
    "Storage": "#c084fc",
    "Hybrid":  "#f472b6",
    "Nuclear": "#38bdf8",
    "Thermal": "#fb923c",
    "Hydro":   "#22d3ee",
    "Unknown": "#6e7681",
    "Other":   "#6e7681"
};

const isoColors = {
    "PJM":    "#60a5fa",
    "MISO":   "#4ade80",
    "SPP":    "#fbbf24",
    "ISONE":  "#c084fc",
    "ISO-NE": "#c084fc",
    "ERCOT":  "#f87171"
};

const statePalette = [
    "#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#ef4444",
    "#0891b2", "#84cc16", "#f97316", "#14b8a6", "#8b5cf6",
    "#3b82f6", "#22c55e", "#d97706", "#a855f7", "#dc2626"
];

const fileInput = document.getElementById("fileInput");
const filterType = document.getElementById("filterType");
const marketFilter = document.getElementById("marketFilter");
const marketFilterLabel = document.getElementById("marketFilterLabel");
const metricView = document.getElementById("metricView");
const fuelMixView = document.getElementById("fuelMixView");
const yearStart = document.getElementById("yearStart");
const yearEnd = document.getElementById("yearEnd");
const resetFiltersBtn = document.getElementById("resetFilters");
const snapshotDateFilter = document.getElementById("snapshotDateFilter");
const snapshotReloadButton = document.getElementById("snapshotReloadButton");
const snapshotStatus = document.getElementById("snapshotStatus");
let snapshotIndex = [];

// Fuel dropdown refs
const fuelDropdown = document.getElementById("fuelDropdown");
const fuelDropdownButton = document.getElementById("fuelDropdownButton");
const fuelDropdownMenu = document.getElementById("fuelDropdownMenu");
const fuelCheckboxList = document.getElementById("fuelCheckboxList");
const fuelAllCheckbox = document.getElementById("fuelAllCheckbox");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
const ercotFileInput = document.getElementById("ercotFileInput"); // legacy; ERCOT now loads from masterData
const ercotStatus = document.getElementById("ercotStatus");
// ERCOT categorical filters are now multi-select dropdowns (no element references needed at top level)
const ercotQueueYearStart = document.getElementById("ercotQueueYearStart");
const ercotQueueYearEnd = document.getElementById("ercotQueueYearEnd");
const ercotProposedYearStart = document.getElementById("ercotProposedYearStart");
const ercotProposedYearEnd = document.getElementById("ercotProposedYearEnd");
const ercotResetFiltersBtn = document.getElementById("ercotResetFilters");
const ercotTableSearch = document.getElementById("ercotTableSearch");
let ercotProjectTableSort = { key: null, direction: "", type: "text" };

function showTab(tabId){
    tabButtons.forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle("active", isActive);
    });

    tabPanels.forEach(panel => {
        const isActive = panel.id === `tab-${tabId}-panel`;
        panel.classList.toggle("active", isActive);
    });

    if (tabId === "developer-insights") {
        setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
            if (typeof Plotly !== "undefined") {
                ["fuel", "isoChart", "comparisonChart"].forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        Plotly.Plots.resize(element);
                    }
                });
            }
        }, 80);
    }

    if (tabId === "ercot") {
        setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
            if (Array.isArray(masterData) && masterData.length > 0) {
                if (!Array.isArray(ercotData) || ercotData.length === 0) {
                    syncErcotDataFromMaster(true);
                } else {
                    updateErcotDeepDive();
                }
            } else {
                updateErcotDeepDive();
            }
        }, 80);
    }

    if (tabId === "scorecard") {
        setTimeout(() => {
            if (Array.isArray(masterData) && masterData.length > 0) {
                updateScorecard();
            }
        }, 80);
    }
}

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
});


showTab("developer-insights");

function setSnapshotStatus(message){
    if (snapshotStatus) snapshotStatus.innerText = message || "";
}

function formatSnapshotLabel(item){
    if (!item) return "Unknown snapshot";
    return item.label || item.date || item.path || "Unknown snapshot";
}

function setDataFreshnessBadge(dateStr) {
    var badge = document.getElementById("data-freshness-badge");
    var dot   = document.getElementById("data-freshness-dot");
    var label = document.getElementById("data-freshness-label");
    if (!badge || !label) return;
    if (!dateStr) { badge.style.display = "none"; return; }
    // Parse YYYY-MM-DD as local date to avoid UTC-offset day shift
    var d, text;
    var isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (isoMatch) {
        d = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
        text = "Data: " + d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } else {
        d = new Date(dateStr);
        text = "Data: " + (isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
    }
    var today = new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24));
    label.textContent = text;
    dot.className = "data-freshness-dot" + (diffDays > 2 ? " stale" : "");
    badge.style.display = "inline-flex";
}

function applyMasterDataRecords(records, sourceLabel){
    masterData = normalize(Array.isArray(records) ? records : []);

    if (!Array.isArray(masterData) || masterData.length === 0) {
        document.getElementById("status").innerText = "No records found in selected master data";
        return false;
    }

    document.getElementById("status").innerText = sourceLabel ? `Loaded ${sourceLabel} ✅` : "Loaded ✅";
    populateYearFilters();
    populateMarketFilter();
    populateFuelFilter();
    render();

    if (typeof syncErcotDataFromMaster === "function") syncErcotDataFromMaster(true);
    if (typeof syncMisoDataFromMaster === "function") syncMisoDataFromMaster(true);
    if (typeof syncIsoneDataFromMaster === "function") syncIsoneDataFromMaster(true);
    if (typeof syncPjmDataFromMaster === "function") syncPjmDataFromMaster(true);
    if (typeof syncSppDataFromMaster === "function") syncSppDataFromMaster(true);
    renderDataQualitySummary(masterData);
    if (typeof updateScorecard === "function") updateScorecard();
    return true;
}

function populateSnapshotDropdown(items){
    if (!snapshotDateFilter) return;
    snapshotIndex = Array.isArray(items) ? items : [];

    if (!snapshotIndex.length) {
        snapshotDateFilter.innerHTML = '<option value="">No snapshots found</option>';
        return;
    }

    snapshotDateFilter.innerHTML = snapshotIndex.map((item, index) => {
        const selected = index === 0 ? " selected" : "";
        return `<option value="${index}"${selected}>${formatSnapshotLabel(item)}</option>`;
    }).join("");
}

async function loadSnapshotIndex(){
    if (!snapshotDateFilter) return;
    snapshotDateFilter.disabled = true;
    if (snapshotReloadButton) snapshotReloadButton.disabled = true;
    setSnapshotStatus("Loading snapshot list...");

    try {
        const response = await fetch("snapshot_index.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const index = await response.json();
        const items = Array.isArray(index) ? index : (index.snapshots || []);
        populateSnapshotDropdown(items);

        if (items.length) {
            setSnapshotStatus(`Found ${items.length} snapshot${items.length === 1 ? "" : "s"}. Newest snapshot selected by default.`);
            await loadSelectedSnapshot();
        } else {
            setSnapshotStatus("No snapshots are listed in snapshot_index.json. Use manual upload as a fallback.");
        }
    } catch (error) {
        populateSnapshotDropdown([]);
        setSnapshotStatus("Snapshot index not found or blocked. If opening locally, use manual upload or host the dashboard folder.");
        console.warn("Unable to load snapshot_index.json", error);
    } finally {
        if (snapshotDateFilter) snapshotDateFilter.disabled = false;
        if (snapshotReloadButton) snapshotReloadButton.disabled = false;
    }
}

async function loadSelectedSnapshot(){
    if (!snapshotDateFilter || !snapshotIndex.length) return;
    const entry = snapshotIndex[Number(snapshotDateFilter.value)];
    if (!entry || !entry.path) {
        setSnapshotStatus("Selected snapshot does not include a master data path.");
        return;
    }

    snapshotDateFilter.disabled = true;
    if (snapshotReloadButton) snapshotReloadButton.disabled = true;
    setSnapshotStatus(`Loading ${formatSnapshotLabel(entry)}...`);

    try {
        const response = await fetch(entry.path, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const records = await response.json();
        if (applyMasterDataRecords(records, formatSnapshotLabel(entry))) {
            setSnapshotStatus(`Viewing ${formatSnapshotLabel(entry)}.`);
            setDataFreshnessBadge(entry.date || entry.label || null);
        }
    } catch (error) {
        setSnapshotStatus(`Unable to load ${formatSnapshotLabel(entry)}. Check that ${entry.path} exists relative to this HTML file.`);
        console.error("Unable to load selected snapshot", error);
    } finally {
        if (snapshotDateFilter) snapshotDateFilter.disabled = false;
        if (snapshotReloadButton) snapshotReloadButton.disabled = false;
    }
}

if (snapshotDateFilter) {
    snapshotDateFilter.addEventListener("change", loadSelectedSnapshot);
}
if (snapshotReloadButton) {
    snapshotReloadButton.addEventListener("click", loadSnapshotIndex);
}
loadSnapshotIndex();

// ---------------- SNAPSHOT DIFF ----------------

const snapshotDiffButton = document.getElementById("snapshotDiffButton");

async function runSnapshotDiff() {
    if (!snapshotIndex.length) { showToast("No snapshots loaded.", "error"); return; }
    const currentIdx = Number(snapshotDateFilter.value);
    const prevIdx = currentIdx + 1; // index 0 = newest; higher = older

    if (prevIdx >= snapshotIndex.length) {
        showToast("No previous snapshot to compare against.", "info");
        return;
    }

    const currentEntry = snapshotIndex[currentIdx];
    const prevEntry    = snapshotIndex[prevIdx];

    if (!currentEntry?.path || !prevEntry?.path) {
        showToast("Snapshot path missing.", "error");
        return;
    }

    showToast("Comparing snapshots…", "info");

    try {
        const [currentRaw, prevRaw] = await Promise.all([
            fetch(currentEntry.path, { cache: "no-store" }).then(r => r.json()),
            fetch(prevEntry.path,    { cache: "no-store" }).then(r => r.json())
        ]);

        const currentRecs = normalize(Array.isArray(currentRaw) ? currentRaw : []);
        const prevRecs    = normalize(Array.isArray(prevRaw)    ? prevRaw    : []);

        const currentIds = new Set(currentRecs.map(d => d.ProjectID));
        const prevIds    = new Set(prevRecs.map(d => d.ProjectID));

        const added     = currentRecs.filter(d => !prevIds.has(d.ProjectID));
        const removed   = prevRecs.filter(d => !currentIds.has(d.ProjectID));

        // Capacity that withdrew = capacity of removed projects
        const currentMW  = currentRecs.reduce((s, d) => s + (d.MW || 0), 0);
        const prevMW     = prevRecs.reduce((s, d)    => s + (d.MW || 0), 0);
        const addedMW    = added.reduce((s, d)   => s + (d.MW || 0), 0);
        const removedMW  = removed.reduce((s, d) => s + (d.MW || 0), 0);
        const netMW      = currentMW - prevMW;
        const netProjects = currentRecs.length - prevRecs.length;

        // Withdrawals: projects in prev that now have a withdraw status in current
        const currentById = Object.fromEntries(currentRecs.map(d => [d.ProjectID, d]));
        const newWithdrawals = prevRecs.filter(d => {
            const curr = currentById[d.ProjectID];
            return curr && String(curr.Status || "").toLowerCase().includes("withdraw")
                && !String(d.Status || "").toLowerCase().includes("withdraw");
        });

        const diffStats = document.getElementById("diffStats");
        const fromLabel = document.getElementById("diffFromLabel");
        const banner    = document.getElementById("snapshotDiffBanner");

        fromLabel.textContent = formatSnapshotLabel(prevEntry);

        const fmt = (n, prefix) => (n > 0 ? prefix + "+" : prefix) + n.toLocaleString();
        const fmtGW = mw => (mw / 1000).toFixed(2) + " GW";

        const statItems = [
            { label: "Projects", value: fmt(netProjects, ""), delta: netProjects, detail: `${added.length} added · ${removed.length} removed` },
            { label: "Total Capacity", value: (netMW >= 0 ? "+" : "") + fmtGW(netMW), delta: netMW, detail: `+${fmtGW(addedMW)} added · −${fmtGW(removedMW)} removed` },
            { label: "New Entries", value: added.length.toLocaleString(), delta: 1, detail: added.length ? fmtGW(addedMW) + " queued" : "none" },
            { label: "Removed", value: removed.length.toLocaleString(), delta: -removed.length, detail: removed.length ? fmtGW(removedMW) + " withdrawn" : "none" },
            { label: "New Withdrawals", value: newWithdrawals.length.toLocaleString(), delta: -newWithdrawals.length, detail: newWithdrawals.length ? "status changed to withdrawn" : "none" }
        ];

        diffStats.innerHTML = statItems.map(s => `
            <div class="diff-stat ${s.delta > 0 ? "positive" : s.delta < 0 ? "negative" : "neutral"}">
                <div class="diff-stat-value">${s.value}</div>
                <div class="diff-stat-label">${s.label}</div>
                <div class="diff-stat-detail">${s.detail}</div>
            </div>
        `).join("");

        banner.classList.remove("hidden");
        banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
        showToast("Failed to load comparison snapshot.", "error");
        console.error("Snapshot diff error:", err);
    }
}

if (snapshotDiffButton) {
    snapshotDiffButton.addEventListener("click", runSnapshotDiff);
}

fileInput.addEventListener("change", function(e){
    const files = Array.from(e.target.files);

    Promise.all(files.map(readFile)).then(dataArr => {
        let manualMasterRecords = [];
        dataArr.forEach(d => {
            if ((d.name || "").toLowerCase().includes("master")) {
                manualMasterRecords = d.data;
            }
        });

        if (!Array.isArray(manualMasterRecords) || manualMasterRecords.length === 0) {
            document.getElementById("status").innerText = "Load master_cross_iso.json";
            return;
        }

        applyMasterDataRecords(manualMasterRecords, "manual master JSON");
        if (snapshotDateFilter) snapshotDateFilter.value = "";
        setSnapshotStatus("Viewing manually uploaded data.");
    }).catch(() => {
        document.getElementById("status").innerText = "Unable to read the selected file(s)";
    });
});

if (ercotFileInput) {
    ercotFileInput.addEventListener("change", function(e){
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt){
            try {
                const rows = parseErcotCsv(evt.target.result);
                ercotData = normalizeErcotData(rows);
                populateErcotFilters();
                updateErcotDeepDive();
                if (ercotStatus) ercotStatus.innerText = "Loaded ERCOT data ✅";
            } catch (error) {
                if (ercotStatus) ercotStatus.innerText = "Unable to parse the selected ERCOT CSV";
            }
        };
        reader.readAsText(file);
    });
}

[ercotQueueYearStart, ercotQueueYearEnd, ercotProposedYearStart, ercotProposedYearEnd].forEach(el => {
    if (el) {
        el.addEventListener("change", updateErcotDeepDive);
    }
});

if (ercotTableSearch) {
    ercotTableSearch.addEventListener("input", () => {
        renderErcotProjectTable(getFilteredErcotData());
    });
}

if (ercotResetFiltersBtn) {
    ercotResetFiltersBtn.addEventListener("click", () => {
        resetMultiSelect("ercotZoneFilterDropdown", "All Zones");
        resetMultiSelect("ercotCountyFilterDropdown", "All Counties");
        resetMultiSelect("ercotFuelFilterDropdown", "All Fuels");
        resetMultiSelect("ercotStatusFilterDropdown", "All Statuses");
        resetMultiSelect("ercotDeveloperFilterDropdown", "All Developers");
        if (ercotTableSearch) ercotTableSearch.value = "";
        if (ercotQueueYearStart && ercotQueueYearEnd) {
            ercotQueueYearStart.value = ercotQueueYearStart.options[0] ? ercotQueueYearStart.options[0].value : "";
            ercotQueueYearEnd.value = ercotQueueYearEnd.options[ercotQueueYearEnd.options.length - 1] ? ercotQueueYearEnd.options[ercotQueueYearEnd.options.length - 1].value : "";
        }
        if (ercotProposedYearStart && ercotProposedYearEnd) {
            ercotProposedYearStart.value = ercotProposedYearStart.options[0] ? ercotProposedYearStart.options[0].value : "";
            ercotProposedYearEnd.value = ercotProposedYearEnd.options[ercotProposedYearEnd.options.length - 1] ? ercotProposedYearEnd.options[ercotProposedYearEnd.options.length - 1].value : "";
        }
        updateErcotDeepDive();
    });
}

filterType.addEventListener("change", () => {
    populateMarketFilter();
    render();
});
marketFilter.addEventListener("change", render);
metricView.addEventListener("change", render);
fuelMixView.addEventListener("change", render);
yearStart.addEventListener("change", () => {
    syncYearRange();
    populateMarketFilter();
    render();
});
yearEnd.addEventListener("change", () => {
    syncYearRange();
    populateMarketFilter();
    render();
});

resetFiltersBtn.addEventListener("click", () => {
    filterType.value = "ISO";
    metricView.value = "capacity";
    fuelMixView.value = "stacked";
    if (yearStart.options.length > 0) yearStart.selectedIndex = 0;
    if (yearEnd.options.length > 0) yearEnd.selectedIndex = yearEnd.options.length - 1;
    syncYearRange();
    populateMarketFilter();
    marketFilter.value = "All";

    fuelAllCheckbox.checked = true;
    Array.from(fuelCheckboxList.querySelectorAll('input[type="checkbox"]')).forEach(cb => cb.checked = true);
    updateFuelDropdownLabel();

    render();
});

// ---- Dropdown positioning helper (escapes sidebar overflow clipping) ----
function _positionDropdown(btn, menu) {
    var rect = btn.getBoundingClientRect();
    var spaceBelow = window.innerHeight - rect.bottom;
    menu.style.position = "fixed";
    menu.style.width = rect.width + "px";
    menu.style.left = rect.left + "px";
    menu.style.right = "auto";
    if (spaceBelow >= 160 || spaceBelow >= (window.innerHeight - rect.top)) {
        menu.style.top = (rect.bottom + 4) + "px";
        menu.style.bottom = "auto";
    } else {
        menu.style.top = "auto";
        menu.style.bottom = (window.innerHeight - rect.top + 4) + "px";
    }
    menu.style.maxHeight = Math.min(280, Math.max(spaceBelow - 8, window.innerHeight - rect.top - 8)) + "px";
}

// Fuel dropdown interactions
fuelDropdownButton.addEventListener("click", function(e) {
    e.stopPropagation();
    if (fuelDropdownMenu.classList.contains("hidden")) {
        _positionDropdown(fuelDropdownButton, fuelDropdownMenu);
        fuelDropdownMenu.classList.remove("hidden");
    } else {
        fuelDropdownMenu.classList.add("hidden");
    }
});

document.addEventListener("click", (e) => {
    if (!fuelDropdown.contains(e.target)) {
        fuelDropdownMenu.classList.add("hidden");
    }
});

fuelAllCheckbox.addEventListener("change", () => {
    const checkboxes = fuelCheckboxList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = fuelAllCheckbox.checked);
    updateFuelDropdownLabel();
    render();
});

// ---------------- HELPERS ----------------

function readFile(file){
    return new Promise(resolve=>{
        let reader = new FileReader();
        reader.onload = e => resolve({
            name: file && file.name ? file.name : "unknown.json",
            data: JSON.parse(e.target.result)
        });
        reader.readAsText(file);
    });
}

function normalize(data){
    if (!Array.isArray(data)) return [];

    return data.map(d => {
        const parsedDate = d && d["Queue Date"] ? new Date(d["Queue Date"]) : null;
        const validDate = parsedDate instanceof Date && !isNaN(parsedDate);
        const rawProposedDate = toDate(d && d["Proposed Date"]);
        // Treat proposed date as null if it's earlier than the queue date (invalid data)
        const proposedDate = (rawProposedDate && validDate && rawProposedDate < parsedDate) ? null : rawProposedDate;

        const screeningStartedDate = toDate(d && d["Screening Started Date"]);
        const screeningCompleteDate = toDate(d && d["Screening Complete Date"]);
        const fisRequestedDate = toDate(d && d["FIS Requested Date"]);
        const fisApprovedDate = toDate(d && d["FIS Approved Date"]);
        const iaSignedDate = toDate(d && d["IA Signed Date"]);
        const constructionStartDate = toDate(d && d["Construction Start Date"]);
        const constructionEndDate = toDate(d && d["Construction End Date"]);
        const approvedEnergizationDate = toDate(d && d["Approved Energization Date"]);
        const approvedSyncDate = toDate(d && d["Approved Sync Date"]);
        const latestMilestoneDate = toDate(d && d["Latest Milestone Date"]);

        return {
            // Shared dashboard fields
            ISO: (d && (d.ISO || d.iso)) ? String(d.ISO || d.iso) : "Unknown",
            Fuel: d && (d["Fuel Type"] || d.Fuel) ? String(d["Fuel Type"] || d.Fuel) : "Unknown",
            State: d && d.State ? String(d.State) : "Unknown",
            County: d && !isMissing(d["County"]) ? String(d["County"]).trim() : "",
            MW: d && (d["MW Capacity"] !== undefined || d.MW !== undefined)
                ? (+d["MW Capacity"] || +d.MW || 0)
                : 0,
            QueueDate: validDate ? parsedDate : null,
            ProjectID: d && (d["Project ID"] || d.ProjectID) ? String(d["Project ID"] || d.ProjectID) : "Unknown",
            Status: d && !isMissing(d["Status"]) ? String(d["Status"]).trim() : "Unknown",
            ProposedDate: proposedDate,
            year: validDate ? parsedDate.getFullYear() : null,
            proposedYear: proposedDate ? proposedDate.getFullYear() : null,

            // ERCOT and other deep-dive-friendly fields from the wide master JSON
            Name: d && !isMissing(d["Name"]) ? String(d["Name"]).trim() : "Unknown",
            Developer: d && !isMissing(d["Developer"]) ? String(d["Developer"]).trim() : "Unknown",
            POI: d && !isMissing(d["POI"]) ? String(d["POI"]).trim() : (!isMissing(d && d["POI Name"]) ? String(d["POI Name"]).trim() : ""),
            Zone: d && !isMissing(d["Zone"]) ? String(d["Zone"]).trim() : "",
            CompletionProbability: toNumber(d && d["Completion Probability"]),
            ScreeningStartedDate: screeningStartedDate,
            ScreeningCompleteDate: screeningCompleteDate,
            FISRequestedDate: fisRequestedDate,
            FISApprovedDate: fisApprovedDate,
            IASignedDate: iaSignedDate,
            ConstructionStartDate: constructionStartDate,
            ConstructionEndDate: constructionEndDate,
            ApprovedEnergizationDate: approvedEnergizationDate,
            ApprovedSyncDate: approvedSyncDate,
            LatestMilestone: d && !isMissing(d["Latest Milestone"]) ? String(d["Latest Milestone"]).trim() : "",
            LatestMilestoneDate: latestMilestoneDate,
            Milestones: d && !isMissing(d["Milestones"]) ? String(d["Milestones"]) : "",
            Latitude: toNumber(d && d["Latitude"]),
            Longitude: toNumber(d && d["Longitude"]),
            Raw: d || {}
        };
    }).filter(d => (d.MW || 0) > 0);
}

function getChartData(){
    return masterData.filter(d =>
        d.QueueDate &&
        d.year
    );
}

function getSelectedFuels(){
    const selected = Array.from(
        fuelCheckboxList.querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    return new Set(selected);
}

function getSelectedYears(){
    const start = Number(yearStart.value);
    const end = Number(yearEnd.value);
    return { start, end };
}

function getYearFilteredData(data){
    const { start, end } = getSelectedYears();
    return data.filter(d => (d.year || 0) >= start && (d.year || 0) <= end);
}

function getFilterType(){
    return filterType.value === "State" ? "State" : "ISO";
}

function getSelectedMarketValue(){
    return marketFilter.value || "All";
}

function populateMarketFilter(){
    const chartData = getYearFilteredData(getChartData());
    const mode = getFilterType();

    if (mode === "ISO") {
        marketFilterLabel.textContent = "Selected ISO";
        const isos = [...new Set(chartData.map(d => d.ISO || "Unknown"))].sort();
        const previous = marketFilter.value;
        marketFilter.innerHTML = '<option value="All">All ISOs</option>';
        isos.forEach(i => {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = i;
            marketFilter.appendChild(opt);
        });
        if ([...marketFilter.options].some(o => o.value === previous)) {
            marketFilter.value = previous;
        } else {
            marketFilter.value = "All";
        }
    } else {
        marketFilterLabel.textContent = "Selected State";
        const states = [...new Set(chartData.map(d => d.State || "Unknown"))].sort();
        const previous = marketFilter.value;
        marketFilter.innerHTML = '<option value="All">All States</option>';
        states.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s;
            opt.textContent = s;
            marketFilter.appendChild(opt);
        });
        if ([...marketFilter.options].some(o => o.value === previous)) {
            marketFilter.value = previous;
        } else {
            marketFilter.value = "All";
        }
    }
}

function populateFuelFilter(){
    const fuels = [...new Set(getChartData().map(d => d.Fuel || "Unknown"))].sort();
    fuelCheckboxList.innerHTML = "";

    fuels.forEach(f => {
        const label = document.createElement("label");
        label.className = "fuel-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = f;
        checkbox.checked = true;

        checkbox.addEventListener("change", () => {
            syncFuelAllCheckbox();
            updateFuelDropdownLabel();
            render();
        });

        label.addEventListener("dblclick", (e) => {
            e.preventDefault();
            const checkboxes = fuelCheckboxList.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = (cb.value === f));
            fuelAllCheckbox.checked = false;
            updateFuelDropdownLabel();
            render();
        });

        const span = document.createElement("span");
        span.textContent = f;

        label.appendChild(checkbox);
        label.appendChild(span);
        fuelCheckboxList.appendChild(label);
    });

    fuelAllCheckbox.checked = true;
    updateFuelDropdownLabel();
}

function syncFuelAllCheckbox(){
    const checkboxes = Array.from(fuelCheckboxList.querySelectorAll('input[type="checkbox"]'));
    const checkedCount = checkboxes.filter(cb => cb.checked).length;
    fuelAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
}

function updateFuelDropdownLabel(){
    const selected = Array.from(
        fuelCheckboxList.querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    const total = fuelCheckboxList.querySelectorAll('input[type="checkbox"]').length;

    if (selected.length === 0) {
        fuelDropdownButton.textContent = "No Fuels Selected";
    } else if (selected.length === total) {
        fuelDropdownButton.textContent = "All Fuels";
    } else if (selected.length === 1) {
        fuelDropdownButton.textContent = selected[0];
    } else {
        fuelDropdownButton.textContent = `${selected.length} Fuels Selected`;
    }
}

// ---- Multi-select checkbox dropdown helpers ----
function buildMultiSelect(containerId, values, allLabel, onChangeFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const btnId = containerId + "Btn";
    const menuId = containerId + "Menu";
    const allId  = containerId + "All";
    const listId = containerId + "List";
    container.innerHTML =
        `<button type="button" id="${btnId}" class="fuel-dropdown-button">${allLabel}</button>` +
        `<div id="${menuId}" class="fuel-dropdown-menu hidden">` +
          `<label class="fuel-option fuel-option-all"><input type="checkbox" id="${allId}" checked><span>${allLabel}</span></label>` +
          `<div id="${listId}"></div>` +
        `</div>`;
    const btn  = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    const allCb = document.getElementById(allId);
    const list  = document.getElementById(listId);
    btn.addEventListener("click", function(e) {
        e.stopPropagation();
        if (menu.classList.contains("hidden")) {
            _positionDropdown(btn, menu);
            menu.classList.remove("hidden");
        } else {
            menu.classList.add("hidden");
        }
    });
    document.addEventListener("click", function(ev) {
        if (!container.contains(ev.target)) menu.classList.add("hidden");
    });
    allCb.addEventListener("change", () => {
        list.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = allCb.checked);
        _updateMsLabel(btnId, listId, allLabel);
        if (onChangeFn) onChangeFn();
    });
    const sorted = [...new Set(values.filter(v => v != null && String(v).trim() !== ""))].sort();
    sorted.forEach(v => {
        const lbl = document.createElement("label");
        lbl.className = "fuel-option";
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.value = v; cb.checked = true;
        cb.addEventListener("change", () => {
            allCb.checked = [...list.querySelectorAll('input[type="checkbox"]')].every(c => c.checked);
            _updateMsLabel(btnId, listId, allLabel);
            if (onChangeFn) onChangeFn();
        });
        lbl.addEventListener("dblclick", e => {
            e.preventDefault();
            list.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = (c.value === v));
            allCb.checked = false;
            _updateMsLabel(btnId, listId, allLabel);
            if (onChangeFn) onChangeFn();
        });
        const span = document.createElement("span"); span.textContent = v;
        lbl.appendChild(cb); lbl.appendChild(span); list.appendChild(lbl);
    });
    _updateMsLabel(btnId, listId, allLabel);
}
function _updateMsLabel(btnId, listId, allLabel) {
    const btn  = document.getElementById(btnId);
    const list = document.getElementById(listId);
    if (!btn || !list) return;
    const total   = list.querySelectorAll('input[type="checkbox"]').length;
    const checked = list.querySelectorAll('input[type="checkbox"]:checked').length;
    if (checked === 0)          btn.textContent = "None Selected";
    else if (checked === total) btn.textContent = allLabel;
    else if (checked === 1)     btn.textContent = list.querySelector('input[type="checkbox"]:checked').value;
    else                        btn.textContent = `${checked} Selected`;
}
function getMultiSelectValues(containerId) {
    const list = document.getElementById(containerId + "List");
    if (!list) return [];
    const all     = list.querySelectorAll('input[type="checkbox"]').length;
    const checked = [...list.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
    return checked.length === all ? [] : checked;
}
function resetMultiSelect(containerId, allLabel) {
    const list  = document.getElementById(containerId + "List");
    const allCb = document.getElementById(containerId + "All");
    if (list)  list.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    if (allCb) allCb.checked = true;
    _updateMsLabel(containerId + "Btn", containerId + "List", allLabel);
}
document.addEventListener("click", () => {
    document.querySelectorAll(".fuel-dropdown-menu:not(.hidden)").forEach(m => m.classList.add("hidden"));
});

// ── Sidebar accordion ──────────────────────────────────────────────────────

function initSidebarAccordions() {
    document.querySelectorAll(".iso-filter-group").forEach(function(group) {
        group.querySelectorAll(".filter-section").forEach(function(section) {
            if (!section.hasAttribute("data-accordion")) return; // only wrap opted-in sections
            if (section.closest(".accordion-item")) return; // already wrapped

            var labelEl = section.querySelector(".filter-label");
            var title   = labelEl ? labelEl.textContent.trim() : "Filter";

            var item = document.createElement("div");
            item.className = "accordion-item";

            var trigger = document.createElement("button");
            trigger.type = "button";
            trigger.className = "accordion-trigger";

            var badge = document.createElement("span");
            badge.className = "accordion-badge";

            var arrow = document.createElement("span");
            arrow.className = "accordion-arrow";
            arrow.textContent = "▶";

            trigger.appendChild(document.createTextNode(title));
            trigger.appendChild(badge);
            trigger.appendChild(arrow);

            var body = document.createElement("div");
            body.className = "accordion-body";

            // Remove the redundant .filter-label since it's now the accordion title
            if (labelEl) labelEl.remove();

            // Move section contents into body
            while (section.firstChild) body.appendChild(section.firstChild);

            item.appendChild(trigger);
            item.appendChild(body);
            section.parentNode.insertBefore(item, section);
            section.remove();

            trigger.addEventListener("click", function(e) {
                e.stopPropagation();
                item.classList.toggle("open");
            });

            // Auto-update badge when any checkbox/select inside changes
            body.addEventListener("change", function() { _updateAccordionBadge(item, badge, body); });
            body.addEventListener("input",  function() { _updateAccordionBadge(item, badge, body); });
        });
    });
}

function _updateAccordionBadge(item, badge, body) {
    // Count active (non-default) selections
    var count = 0;

    // Multi-select dropdowns: count deselected if not all checked
    body.querySelectorAll(".fuel-dropdown-menu").forEach(function(menu) {
        var all      = menu.querySelectorAll('input[type="checkbox"]:not(.fuel-option-all input)').length;
        var checked  = menu.querySelectorAll('input[type="checkbox"]:not(.fuel-option-all input):checked').length;
        if (checked < all) count += (all - checked);
    });

    // Year range selects: count if not at default extremes
    var selects = body.querySelectorAll("select");
    selects.forEach(function(sel) {
        if (!sel.options.length) return;
        var isFirst = sel.selectedIndex === 0;
        var isLast  = sel.selectedIndex === sel.options.length - 1;
        if (!isFirst && !isLast) count += 1;
    });

    if (count > 0) {
        badge.textContent = count;
        badge.classList.add("visible");
        item.classList.add("open");
    } else {
        badge.classList.remove("visible");
    }
}

// Run after DOM is fully ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { setTimeout(initSidebarAccordions, 50); });
} else {
    setTimeout(initSidebarAccordions, 50);
}

// Re-run after filters are rebuilt (ISO-specific filter populations call buildMultiSelect which replaces DOM)
var _origBuildMultiSelect = buildMultiSelect;
buildMultiSelect = function(containerId, values, allLabel, onChangeFn) {
    _origBuildMultiSelect(containerId, values, allLabel, onChangeFn);
    // Re-init accordions after a tick so rebuilt DOM is stable
    setTimeout(initSidebarAccordions, 10);
};

function populateYearFilters(){
    const years = [...new Set(getChartData().map(d => d.year).filter(Boolean))].sort((a,b)=>a-b);
    yearStart.innerHTML = "";
    yearEnd.innerHTML = "";

    years.forEach(y => {
        const opt1 = document.createElement("option");
        opt1.value = y;
        opt1.textContent = y;
        yearStart.appendChild(opt1);

        const opt2 = document.createElement("option");
        opt2.value = y;
        opt2.textContent = y;
        yearEnd.appendChild(opt2);
    });

    if (years.length > 0) {
        yearStart.value = years[0];
        yearEnd.value = years[years.length - 1];
    }
}

function syncYearRange(){
    if (!yearStart.value || !yearEnd.value) return;
    if (Number(yearStart.value) > Number(yearEnd.value)) {
        const temp = yearStart.value;
        yearStart.value = yearEnd.value;
        yearEnd.value = temp;
    }
}

function formatMW(value){
    return `${Math.round(value || 0).toLocaleString()} MW`;
}

function formatGW(value){
    return `${((value || 0) / 1000).toFixed(2)} GW`;
}

function getMarketScopedData(){
    const chartData = getYearFilteredData(getChartData());
    const mode = getFilterType();
    const selected = getSelectedMarketValue();

    if (selected === "All") return chartData;

    if (mode === "ISO") {
        return chartData.filter(d => (d.ISO || "Unknown") === selected);
    } else {
        return chartData.filter(d => (d.State || "Unknown") === selected);
    }
}

function getFuelFilteredData(data){
    const selectedFuels = getSelectedFuels();
    return data.filter(d => selectedFuels.has(d.Fuel || "Unknown"));
}

function getComparisonRangeData(scopedData){
    return scopedData;
}

function getComparisonDisplayData(filteredData){
    return filteredData;
}

function getYearDomain(data){
    return [...new Set(data.map(d => d.year).filter(Boolean))].sort((a,b)=>a-b);
}

function getDateDomain(data){
    const valid = data.filter(d => d.QueueDate instanceof Date && !isNaN(d.QueueDate));
    if (!valid.length) return null;
    const times = valid.map(d => d.QueueDate.getTime());
    return [new Date(Math.min(...times)), new Date(Math.max(...times))];
}

function getComparisonGroupingMode(){
    const mode = getFilterType();
    const selected = getSelectedMarketValue();

    if (mode === "ISO") {
        return selected === "All" ? "ISO" : "State";
    } else {
        return "ISO";
    }
}

function getComparisonGroupingKeys(rangeData){
    const grouping = getComparisonGroupingMode();
    if (grouping === "ISO") {
        return [...new Set(rangeData.map(d => d.ISO || "Unknown"))].sort();
    }
    return [...new Set(rangeData.map(d => d.State || "Unknown"))].sort();
}

function getComparisonColor(key, mode){
    if (mode === "ISO") {
        return isoColors[key] || "#6b7280";
    }
    const palette = statePalette;
    const allStates = [...new Set(getChartData().map(d => d.State || "Unknown"))].sort();
    let index = allStates.indexOf(key);
    if (index === -1) {
        index = Math.abs(hashCode(key)) % palette.length;
    }
    return palette[index % palette.length];
}

function hashCode(str){
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return h;
}

function isMissing(value){
    if (value === null || value === undefined) return true;
    const normalized = String(value).trim();
    if (!normalized) return true;
    return ["unknown", "na", "nan", "none", "null"].includes(normalized.toLowerCase());
}

function toNumber(value){
    if (isMissing(value)) return 0;
    const numeric = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
}

function toDate(value){
    if (isMissing(value)) return null;
    const parsed = new Date(value);
    return parsed instanceof Date && !isNaN(parsed) ? parsed : null;
}

function formatPercent(value){
    return `${(value || 0).toFixed(1)}%`;
}

function median(values){
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

function average(values){
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseErcotCsv(text){
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            row.push(cell);
            cell = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") {
                i += 1;
            }
            row.push(cell);
            if (row.some(value => value !== "")) {
                rows.push(row);
            }
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        if (row.some(value => value !== "")) {
            rows.push(row);
        }
    }

    if (!rows.length) return [];

    const headers = rows[0].map(header => header.trim());
    return rows.slice(1).map(values => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = values[index] !== undefined ? values[index].trim() : "";
        });
        return record;
    });
}


function syncErcotDataFromMaster(resetFilters){
    ercotData = (Array.isArray(masterData) ? masterData : []).filter(d =>
        String(d.ISO || "").toUpperCase() === "ERCOT"
    );

    if (resetFilters) {
        populateErcotFilters();
    }

    updateErcotDeepDive();
}

function normalizeErcotData(data){
    if (!Array.isArray(data)) return [];

    return data.map(d => {
        const queueDate = toDate(d["Queue Date"]);
        const proposedDate = toDate(d["Proposed Date"]);
        const screeningStartedDate = toDate(d["Screening Started Date"]);
        const screeningCompleteDate = toDate(d["Screening Complete Date"]);
        const fisRequestedDate = toDate(d["FIS Requested Date"]);
        const fisApprovedDate = toDate(d["FIS Approved Date"]);
        const iaSignedDate = toDate(d["IA Signed Date"]);
        const constructionStartDate = toDate(d["Construction Start Date"]);
        const constructionEndDate = toDate(d["Construction End Date"]);
        const approvedEnergizationDate = toDate(d["Approved Energization Date"]);
        const approvedSyncDate = toDate(d["Approved Sync Date"]);
        const latestMilestoneDate = toDate(d["Latest Milestone Date"]);
        const fuel = !isMissing(d["Fuel Type"]) ? String(d["Fuel Type"]).trim() : "Unknown";
        const status = !isMissing(d["Status"]) ? String(d["Status"]).trim() : "Active";
        const latestMilestone = !isMissing(d["Latest Milestone"]) ? String(d["Latest Milestone"]).trim() : "";

        return {
            ProjectID: !isMissing(d["Project ID"]) ? String(d["Project ID"]).trim() : "Unknown",
            Name: !isMissing(d["Name"]) ? String(d["Name"]).trim() : "Unknown",
            Developer: !isMissing(d["Developer"]) ? String(d["Developer"]).trim() : "Unknown",
            POI: !isMissing(d["POI"]) ? String(d["POI"]).trim() : "",
            County: !isMissing(d["County"]) ? String(d["County"]).trim() : "",
            Zone: !isMissing(d["Zone"]) ? String(d["Zone"]).trim() : "",
            Fuel: fuel,
            MW: toNumber(d["MW Capacity"]),
            QueueDate: queueDate,
            ProposedDate: proposedDate,
            Status: status,
            CompletionProbability: toNumber(d["Completion Probability"]),
            State: !isMissing(d["State"]) ? String(d["State"]).trim() : "TX",
            ISO: !isMissing(d["ISO"]) ? String(d["ISO"]).trim() : "ERCOT",
            ScreeningStartedDate: screeningStartedDate,
            ScreeningCompleteDate: screeningCompleteDate,
            FISRequestedDate: fisRequestedDate,
            FISApprovedDate: fisApprovedDate,
            IASignedDate: iaSignedDate,
            ConstructionStartDate: constructionStartDate,
            ConstructionEndDate: constructionEndDate,
            ApprovedEnergizationDate: approvedEnergizationDate,
            ApprovedSyncDate: approvedSyncDate,
            LatestMilestone: latestMilestone,
            LatestMilestoneDate: latestMilestoneDate,
            Latitude: toNumber(d["Latitude"]),
            Longitude: toNumber(d["Longitude"]),
            year: queueDate ? queueDate.getFullYear() : null,
            proposedYear: proposedDate ? proposedDate.getFullYear() : null
        };
    }).filter(d => (d.MW || 0) > 0);
}

function getFilteredErcotData(){
    if (!Array.isArray(ercotData)) return [];
    const zones      = getMultiSelectValues("ercotZoneFilterDropdown");
    const counties   = getMultiSelectValues("ercotCountyFilterDropdown");
    const fuels      = getMultiSelectValues("ercotFuelFilterDropdown");
    const statuses   = getMultiSelectValues("ercotStatusFilterDropdown");
    const developers = getMultiSelectValues("ercotDeveloperFilterDropdown");
    const qs = Number(ercotQueueYearStart?.value);
    const qe = Number(ercotQueueYearEnd?.value);
    const ps = Number(ercotProposedYearStart?.value);
    const pe = Number(ercotProposedYearEnd?.value);
    return ercotData.filter(d => {
        if (zones.length      && !zones.includes(d.Zone))        return false;
        if (counties.length   && !counties.includes(d.County))   return false;
        if (fuels.length      && !fuels.includes(d.Fuel))        return false;
        if (statuses.length   && !statuses.includes(d.Status))   return false;
        if (developers.length && !developers.includes(d.Developer)) return false;
        if (Number.isFinite(qs) && d.year !== null && d.year < qs) return false;
        if (Number.isFinite(qe) && d.year !== null && d.year > qe) return false;
        if (Number.isFinite(ps) && d.proposedYear !== null && d.proposedYear < ps) return false;
        if (Number.isFinite(pe) && d.proposedYear !== null && d.proposedYear > pe) return false;
        return true;
    });
}

function populateErcotFilters(){
    buildMultiSelect("ercotZoneFilterDropdown",      ercotData.map(d => d.Zone),      "All Zones",      updateErcotDeepDive);
    buildMultiSelect("ercotCountyFilterDropdown",    ercotData.map(d => d.County),    "All Counties",   updateErcotDeepDive);
    buildMultiSelect("ercotFuelFilterDropdown",      ercotData.map(d => d.Fuel),      "All Fuels",      updateErcotDeepDive);
    buildMultiSelect("ercotStatusFilterDropdown",    ercotData.map(d => d.Status),    "All Statuses",   updateErcotDeepDive);
    buildMultiSelect("ercotDeveloperFilterDropdown", ercotData.map(d => d.Developer), "All Developers", updateErcotDeepDive);

    const queueYears    = [...new Set(ercotData.map(d => d.year).filter(Boolean))].sort((a,b)=>a-b);
    const proposedYears = [...new Set(ercotData.map(d => d.proposedYear).filter(Boolean))].sort((a,b)=>a-b);

    function fillYearSelect(select, years){
        if (!select) return;
        select.innerHTML = "";
        years.forEach(y => { const opt = document.createElement("option"); opt.value = y; opt.textContent = y; select.appendChild(opt); });
    }
    fillYearSelect(ercotQueueYearStart, queueYears);
    fillYearSelect(ercotQueueYearEnd, queueYears);
    fillYearSelect(ercotProposedYearStart, proposedYears);
    fillYearSelect(ercotProposedYearEnd, proposedYears);
    if (ercotQueueYearStart && ercotQueueYearEnd && queueYears.length) {
        ercotQueueYearStart.value = queueYears[0];
        ercotQueueYearEnd.value = queueYears[queueYears.length - 1];
    }
    if (ercotProposedYearStart && ercotProposedYearEnd && proposedYears.length) {
        ercotProposedYearStart.value = proposedYears[0];
        ercotProposedYearEnd.value = proposedYears[proposedYears.length - 1];
    }
}

function updateErcotDeepDive(){
    const content = document.getElementById("ercotContent");
    const blankState = document.getElementById("ercotBlankState");

    if (!ercotData.length) {
        if (blankState) {
            blankState.classList.remove("hidden");
            const message = blankState.querySelector("p");
            if (message) {
                message.innerText = (Array.isArray(masterData) && masterData.length > 0)
                    ? "No ERCOT rows were found in the loaded wide master JSON."
                    : "Load the wide master JSON to view ERCOT-specific queue analysis, milestone timing, and project-level detail.";
            }
        }
        if (content) content.classList.add("hidden");
        return;
    }

    if (blankState) blankState.classList.add("hidden");
    if (content) content.classList.remove("hidden");
    markChartsLoading("ercotContent");

    if (ercotStatus) {
        ercotStatus.innerText = `Loaded ${ercotData.length.toLocaleString()} ERCOT records from the wide master JSON.`;
    }

    const filtered = getFilteredErcotData();
    renderErcotKpis(filtered);
    renderErcotLocationCharts(filtered);
    renderErcotFuelCharts(filtered);
    renderErcotAdvancementTable(filtered);
    renderErcotProposedDateCharts(filtered);
    renderErcotProjectTable(filtered);

    // Re-render map if map view is currently active
    var mapViewEl = document.getElementById("ercotMapView");
    if (mapViewEl && !mapViewEl.classList.contains("hidden")) renderErcotMap();

    setTimeout(() => {
        ["ercotZoneChart", "ercotCountyChart", "ercotYearFuelChart", "ercotQueueVsProposedChart"].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                Plotly.Plots.resize(element);
            }
        });
    }, 80);
}

function renderErcotKpis(data){
    const totalProjects = data.length;
    const totalCapacity = data.reduce((sum, d) => sum + (d.MW || 0), 0);
    const averageProjectSize = totalProjects ? totalCapacity / totalProjects : 0;

    const zoneTotals = {};
    data.forEach(d => {
        const zone = d.Zone || "Unknown";
        zoneTotals[zone] = (zoneTotals[zone] || 0) + (d.MW || 0);
    });
    const dominantZone = Object.entries(zoneTotals).sort((a, b) => b[1] - a[1])[0] || ["—", 0];

    const probabilityValues = data.map(d => d.CompletionProbability).filter(v => v != null && Number.isFinite(v));
    const averageProbability = probabilityValues.length ? probabilityValues.reduce((sum, v) => sum + v, 0) / probabilityValues.length : 0;

    const activeProjects = data.filter(d => String(d.Status || "").toLowerCase() === "active").length;
    const percentActive = totalProjects ? (activeProjects / totalProjects) * 100 : 0;

    // Most common latest milestone in filtered set
    const milestoneCounts = {};
    const milestoneDates = {};
    data.forEach(d => {
        const m = d.LatestMilestone;
        if (!m) return;
        milestoneCounts[m] = (milestoneCounts[m] || 0) + 1;
        if (d.LatestMilestoneDate && (!milestoneDates[m] || d.LatestMilestoneDate > milestoneDates[m])) {
            milestoneDates[m] = d.LatestMilestoneDate;
        }
    });
    const topMilestone = Object.entries(milestoneCounts).sort((a, b) => b[1] - a[1])[0];

    document.getElementById("ercotKpiProjects").innerText = totalProjects.toLocaleString();
    document.getElementById("ercotKpiCapacity").innerText = formatGW(totalCapacity);
    document.getElementById("ercotKpiAverage").innerText = `${Math.round(averageProjectSize).toLocaleString()} MW`;
    document.getElementById("ercotKpiZone").innerText = dominantZone[0];
    document.getElementById("ercotKpiZoneShare").innerText = `${totalCapacity ? (dominantZone[1] / totalCapacity * 100).toFixed(1) : 0}% of visible capacity`;
    document.getElementById("ercotKpiProbability").innerText = formatPercent(averageProbability);
    document.getElementById("ercotKpiPercentActive").innerText = formatPercent(percentActive);
    const milestoneEl = document.getElementById("ercotKpiLatestMilestone");
    const milestoneDateEl = document.getElementById("ercotKpiLatestMilestoneDate");
    if (milestoneEl) milestoneEl.innerText = topMilestone ? topMilestone[0] : "—";
    if (milestoneDateEl) {
        if (topMilestone && milestoneDates[topMilestone[0]]) {
            const d = milestoneDates[topMilestone[0]];
            milestoneDateEl.innerText = `Latest: ${d.toISOString().split("T")[0]} · ${topMilestone[1].toLocaleString()} projects`;
        } else {
            milestoneDateEl.innerText = "";
        }
    }
}

function renderErcotLocationCharts(data){
    const zoneMetricView = document.getElementById("ercotZoneMetricView") ? document.getElementById("ercotZoneMetricView").value : "capacity";
    const zoneFuelTotals = {};
    const zoneProjectCounts = {};
    const countyTotals = {};

    data.forEach(d => {
        const zone = d.Zone || "Unknown";
        const county = d.County || "Unknown";
        const fuel = d.Fuel || "Unknown";
        zoneFuelTotals[zone] = zoneFuelTotals[zone] || {};
        zoneFuelTotals[zone][fuel] = (zoneFuelTotals[zone][fuel] || 0) + (d.MW || 0);
        zoneProjectCounts[zone] = (zoneProjectCounts[zone] || 0) + 1;
        countyTotals[county] = (countyTotals[county] || 0) + (d.MW || 0);
    });

    const zoneLabels = Object.keys(zoneProjectCounts).sort();

    if (zoneMetricView === "projects") {
        Plotly.newPlot("ercotZoneChart", [{
            x: zoneLabels,
            y: zoneLabels.map(z => zoneProjectCounts[z] || 0),
            type: "bar",
            marker: { color: "#5a9140" },
            hovertemplate: "Zone: %{x}<br>Projects: %{y}<extra></extra>"
        }], {
            title: "Project Count by ERCOT Zone",
            xaxis: { title: "Zone" },
            yaxis: { title: "Project Count" },
            margin: { t: 30, r: 20, b: 40, l: 60 }
        }, { displayModeBar: false, responsive: true });
    } else {
        const fuels = [...new Set(data.map(d => d.Fuel || "Unknown"))].sort();
        const zoneTraceData = fuels.map(fuel => ({
            x: zoneLabels,
            y: zoneLabels.map(zone => ((zoneFuelTotals[zone] && zoneFuelTotals[zone][fuel]) || 0) / 1000),
            name: fuel,
            type: "bar",
            marker: { color: fuelColors[fuel] || "#6b7280" },
            hovertemplate: "Zone: %{x}<br>Fuel Type: " + fuel + "<br>Capacity: %{y:.2f} GW<extra></extra>"
        }));
        Plotly.newPlot("ercotZoneChart", zoneTraceData, {
            title: "Capacity by ERCOT Zone",
            barmode: "stack",
            xaxis: { title: "Zone" },
            yaxis: { title: "Capacity (GW)" },
            margin: { t: 30, r: 20, b: 40, l: 60 }
        }, { displayModeBar: false, responsive: true });
    }

    const countyLabels = Object.entries(countyTotals).sort((a, b) => b[1] - a[1]).slice(0, 15);
    Plotly.newPlot("ercotCountyChart", [{
        x: countyLabels.map(item => item[1] / 1000),
        y: countyLabels.map(item => item[0]),
        type: "bar",
        orientation: "h",
        marker: { color: "#49B81F" },
        hovertemplate: "County: %{y}<br>Capacity: %{x:.2f} GW<extra></extra>"
    }], {
        title: "Top Counties by Capacity",
        xaxis: { title: "Capacity (GW)" },
        yaxis: { title: "County", automargin: true, autorange: "reversed" },
        margin: { t: 30, r: 20, b: 40, l: 110 }
    }, { displayModeBar: false, responsive: true });
}

function renderErcotFuelCharts(data){
    const dateView = document.getElementById("ercotFuelDateView") ? document.getElementById("ercotFuelDateView").value : "queue";
    const yearFuelTotals = {};

    data.forEach(d => {
        const year = dateView === "proposed" ? d.proposedYear : d.year;
        if (!year) return;
        const fuel = d.Fuel || "Unknown";
        yearFuelTotals[year] = yearFuelTotals[year] || {};
        yearFuelTotals[year][fuel] = (yearFuelTotals[year][fuel] || 0) + (d.MW || 0);
    });

    const years = Object.keys(yearFuelTotals).sort((a, b) => Number(a) - Number(b));
    const fuels = [...new Set(data.map(d => d.Fuel || "Unknown"))].sort();
    Plotly.newPlot("ercotYearFuelChart", fuels.map(fuel => ({
        x: years,
        y: years.map(year => ((yearFuelTotals[year] && yearFuelTotals[year][fuel]) || 0) / 1000),
        name: fuel,
        type: "bar",
        marker: { color: fuelColors[fuel] || "#6b7280" },
        hovertemplate: "Fuel Type: " + fuel + "<br>" + (dateView === "proposed" ? "Proposed Year" : "Queue Year") + ": %{x}<br>Capacity: %{y:.2f} GW<extra></extra>"
    })), {
        title: dateView === "proposed" ? "Fuel Mix by Proposed Year" : "Fuel Mix by Queue Year",
        barmode: "stack",
        xaxis: { title: dateView === "proposed" ? "Proposed Year" : "Queue Year" },
        yaxis: { title: "Capacity (GW)" },
        margin: { t: 30, r: 20, b: 40, l: 60 }
    }, { displayModeBar: false, responsive: true });
}

function renderErcotStatusCharts(data){
    // Removed from ERCOT deep dive layout.
}

function renderErcotMilestoneCharts(data){
    // Removed from ERCOT deep dive layout.
}

function renderErcotDeveloperCharts(data){
    // Developer charts removed from ERCOT deep dive per dashboard scope update.
}

function renderErcotAdvancementTable(data){
    const tbody = document.getElementById("ercotAdvancementTableBody");
    if (!tbody) return;

    const totalProjects = data.length;
    const totalCapacity = data.reduce((sum, d) => sum + (d.MW || 0), 0);

    const milestones = [
        { label: "Screening Complete", key: "ScreeningCompleteDate" },
        { label: "FIS Requested", key: "FISRequestedDate" },
        { label: "FIS Approved", key: "FISApprovedDate" },
        { label: "IA Signed", key: "IASignedDate" },
        { label: "Approved Energization", key: "ApprovedEnergizationDate" },
        { label: "Approved Sync", key: "ApprovedSyncDate" },
        { label: "Construction Start", key: "ConstructionStartDate" },
        { label: "Construction End", key: "ConstructionEndDate" }
    ];

    const rows = milestones.map(item => {
        const reached = data.filter(d => d[item.key]);
        const reachedProjects = reached.length;
        const reachedCapacity = reached.reduce((sum, d) => sum + (d.MW || 0), 0);
        const durations = reached
            .filter(d => d.QueueDate && d[item.key])
            .map(d => (d[item.key] - d.QueueDate) / (1000 * 60 * 60 * 24))
            .filter(v => Number.isFinite(v) && v >= 0);
        const probabilities = reached
            .map(d => d.CompletionProbability || 0)
            .filter(v => v > 0);

        const pctProjects = totalProjects ? (reachedProjects / totalProjects) * 100 : 0;
        const pctCapacity = totalCapacity ? (reachedCapacity / totalCapacity) * 100 : 0;
        const medianDays = durations.length ? median(durations) : null;
        const avgProbability = probabilities.length ? average(probabilities) : null;

        return `
            <tr>
                <td>${item.label}</td>
                <td>${reachedProjects.toLocaleString()}</td>
                <td>${pctProjects.toFixed(1)}%</td>
                <td>${formatGW(reachedCapacity)}</td>
                <td>${pctCapacity.toFixed(1)}%</td>
                <td>${medianDays === null ? "—" : Math.round(medianDays).toLocaleString()}</td>
                <td>${avgProbability === null ? "—" : formatPercent(avgProbability)}</td>
            </tr>
        `;
    }).join("");

    tbody.innerHTML = rows || '<tr><td colspan="7" style="text-align:center;">No ERCOT advancement data available.</td></tr>';
}

function renderErcotProposedDateCharts(data){
    const scatterRows = data.filter(d => d.QueueDate && d.ProposedDate);
    const hidden = data.length - scatterRows.length;
    const noteEl = document.getElementById("ercotScatterNote");
    if (noteEl) noteEl.innerText = hidden > 0 ? `${hidden.toLocaleString()} project${hidden === 1 ? "" : "s"} not shown — missing queue or proposed date.` : "";
    const fuels = [...new Set(scatterRows.map(d => d.Fuel || "Unknown"))].sort();
    const traceGroups = fuels.map(fuel => {
        const rows = scatterRows.filter(d => (d.Fuel || "Unknown") === fuel);
        return {
            x: rows.map(d => d.QueueDate),
            y: rows.map(d => d.ProposedDate),
            mode: "markers",
            type: "scatter",
            name: fuel,
            marker: {
                size: 9,
                color: fuelColors[fuel] || "#6b7280",
                opacity: 0.75,
                line: { width: 0.5, color: "#ffffff" }
            },
            customdata: rows.map(d => [
                d.ProjectID || "Unknown",
                d.Name || "Unknown",
                d.Developer || "Unknown",
                d.Zone || "",
                d.County || "",
                d.MW || 0,
                d.Status || "",
                d.CompletionProbability != null ? d.CompletionProbability : "—"
            ]),
            hovertemplate: "Project ID: %{customdata[0]}<br>Name: %{customdata[1]}<br>Developer: %{customdata[2]}<br>Zone: %{customdata[3]}<br>County: %{customdata[4]}<br>MW Capacity: %{customdata[5]:.0f}<br>Status: %{customdata[6]}<br>Completion Probability: %{customdata[7]}%<extra></extra>"
        };
    });

    Plotly.newPlot("ercotQueueVsProposedChart", traceGroups, {
        title: "Queue Date vs Proposed Date",
        xaxis: { title: "Queue Date" },
        yaxis: { title: "Proposed Date" },
        hovermode: "closest",
        hoverdistance: 2,
        margin: { t: 30, r: 20, b: 40, l: 60 }
    }, { displayModeBar: false, responsive: true });
}

function setErcotProjectTableSort(key, type, direction){
    ercotProjectTableSort = { key, type, direction };

    document.querySelectorAll(".ercot-header-sort").forEach(select => {
        if (select.dataset.key !== key) {
            select.value = "";
        }
    });

    updateErcotDeepDive();
}

function getErcotSortValue(row, key, type){
    const value = row[key];
    if (type === "number") {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : null;
    }
    if (type === "date") {
        return value instanceof Date && !isNaN(value) ? value.getTime() : null;
    }
    if (value === null || value === undefined) return "";
    return String(value).trim().toLowerCase();
}

function sortErcotProjectRows(data){
    if (!ercotProjectTableSort || !ercotProjectTableSort.key || !ercotProjectTableSort.direction) {
        return [...data];
    }

    const { key, type, direction } = ercotProjectTableSort;
    const multiplier = direction === "desc" ? -1 : 1;

    return [...data].sort((a, b) => {
        const aValue = getErcotSortValue(a, key, type);
        const bValue = getErcotSortValue(b, key, type);

        const aMissing = aValue === null || aValue === "";
        const bMissing = bValue === null || bValue === "";
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;

        if (type === "number" || type === "date") {
            return (aValue - bValue) * multiplier;
        }

        return String(aValue).localeCompare(String(bValue)) * multiplier;
    });
}

function syncErcotHeaderSortControls(){
    document.querySelectorAll(".ercot-header-sort").forEach(select => {
        if (ercotProjectTableSort && select.dataset.key === ercotProjectTableSort.key) {
            select.value = ercotProjectTableSort.direction || "";
        } else {
            select.value = "";
        }
    });
}

function renderErcotProjectTable(data){
    const tbody = document.getElementById("ercotProjectTableBody");
    if (!tbody) return;

    syncErcotHeaderSortControls();

    const searchTerm = ercotTableSearch
        ? ercotTableSearch.value.trim().toLowerCase()
        : "";

    const tableFilteredData = searchTerm
        ? data.filter(d => {
            const projectId = String(d.ProjectID || "").toLowerCase();
            const name = String(d.Name || "").toLowerCase();
            const developer = String(d.Developer || "").toLowerCase();

            return (
                projectId.includes(searchTerm) ||
                name.includes(searchTerm) ||
                developer.includes(searchTerm)
            );
        })
        : data;

    const sortedData = sortErcotProjectRows(tableFilteredData);

    const rows = sortedData.map(d => `
        <tr>
            <td>${(d.ProjectID || "Unknown").replace(/</g, "&lt;")}</td>
            <td>${(d.Name || "Unknown").replace(/</g, "&lt;")}</td>
            <td>${(d.Developer || "Unknown").replace(/</g, "&lt;")}</td>
            <td>${(d.POI || "").replace(/</g, "&lt;")}</td>
            <td>${(d.County || "").replace(/</g, "&lt;")}</td>
            <td>${(d.Zone || "").replace(/</g, "&lt;")}</td>
            <td>${d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : ""}</td>
            <td>${(d.Fuel || "Unknown").replace(/</g, "&lt;")}</td>
            <td>${(d.MW || 0).toFixed(0)}</td>
            <td>${d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : ""}</td>
            <td>${(d.Status || "").replace(/</g, "&lt;")}</td>
            <td>${(d.CompletionProbability || 0).toFixed(0)}%</td>
            <td>${(d.LatestMilestone || "").replace(/</g, "&lt;")}</td>
            <td>${d.LatestMilestoneDate ? d.LatestMilestoneDate.toISOString().split("T")[0] : ""}</td>
        </tr>
    `).join("");

    tbody.innerHTML = rows || '<tr><td colspan="14" style="text-align:center;">No matching ERCOT projects.</td></tr>';
}

function renderErcotInsights(data){
    // Removed from ERCOT deep dive layout.
}

// ---------------- DEV INSIGHTS MAP ----------------

var _devLeafletMap = null;
var _devMarkerLayer = null;
var _devZoneLayer = null;
var _devCountyLayer = null;

// ---- County choropleth caches ----
var _countyTopoCache = null;
var _countyFipsLookupCache = null;
var _cityFipsLookupCache = null;
var _countyFipsRevCache = null;

var _COUNTY_CHOROPLETH_STATE_FIPS = new Set([
    "05","19","17","18","21","22","26","27","29","28","30","38","46","48","55", // MISO
    "09","25","23","33","36","44","50",  // ISO-NE
    "08","20","31","35","40","56",  // SPP-unique (CO, KS, NE, NM, OK, WY)
    "10","11","24","34","37","39","42","47","51","54"  // PJM-unique (DE, DC, MD, NJ, NC, OH, PA, TN, VA, WV)
]);

var _COUNTY_COLOR_STEPS = [
    [1,  "#dbeafe"],
    [3,  "#93c5fd"],
    [6,  "#3b82f6"],
    [11, "#1d4ed8"],
    [21, "#1e3a8a"]
];

var _STATE_NAME_TO_ABBR = { "michigan": "MI", "minnesota": "MN", "illinois": "IL",
    "indiana": "IN", "iowa": "IA", "wisconsin": "WI", "missouri": "MO",
    "arkansas": "AR", "louisiana": "LA", "mississippi": "MS", "kentucky": "KY",
    "north dakota": "ND", "south dakota": "SD", "montana": "MT", "texas": "TX",
    "connecticut": "CT", "massachusetts": "MA", "maine": "ME", "new hampshire": "NH",
    "new york": "NY", "rhode island": "RI", "vermont": "VT",
    "colorado": "CO", "kansas": "KS", "nebraska": "NE", "new mexico": "NM",
    "oklahoma": "OK", "wyoming": "WY" };

function _loadCountyTopo() {
    if (_countyTopoCache) return Promise.resolve(_countyTopoCache);
    return fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
        .then(function(r) { return r.json(); })
        .then(function(t) { _countyTopoCache = t; return t; });
}

function _loadCountyFipsLookup() {
    if (_countyFipsLookupCache) return Promise.resolve(_countyFipsLookupCache);
    return fetch("/static/data/county_fips_lookup.json")
        .then(function(r) { return r.json(); })
        .then(function(d) { _countyFipsLookupCache = d; return d; });
}

function _loadCityFipsLookup() {
    if (_cityFipsLookupCache) return Promise.resolve(_cityFipsLookupCache);
    return fetch("/static/data/city_fips_lookup.json")
        .then(function(r) { return r.json(); })
        .then(function(d) { _cityFipsLookupCache = d; return d; });
}

function _buildFipsReverse(lookup) {
    if (_countyFipsRevCache) return _countyFipsRevCache;
    var rev = {};
    Object.keys(lookup).forEach(function(state) {
        Object.keys(lookup[state]).forEach(function(name) {
            var fips = lookup[state][name];
            if (!rev[fips] || name.length < rev[fips].name.length) {
                var title = name.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
                rev[fips] = { name: title, state: state };
            }
        });
    });
    _countyFipsRevCache = rev;
    return rev;
}

function _normalizeCountyName(name) {
    if (!name) return "";
    name = String(name).split(/[,\/]/)[0];
    name = name.replace(/\s+(county|parish|borough|census area)\s*$/i, "").trim();
    name = name.replace(/\bsaint\s+/i, "st. ");
    return name.toLowerCase();
}

function _countyFipsFromRecord(r, countyLookup, cityLookup) {
    var state = (r.State || "").trim();
    state = _STATE_NAME_TO_ABBR[state.toLowerCase()] || state.toUpperCase();
    var key = _normalizeCountyName(r.County || "");
    if (!state || !key) return null;
    // Try county name first
    var fips = (countyLookup[state] || {})[key];
    if (fips) return fips;
    // Fall back to city/town name lookup
    return (cityLookup && cityLookup[state] && cityLookup[state][key]) || null;
}

function _buildCountyIndex(records, countyLookup, cityLookup) {
    var idx = {};
    records.forEach(function(r) {
        var fips = _countyFipsFromRecord(r, countyLookup, cityLookup);
        if (!fips) return;
        if (!idx[fips]) idx[fips] = { count: 0, mw: 0, projects: [] };
        idx[fips].count++;
        idx[fips].mw += (r.MW || 0);
        idx[fips].projects.push(r);
    });
    return idx;
}

function _countyFillColor(count) {
    var color = null;
    for (var i = 0; i < _COUNTY_COLOR_STEPS.length; i++) {
        if (count >= _COUNTY_COLOR_STEPS[i][0]) color = _COUNTY_COLOR_STEPS[i][1];
    }
    return color;
}

function closeCountyDetail() {
    var panel = document.getElementById("devCountyDetail");
    if (panel) panel.classList.add("hidden");
}

function showCountyDetail(fips, rev, idx) {
    var panel = document.getElementById("devCountyDetail");
    if (!panel) return;
    var info = idx[fips];
    if (!info) return;
    var meta = rev[fips] || { name: fips, state: "" };
    var nameEl = document.getElementById("cdpCountyName");
    var statsEl = document.getElementById("cdpStats");
    var listEl  = document.getElementById("cdpProjectList");
    if (nameEl) nameEl.textContent = meta.name + " County, " + meta.state;
    if (statsEl) statsEl.textContent = info.count + " project" + (info.count !== 1 ? "s" : "") + " · " + info.mw.toFixed(0) + " MW total";
    if (listEl) {
        listEl.innerHTML = info.projects.map(function(p) {
            var fc = ERCOT_FUEL_COLORS[p.Fuel] || ERCOT_FUEL_COLORS.Other;
            var pd = p.ProposedDate ? p.ProposedDate.toISOString().split("T")[0] : "—";
            var statusCls = "cdp-status-" + (p.Status || "").toLowerCase();
            return "<div class='cdp-project'>" +
                "<div class='cdp-proj-name'>" + (p.ProjectID || "—") + "</div>" +
                "<div class='cdp-proj-row'>" +
                    "<span class='cdp-proj-fuel' style='background:" + fc + "22;color:" + fc + ";'>" + (p.Fuel || "Other") + "</span>" +
                    "<span class='cdp-proj-mw'>" + (p.MW || 0).toFixed(0) + " MW</span>" +
                    "<span class='cdp-proj-status " + statusCls + "'>" + (p.Status || "—") + "</span>" +
                "</div>" +
                "<div class='cdp-proj-meta'>" +
                    (p.Developer && p.Developer.toLowerCase() !== "unknown" ? p.Developer + " · " : "") + "COD " + pd +
                "</div>" +
            "</div>";
        }).join("");
    }
    panel.classList.remove("hidden");
}

function _updateCountyChoroplethLegend() {
    var el = document.getElementById("devCountyLegend");
    if (!el) return;
    el.classList.remove("hidden");
    var labels = ["1–2", "3–5", "6–10", "11–20", "21+"];
    el.innerHTML = "<span class='county-legend-label'>Projects per county:</span>" +
        _COUNTY_COLOR_STEPS.map(function(step, i) {
            return "<span class='county-legend-item'>" +
                "<span class='county-legend-swatch' style='background:" + step[1] + "'></span>" +
                labels[i] + "</span>";
        }).join("");
}

function _renderCountyChoropleth(leafletMap, records) {
    if (!records.length) return;
    if (typeof topojson === "undefined") {
        console.warn("topojson-client not loaded; county choropleth unavailable");
        return;
    }
    if (_devCountyLayer) {
        leafletMap.removeLayer(_devCountyLayer);
        _devCountyLayer = null;
    }
    Promise.all([_loadCountyTopo(), _loadCountyFipsLookup(), _loadCityFipsLookup()])
        .then(function(results) {
            var topo        = results[0];
            var countyLookup = results[1];
            var cityLookup   = results[2];
            var rev = _buildFipsReverse(countyLookup);
            var idx = _buildCountyIndex(records, countyLookup, cityLookup);
            if (!Object.keys(idx).length) return;

            var allFeatures = topojson.feature(topo, topo.objects.counties).features;
            var features = allFeatures.filter(function(f) {
                var stateFips = String(f.id).padStart(5, "0").slice(0, 2);
                return _COUNTY_CHOROPLETH_STATE_FIPS.has(stateFips);
            });

            _devCountyLayer = L.geoJSON(
                { type: "FeatureCollection", features: features },
                {
                    style: function(feature) {
                        var fips = String(feature.id).padStart(5, "0");
                        var d    = idx[fips];
                        var fill = d ? _countyFillColor(d.count) : null;
                        return {
                            fillColor:   fill || "transparent",
                            fillOpacity: fill ? 0.70 : 0,
                            color:       fill ? "#475569" : "#cbd5e1",
                            weight:      fill ? 0.8 : 0.3,
                            opacity:     0.6
                        };
                    },
                    onEachFeature: function(feature, layer) {
                        var fips = String(feature.id).padStart(5, "0");
                        var d    = idx[fips];
                        if (!d) return;
                        var meta = rev[fips] || { name: fips, state: "" };
                        layer.on("mouseover", function(e) {
                            layer.setStyle({ fillOpacity: 0.92, weight: 1.8 });
                            layer.bindTooltip(
                                "<b>" + meta.name + " County, " + meta.state + "</b><br>" +
                                d.count + " project" + (d.count !== 1 ? "s" : "") + "<br>" +
                                d.mw.toFixed(0) + " MW total",
                                { sticky: true, className: "county-hover-tooltip", direction: "top" }
                            ).openTooltip(e.latlng);
                        });
                        layer.on("mouseout", function() {
                            _devCountyLayer.resetStyle(layer);
                            layer.closeTooltip();
                        });
                        layer.on("click", function() {
                            showCountyDetail(fips, rev, idx);
                        });
                    }
                }
            );
            _devCountyLayer.addTo(leafletMap);
            _updateCountyChoroplethLegend();
        })
        .catch(function(e) { console.warn("County choropleth render failed:", e); });
}

function setDevView(view) {
    var chartsBtn  = document.getElementById("devViewCharts");
    var mapBtn     = document.getElementById("devViewMap");
    var mapEl      = document.getElementById("devMapView");
    var chartsEl   = document.getElementById("devChartsView");

    if (view === "map") {
        if (chartsBtn) chartsBtn.classList.remove("active");
        if (mapBtn)    mapBtn.classList.add("active");
        if (mapEl)     mapEl.classList.remove("hidden");
        if (chartsEl)  chartsEl.classList.add("hidden");
        setTimeout(function() { renderDevMap(); }, 80);
    } else {
        if (chartsBtn) chartsBtn.classList.add("active");
        if (mapBtn)    mapBtn.classList.remove("active");
        if (mapEl)     mapEl.classList.add("hidden");
        if (chartsEl)  chartsEl.classList.remove("hidden");
    }
}

function getMapData() {
    var data = Array.isArray(masterData) ? masterData : [];

    // Market scope (ISO or State)
    var mode = getFilterType();
    var selected = getSelectedMarketValue();
    if (selected !== "All") {
        data = data.filter(function(d) {
            return mode === "ISO"
                ? (d.ISO || "Unknown") === selected
                : (d.State || "Unknown") === selected;
        });
    }

    // Fuel type
    data = getFuelFilteredData(data);

    // Year range — only filters records that have a year
    var years = getSelectedYears();
    data = data.filter(function(d) {
        if (!d.year) return true;
        return d.year >= years.start && d.year <= years.end;
    });

    return data;
}

function renderDevMap() {
    var container = document.getElementById("devMap");
    if (!container) return;

    if (typeof L === "undefined") {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:0.85rem;">Leaflet failed to load. Check your internet connection and refresh.</div>';
        return;
    }

    var activeOnly = document.getElementById("devMapActiveOnly");

    var allData = getMapData();
    if (activeOnly && activeOnly.checked) {
        allData = allData.filter(function(d) {
            var s = String(d.Status || "").toLowerCase();
            return s !== "done" && !s.includes("withdraw");
        });
    }

    // All ISOs use county choropleth
    var countyRecords = allData.filter(function(d) {
        return d.County && d.State;
    });

    // ---- Disclaimer ----
    var disclaimerEl = document.getElementById("devMapDisclaimer");
    if (disclaimerEl) {
        var hidden = allData.length - countyRecords.length;
        if (hidden > 0) {
            disclaimerEl.textContent = hidden.toLocaleString() + " project" + (hidden === 1 ? "" : "s") + " not shown — location data (county/state) incomplete in source data.";
            disclaimerEl.classList.remove("hidden");
        } else {
            disclaimerEl.classList.add("hidden");
        }
    }

    // ---- Map init ----
    if (_devLeafletMap) {
        var c = document.getElementById("devMap");
        if (c && (c.offsetWidth === 0 || c.offsetHeight === 0)) {
            _devLeafletMap.remove();
            _devLeafletMap = null;
            _devCountyLayer = null;
        }
    }
    if (!_devLeafletMap) {
        _devLeafletMap = L.map("devMap", {
            center: [40, -93],
            zoom: 4,
            zoomControl: true,
            scrollWheelZoom: true
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18
        }).addTo(_devLeafletMap);
    }

    // ---- County choropleth (all ISOs, async) ----
    if (_devCountyLayer) {
        _devLeafletMap.removeLayer(_devCountyLayer);
        _devCountyLayer = null;
    }
    var countyLegEl = document.getElementById("devCountyLegend");
    if (countyLegEl) countyLegEl.classList.add("hidden");
    closeCountyDetail();
    _renderCountyChoropleth(_devLeafletMap, countyRecords);

    var legendEl = document.getElementById("devMapLegend");
    if (legendEl) legendEl.innerHTML = "";

    setTimeout(function() {
        if (!_devLeafletMap) return;
        _devLeafletMap.invalidateSize();
    }, 150);
}

// ---------------- ERCOT MAP ----------------

var _ercotLeafletMap = null;
var _ercotMarkerLayer = null;
var _ercotZoneLayer = null;

var ERCOT_ZONE_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": { "zone": "WEST" },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-106.65, 31.80], [-104.00, 29.50], [-102.00, 29.75],
                    [-100.00, 28.20], [-100.00, 31.00], [-101.00, 33.50],
                    [-103.00, 33.50], [-104.50, 32.00], [-106.65, 31.80]
                ]]
            }
        },
        {
            "type": "Feature",
            "properties": { "zone": "SOUTH" },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-100.00, 28.20], [-97.50, 25.85], [-97.00, 26.30],
                    [-96.50, 27.50], [-97.00, 28.50], [-98.50, 29.80],
                    [-100.00, 31.00], [-100.00, 28.20]
                ]]
            }
        },
        {
            "type": "Feature",
            "properties": { "zone": "HOUSTON" },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-97.00, 28.50], [-96.50, 27.50], [-94.50, 29.00],
                    [-93.80, 30.00], [-95.00, 30.50], [-96.00, 30.50],
                    [-97.00, 29.50], [-97.00, 28.50]
                ]]
            }
        },
        {
            "type": "Feature",
            "properties": { "zone": "NORTH" },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-101.00, 33.50], [-100.00, 31.00], [-98.50, 29.80],
                    [-97.00, 29.50], [-96.00, 30.50], [-95.00, 30.50],
                    [-94.00, 31.00], [-94.00, 33.80], [-97.00, 34.00],
                    [-100.00, 34.00], [-101.00, 33.50]
                ]]
            }
        },
        {
            "type": "Feature",
            "properties": { "zone": "PANHANDLE" },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-103.05, 36.55], [-100.00, 36.55], [-100.00, 33.40],
                    [-103.05, 33.40], [-103.05, 36.55]
                ]]
            }
        },
        {
            "type": "Feature",
            "properties": { "zone": "COASTAL" },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-97.75, 29.30], [-97.10, 28.55], [-96.55, 27.45],
                    [-95.80, 25.90], [-95.00, 25.90], [-94.40, 27.00],
                    [-94.70, 28.60], [-95.60, 29.35], [-97.75, 29.30]
                ]]
            }
        }
    ]
};

var ERCOT_ZONE_COLORS = {
    WEST:      { fill: "#a78bfa", stroke: "#7c3aed" },
    SOUTH:     { fill: "#fb923c", stroke: "#ea580c" },
    HOUSTON:   { fill: "#38bdf8", stroke: "#0284c7" },
    NORTH:     { fill: "#4ade80", stroke: "#16a34a" },
    PANHANDLE: { fill: "#fbbf24", stroke: "#d97706" },
    COASTAL:   { fill: "#f472b6", stroke: "#db2777" }
};

var ERCOT_FUEL_COLORS = {
    Solar:   "#f59e0b",
    Wind:    "#3b82f6",
    Storage: "#10b981",
    Thermal: "#ef4444",
    Hybrid:  "#8b5cf6",
    Nuclear: "#ec4899",
    Hydro:   "#06b6d4",
    Other:   "#94a3b8"
};

function setErcotView(view) {
    var chartsBtn = document.getElementById("ercotViewCharts");
    var mapBtn    = document.getElementById("ercotViewMap");
    var chartsEl  = document.getElementById("ercotMapView");

    // All chart content siblings (everything in ercotContent except map view + header card)
    var ercotContent = document.getElementById("ercotContent");

    if (view === "map") {
        if (chartsBtn) chartsBtn.classList.remove("active");
        if (mapBtn)    mapBtn.classList.add("active");
        if (chartsEl)  chartsEl.classList.remove("hidden");
        // Hide chart sections — but NOT anything inside the map view itself
        if (ercotContent) {
            ercotContent.querySelectorAll(".summary-grid, .chart-grid, .chart-card, .dt-wrap").forEach(function(el) {
                if (chartsEl && chartsEl.contains(el)) return;
                el.dataset.hiddenByMap = "1";
                el.classList.add("hidden");
            });
        }
        // Delay so browser paints the container before Leaflet measures its size
        setTimeout(function() { renderErcotMap(); }, 80);
    } else {
        if (chartsBtn) chartsBtn.classList.add("active");
        if (mapBtn)    mapBtn.classList.remove("active");
        if (chartsEl)  chartsEl.classList.add("hidden");
        if (ercotContent) {
            ercotContent.querySelectorAll("[data-hidden-by-map='1']").forEach(function(el) {
                el.dataset.hiddenByMap = "";
                el.classList.remove("hidden");
            });
        }
    }
}

function _ercotMwToRadius() {
    return 4;
}

function renderErcotMap() {
    var container = document.getElementById("ercotMap");
    if (!container) return;

    if (typeof L === "undefined") {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:0.85rem;">Leaflet failed to load. Check your internet connection and refresh.</div>';
        return;
    }

    var activeOnly = document.getElementById("ercotMapActiveOnly");
    var showZones  = document.getElementById("ercotMapShowZones");

    var data = getFilteredErcotData().filter(function(d) {
        return d.Latitude && d.Longitude && isFinite(d.Latitude) && isFinite(d.Longitude);
    });

    if (activeOnly && activeOnly.checked) {
        data = data.filter(function(d) {
            var s = String(d.Status || "").toLowerCase();
            return s !== "done" && !s.includes("withdraw");
        });
    }

    // Init map — destroy stale instance if container was remeasured incorrectly
    if (_ercotLeafletMap) {
        var c = document.getElementById("ercotMap");
        if (c && (c.offsetWidth === 0 || c.offsetHeight === 0)) {
            _ercotLeafletMap.remove();
            _ercotLeafletMap = null;
            _ercotMarkerLayer = null;
            _ercotZoneLayer = null;
        }
    }
    if (!_ercotLeafletMap) {
        _ercotLeafletMap = L.map("ercotMap", {
            center: [31.5, -99.5],
            zoom: 6,
            zoomControl: true,
            scrollWheelZoom: true
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18
        }).addTo(_ercotLeafletMap);
    }

    // Zone overlays
    if (_ercotZoneLayer) {
        _ercotLeafletMap.removeLayer(_ercotZoneLayer);
        _ercotZoneLayer = null;
    }
    if (!showZones || showZones.checked) {
        _ercotZoneLayer = L.geoJSON(ERCOT_ZONE_GEOJSON, {
            style: function(feature) {
                var z = feature.properties.zone;
                var c = ERCOT_ZONE_COLORS[z] || { fill: "#94a3b8", stroke: "#64748b" };
                return { color: c.stroke, weight: 1.5, fillColor: c.fill, fillOpacity: 0.10, dashArray: "4 3" };
            },
            onEachFeature: function(feature, layer) {
                layer.bindTooltip(feature.properties.zone + " Zone", { sticky: true, className: "ercot-zone-tooltip" });
            }
        }).addTo(_ercotLeafletMap);
    }

    // Markers
    if (_ercotMarkerLayer) {
        _ercotLeafletMap.removeLayer(_ercotMarkerLayer);
    }
    _ercotMarkerLayer = L.layerGroup();

    data.forEach(function(d) {
        var color  = ERCOT_FUEL_COLORS[d.Fuel] || ERCOT_FUEL_COLORS.Other;
        var radius = _ercotMwToRadius(d.MW);
        var marker = L.circleMarker([d.Latitude, d.Longitude], {
            radius: radius,
            fillColor: color,
            color: "#fff",
            weight: 1,
            fillOpacity: 0.82
        });
        var qd = d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : "—";
        var pd = d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : "—";
        marker.bindPopup(
            "<div class='ercot-map-popup'>" +
            "<div class='emp-name'>" + (d.Name || d.ProjectID) + "</div>" +
            "<div class='emp-row'><span class='emp-label'>Developer</span><span>" + (d.Developer || "—") + "</span></div>" +
            "<div class='emp-row'><span class='emp-label'>Fuel</span><span class='emp-fuel' style='background:" + color + "22;color:" + color + ";'>" + (d.Fuel || "—") + "</span></div>" +
            "<div class='emp-row'><span class='emp-label'>MW</span><span>" + (d.MW || 0).toFixed(0) + " MW</span></div>" +
            "<div class='emp-row'><span class='emp-label'>Zone</span><span>" + (d.Zone || "—") + "</span></div>" +
            "<div class='emp-row'><span class='emp-label'>County</span><span>" + (d.County || "—") + "</span></div>" +
            "<div class='emp-row'><span class='emp-label'>Status</span><span>" + (d.Status || "—") + "</span></div>" +
            "<div class='emp-row'><span class='emp-label'>Queue Date</span><span>" + qd + "</span></div>" +
            "<div class='emp-row'><span class='emp-label'>Proposed COD</span><span>" + pd + "</span></div>" +
            "<div class='emp-row'><span class='emp-label'>Completion %</span><span>" + (d.CompletionProbability || 0).toFixed(0) + "%</span></div>" +
            "</div>",
            { maxWidth: 280 }
        );
        _ercotMarkerLayer.addLayer(marker);
    });

    _ercotMarkerLayer.addTo(_ercotLeafletMap);

    // Legend
    var legendEl = document.getElementById("ercotMapLegend");
    if (legendEl) {
        var fuelsPresent = Object.keys(ERCOT_FUEL_COLORS).filter(function(f) {
            return data.some(function(d) { return d.Fuel === f; });
        });
        legendEl.innerHTML = fuelsPresent.map(function(f) {
            return "<span class='emp-legend-item'><span class='emp-legend-dot' style='background:" + ERCOT_FUEL_COLORS[f] + "'></span>" + f + "</span>";
        }).join("");
    }

    // Recalc size — if map was init'd with bad dimensions, also re-center
    setTimeout(function() {
        if (!_ercotLeafletMap) return;
        _ercotLeafletMap.invalidateSize();
        _ercotLeafletMap.setView([31.5, -99.5], 6);
    }, 150);
}

// ---------------- RENDER ----------------

function render(){
    const mode = getFilterType();
    const selectedMarket = getSelectedMarketValue();
    const scopedData = getMarketScopedData();
    const filtered = getFuelFilteredData(scopedData);

    renderSummary(filtered, mode, selectedMarket, scopedData);
    queueBubble(filtered, scopedData);
    fuelMix(filtered, scopedData);
    renderComparisonChart(filtered, scopedData);

    var devMapEl = document.getElementById("devMapView");
    if (devMapEl && !devMapEl.classList.contains("hidden")) renderDevMap();
}

// ---------------- SUMMARY ----------------

function renderSummary(data, mode, selectedMarket, scopedData){
    const totalProjects = data.length;
    const totalCapacity = data.reduce((sum, d) => sum + (d.MW || 0), 0);
    const averageProjectSize = totalProjects ? totalCapacity / totalProjects : 0;

    const fuelTotals = {};
    data.forEach(d => {
        const fuel = d.Fuel || "Unknown";
        fuelTotals[fuel] = (fuelTotals[fuel] || 0) + (d.MW || 0);
    });

    let topFuel = "—";
    let topFuelMW = 0;
    if (Object.keys(fuelTotals).length > 0) {
        [topFuel, topFuelMW] = Object.entries(fuelTotals).sort((a,b) => b[1] - a[1])[0];
    }
    const topFuelPct = totalCapacity ? (topFuelMW / totalCapacity) * 100 : 0;

    const isoTotals = {};
    data.forEach(d => {
        const iso = d.ISO || "Unknown";
        isoTotals[iso] = (isoTotals[iso] || 0) + (d.MW || 0);
    });

    let topIso = "—";
    let topIsoMW = 0;
    if (Object.keys(isoTotals).length > 0) {
        [topIso, topIsoMW] = Object.entries(isoTotals).sort((a,b) => b[1] - a[1])[0];
    }
    const topIsoPct = totalCapacity ? (topIsoMW / totalCapacity) * 100 : 0;

    document.getElementById("summaryProjects").innerText = totalProjects.toLocaleString();
    document.getElementById("summaryCapacity").innerText = formatGW(totalCapacity);
    document.getElementById("summaryAverageSize").innerText = `${Math.round(averageProjectSize).toLocaleString()} MW`;
    document.getElementById("summaryFuel").innerText = topFuel;
    document.getElementById("summaryFuelShare").innerText = `${topFuelPct.toFixed(1)}% of visible queued MW`;
    document.getElementById("summaryTopISO").innerText = topIso;
    document.getElementById("summaryTopISOShare").innerText = `${topIsoPct.toFixed(1)}% of visible queued MW`;

    if (mode === "ISO") {
        document.getElementById("summaryISO").innerText = selectedMarket === "All" ? "All ISOs" : selectedMarket;
    } else {
        document.getElementById("summaryISO").innerText = selectedMarket === "All" ? "All States" : selectedMarket;
    }

    const years = [...new Set(data.map(d => d.year).filter(Boolean))].sort((a,b)=>a-b);
    const yearRange = years.length ? `${years[0]} to ${years[years.length - 1]}` : "No valid years";

    let leadLabel = "—";
    if (mode === "ISO") {
        const inScopeTotals = {};
        scopedData.forEach(d => {
            const iso = d.ISO || "Unknown";
            inScopeTotals[iso] = (inScopeTotals[iso] || 0) + (d.MW || 0);
        });
        if (Object.keys(inScopeTotals).length > 0) {
            leadLabel = Object.entries(inScopeTotals).sort((a,b) => b[1] - a[1])[0][0];
        }
    } else {
        const inScopeTotals = {};
        scopedData.forEach(d => {
            const state = d.State || "Unknown";
            inScopeTotals[state] = (inScopeTotals[state] || 0) + (d.MW || 0);
        });
        if (Object.keys(inScopeTotals).length > 0) {
            leadLabel = Object.entries(inScopeTotals).sort((a,b) => b[1] - a[1])[0][0];
        }
    }

    document.getElementById("developerReadout1").innerText =
        `Visible queue activity includes ${totalProjects.toLocaleString()} projects and ${formatMW(totalCapacity)} across ${yearRange}.`;

    if (mode === "ISO") {
        document.getElementById("developerReadout2").innerText =
            `The current ISO-scoped view is led by ${leadLabel}, while ${topFuel} accounts for ${topFuelPct.toFixed(1)}% of visible queued MW. The average visible project size is ${Math.round(averageProjectSize).toLocaleString()} MW.`;
    } else {
        document.getElementById("developerReadout2").innerText =
            `The current state-scoped view is led by ${leadLabel}, while ${topFuel} accounts for ${topFuelPct.toFixed(1)}% of visible queued MW. The average visible project size is ${Math.round(averageProjectSize).toLocaleString()} MW.`;
    }
}

// ---------------- CHART 1: QUEUE ENTRIES ----------------

function queueBubble(data, rangeData){
    const fuels = [...new Set(data.map(d => d.Fuel || "Unknown"))].sort();
    const dateDomain = getDateDomain(rangeData);
    const maxMW = rangeData.length ? Math.max(...rangeData.map(d => d.MW || 0)) : 0;

    const traces = fuels.map(fuel => {
        const f = data.filter(d => (d.Fuel || "Unknown") === fuel);

        return {
            x: f.map(d => d.QueueDate),
            y: f.map(d => d.MW || 0),
            mode: "markers",
            type: "scatter",
            name: fuel,
            customdata: f.map(d => [
                d.ProjectID || "Unknown",
                d.ISO || "Unknown",
                d.State || "Unknown",
                d.Fuel || "Unknown",
                d.MW || 0,
                d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : "Unknown"
            ]),
            hovertemplate:
                "Project ID: %{customdata[0]}<br>" +
                "ISO: %{customdata[1]}<br>" +
                "State: %{customdata[2]}<br>" +
                "Fuel Type: %{customdata[3]}<br>" +
                "Project Capacity: %{customdata[4]:,.0f} MW<br>" +
                "Queue Entry Date: %{customdata[5]}<extra></extra>",
            marker: {
                size: f.map(d => (8 + Math.log((d.MW || 1) + 1) * 15) * 0.7),
                color: fuelColors[fuel] || "gray",
                sizemode: "area",
                opacity: 0.7,
                line: { width: 0.5, color: "#ffffff" }
            }
        };
    });

    Plotly.newPlot("fuel", traces, {
        title: "When are projects entering the queue, and how large are they?",
        xaxis: {
            title: "Queue Entry Date",
            range: dateDomain || undefined
        },
        yaxis: {
            title: "Project Capacity (MW)",
            range: [0, maxMW ? maxMW * 1.05 : 1]
        },
        hovermode: "closest",
        hoverdistance: 2,
        margin: { t: 50, r: 20, b: 60, l: 70 }
    }, { displayModeBar: false, responsive: true });
}

// ---------------- CHART 2: FUEL MIX ----------------

function fuelMix(data, rangeData){
    const view = fuelMixView.value;
    const subtitle = document.getElementById("fuelMixSubtitle");

    if (view === "pie") {
        subtitle.innerText = "This share view shows how concentrated the selected market is by fuel type after all active filters are applied.";
        fuelMixPie(data);
    } else {
        subtitle.innerText = "This annual view shows which technologies dominate visible queue activity and how that technology mix changes over time.";
        fuelMixStacked(data, rangeData);
    }
}

function fuelMixStacked(data, rangeData){
    const fuels = [...new Set(rangeData.map(d => d.Fuel || "Unknown"))].sort();
    const years = getYearDomain(rangeData);

    const filteredMap = {};
    const rangeMap = {};
    fuels.forEach(f => {
        filteredMap[f] = {};
        rangeMap[f] = {};
    });

    data.forEach(d => {
        const fuel = d.Fuel || "Unknown";
        filteredMap[fuel][d.year] = (filteredMap[fuel][d.year] || 0) + (d.MW || 0);
    });

    rangeData.forEach(d => {
        const fuel = d.Fuel || "Unknown";
        rangeMap[fuel][d.year] = (rangeMap[fuel][d.year] || 0) + (d.MW || 0);
    });

    const traces = fuels.map(f => ({
        x: years,
        y: years.map(y => filteredMap[f][y] || 0),
        name: f,
        type: "bar",
        marker: { color: fuelColors[f] || "#6b7280" },
        hovertemplate:
            "Fuel Type: " + f + "<br>" +
            "Queue Year: %{x}<br>" +
            "Queued Capacity: %{y:.0f} MW<extra></extra>"
    }));

    const maxStack = years.reduce((max, y) => {
        const total = fuels.reduce((sum, f) => sum + (rangeMap[f][y] || 0), 0);
        return Math.max(max, total);
    }, 0);

    Plotly.newPlot("isoChart", traces, {
        title: "What technologies dominate the selected market over time?",
        barmode: "stack",
        xaxis: {
            title: "Queue Year",
            range: years.length ? [years[0] - 0.5, years[years.length - 1] + 0.5] : undefined
        },
        yaxis: {
            title: "Queued Capacity (MW)",
            range: [0, maxStack ? maxStack * 1.05 : 1]
        },
        margin: { t: 50, r: 20, b: 60, l: 70 }
    }, { displayModeBar: false, responsive: true });
}

function fuelMixPie(data){
    const totals = {};
    data.forEach(d => {
        const fuel = d.Fuel || "Unknown";
        totals[fuel] = (totals[fuel] || 0) + (d.MW || 0);
    });

    const labels = Object.keys(totals).sort();
    const values = labels.map(l => totals[l]);

    Plotly.newPlot("isoChart", [{
        labels: labels,
        values: values,
        type: "pie",
        marker: { colors: labels.map(l => fuelColors[l] || "#6b7280") },
        textinfo: "label+percent",
        hovertemplate:
            "Fuel Type: %{label}<br>" +
            "Visible Capacity: %{value:.0f} MW<br>" +
            "Share of Visible MW: %{percent}<extra></extra>"
    }], {
        title: "What share of the selected market belongs to each fuel type?",
        margin: { t: 50, r: 20, b: 20, l: 20 }
    }, { displayModeBar: false, responsive: true });
}

// ---------------- CHART 3: COMPARISON SLOT ----------------

function renderComparisonChart(data, scopedData){
    const view = metricView.value;
    const title = document.getElementById("comparisonTitle");
    const subtitle = document.getElementById("comparisonSubtitle");

    const comparisonRangeData = getComparisonRangeData(scopedData);
    const comparisonDisplayData = getComparisonDisplayData(data);

    if (view === "capacity") {
        title.innerText = "How much queue activity is happening in this market?";
        subtitle.innerText = "Compare annual queued capacity across ISOs. If a specific ISO is selected, this view breaks out the states within that ISO. If a specific state is selected, the view stays scoped to that state.";
        capacityStack(comparisonDisplayData, comparisonRangeData);
    } else if (view === "projects") {
        title.innerText = "How many projects are competing in this market?";
        subtitle.innerText = "Compare the number of queue entries across ISOs. If a specific ISO is selected, this view breaks out the states within that ISO. If a specific state is selected, the view stays scoped to that state.";
        projectStack(comparisonDisplayData, comparisonRangeData);
    } else {
        title.innerText = "How large are projects in this market?";
        subtitle.innerText = "Compare average project size across ISOs. If a specific ISO is selected, this view breaks out the states within that ISO. If a specific state is selected, the view stays scoped to that state.";
        avgStack(comparisonDisplayData, comparisonRangeData);
    }
}

function capacityStack(data, rangeData){
    const grouping = getComparisonGroupingMode();
    const groupingKeys = getComparisonGroupingKeys(rangeData);
    const years = getYearDomain(rangeData);

    const filteredTotals = {};
    const rangeTotals = {};
    groupingKeys.forEach(k => {
        filteredTotals[k] = {};
        rangeTotals[k] = {};
    });

    data.forEach(d => {
        const key = grouping === "ISO" ? (d.ISO || "Unknown") : (d.State || "Unknown");
        filteredTotals[key][d.year] = (filteredTotals[key][d.year] || 0) + (d.MW || 0);
    });

    rangeData.forEach(d => {
        const key = grouping === "ISO" ? (d.ISO || "Unknown") : (d.State || "Unknown");
        rangeTotals[key][d.year] = (rangeTotals[key][d.year] || 0) + (d.MW || 0);
    });

    const traces = groupingKeys.map(k => ({
        x: years,
        y: years.map(y => (filteredTotals[k][y] || 0) / 1000),
        name: k,
        type: "bar",
        marker: { color: getComparisonColor(k, grouping) },
        hovertemplate:
            (grouping === "ISO" ? "ISO: " : "State: ") + k + "<br>" +
            "Queue Year: %{x}<br>" +
            "Queued Capacity: %{y:.2f} GW<extra></extra>"
    }));

    const maxStack = years.reduce((max, y) => {
        const total = groupingKeys.reduce((sum, k) => sum + ((rangeTotals[k][y] || 0) / 1000), 0);
        return Math.max(max, total);
    }, 0);

    Plotly.newPlot("comparisonChart", traces, {
        title: "",
        barmode: "stack",
        xaxis: {
            title: "Queue Year",
            range: years.length ? [years[0] - 0.5, years[years.length - 1] + 0.5] : undefined
        },
        yaxis: {
            title: "Queued Capacity (GW)",
            range: [0, maxStack ? maxStack * 1.05 : 1]
        },
        margin: { t: 30, r: 20, b: 60, l: 70 }
    }, { displayModeBar: false, responsive: true });
}

function projectStack(data, rangeData){
    const grouping = getComparisonGroupingMode();
    const groupingKeys = getComparisonGroupingKeys(rangeData);
    const years = getYearDomain(rangeData);

    const filteredTotals = {};
    const rangeTotals = {};
    groupingKeys.forEach(k => {
        filteredTotals[k] = {};
        rangeTotals[k] = {};
    });

    data.forEach(d => {
        const key = grouping === "ISO" ? (d.ISO || "Unknown") : (d.State || "Unknown");
        filteredTotals[key][d.year] = (filteredTotals[key][d.year] || 0) + 1;
    });

    rangeData.forEach(d => {
        const key = grouping === "ISO" ? (d.ISO || "Unknown") : (d.State || "Unknown");
        rangeTotals[key][d.year] = (rangeTotals[key][d.year] || 0) + 1;
    });

    const traces = groupingKeys.map(k => ({
        x: years,
        y: years.map(y => filteredTotals[k][y] || 0),
        name: k,
        type: "bar",
        marker: { color: getComparisonColor(k, grouping) },
        hovertemplate:
            (grouping === "ISO" ? "ISO: " : "State: ") + k + "<br>" +
            "Queue Year: %{x}<br>" +
            "Number of Queue Entries: %{y}<extra></extra>"
    }));

    const maxStack = years.reduce((max, y) => {
        const total = groupingKeys.reduce((sum, k) => sum + (rangeTotals[k][y] || 0), 0);
        return Math.max(max, total);
    }, 0);

    Plotly.newPlot("comparisonChart", traces, {
        title: "",
        barmode: "stack",
        xaxis: {
            title: "Queue Year",
            range: years.length ? [years[0] - 0.5, years[years.length - 1] + 0.5] : undefined
        },
        yaxis: {
            title: "Number of Queue Entries",
            range: [0, maxStack ? maxStack * 1.05 : 1]
        },
        margin: { t: 30, r: 20, b: 60, l: 70 }
    }, { displayModeBar: false, responsive: true });
}

function avgStack(data, rangeData){
    const grouping = getComparisonGroupingMode();
    const groupingKeys = getComparisonGroupingKeys(rangeData);
    const years = getYearDomain(rangeData);

    const filteredAvg = {};
    const rangeAvg = {};
    groupingKeys.forEach(k => {
        filteredAvg[k] = {};
        rangeAvg[k] = {};
    });

    groupingKeys.forEach(k => {
        const sum = {};
        const count = {};
        data.filter(d => (grouping === "ISO" ? (d.ISO || "Unknown") === k : (d.State || "Unknown") === k)).forEach(d => {
            sum[d.year] = (sum[d.year] || 0) + (d.MW || 0);
            count[d.year] = (count[d.year] || 0) + 1;
        });
        years.forEach(y => {
            filteredAvg[k][y] = sum[y] && count[y] ? sum[y] / count[y] : 0;
        });
    });

    groupingKeys.forEach(k => {
        const sum = {};
        const count = {};
        rangeData.filter(d => (grouping === "ISO" ? (d.ISO || "Unknown") === k : (d.State || "Unknown") === k)).forEach(d => {
            sum[d.year] = (sum[d.year] || 0) + (d.MW || 0);
            count[d.year] = (count[d.year] || 0) + 1;
        });
        years.forEach(y => {
            rangeAvg[k][y] = sum[y] && count[y] ? sum[y] / count[y] : 0;
        });
    });

    const traces = groupingKeys.map(k => ({
        x: years,
        y: years.map(y => filteredAvg[k][y] || 0),
        name: k,
        type: "bar",
        marker: { color: getComparisonColor(k, grouping) },
        hovertemplate:
            (grouping === "ISO" ? "ISO: " : "State: ") + k + "<br>" +
            "Queue Year: %{x}<br>" +
            "Average Project Size: %{y:.0f} MW<extra></extra>"
    }));

    const maxStack = years.reduce((max, y) => {
        const total = groupingKeys.reduce((sum, k) => sum + (rangeAvg[k][y] || 0), 0);
        return Math.max(max, total);
    }, 0);

    Plotly.newPlot("comparisonChart", traces, {
        title: "",
        barmode: "stack",
        xaxis: {
            title: "Queue Year",
            range: years.length ? [years[0] - 0.5, years[years.length - 1] + 0.5] : undefined
        },
        yaxis: {
            title: "Average Project Size (MW)",
            range: [0, maxStack ? maxStack * 1.05 : 1]
        },
        margin: { t: 30, r: 20, b: 60, l: 70 }
    }, { displayModeBar: false, responsive: true });
}


// ---------------- MISO DEEP DIVE ----------------
var misoData = [];
var misoProjectTableSort = { key: null, direction: "", type: "text" };
function misoEl(id){ return document.getElementById(id); }
function misoRaw(row, name){ return row && row.Raw && !isMissing(row.Raw[name]) ? String(row.Raw[name]).trim() : ""; }
function misoHydrate(row){ return Object.assign({}, row, {
    POIName: misoRaw(row,"POI Name") || row.POI || "",
    TransmissionOwner: misoRaw(row,"Transmission Owner"),
    StudyCycle: misoRaw(row,"Study Cycle"),
    StudyGroup: misoRaw(row,"Study Group"),
    ServiceType: misoRaw(row,"Service Type"),
    DoneDate: toDate(row.Raw && row.Raw["Done Date"])
}); }
function syncMisoDataFromMaster(resetFilters){
    misoData = (Array.isArray(masterData) ? masterData : []).filter(d => String(d.ISO || "").toUpperCase() === "MISO").map(misoHydrate);
    if (resetFilters) populateMisoFilters();
    updateMisoDeepDive();
}
function fillMisoSelect(id, values, label){
    const select=misoEl(id); if(!select) return; const prev=select.value;
    const vals=[...new Set(values.filter(v=>!isMissing(v) && String(v).trim()!==""))].sort();
    select.innerHTML=`<option value="All">${label}</option>`+vals.map(v=>`<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`).join("");
    select.value=vals.includes(prev)?prev:"All";
}
function fillMisoYears(id, years){ const sel=misoEl(id); if(!sel)return; sel.innerHTML=""; years.forEach(y=>{const o=document.createElement("option");o.value=y;o.textContent=y;sel.appendChild(o);}); }
function populateMisoFilters(){
    buildMultiSelect("misoStateFilterDropdown",           misoData.map(d=>d.State),        "All States",          updateMisoDeepDive);
    buildMultiSelect("misoCountyFilterDropdown",          misoData.map(d=>d.County),       "All Counties",        updateMisoDeepDive);
    buildMultiSelect("misoFuelFilterDropdown",            misoData.map(d=>d.Fuel),         "All Fuels",           updateMisoDeepDive);
    buildMultiSelect("misoStatusFilterDropdown",          misoData.map(d=>d.Status),       "All Statuses",        updateMisoDeepDive);
    buildMultiSelect("misoStudyCycleFilterDropdown",      misoData.map(d=>d.StudyCycle),   "All Study Cycles",    updateMisoDeepDive);
    buildMultiSelect("misoStudyGroupFilterDropdown",      misoData.map(d=>d.StudyGroup),   "All Study Groups",    updateMisoDeepDive);
    buildMultiSelect("misoServiceTypeFilterDropdown",     misoData.map(d=>d.ServiceType),  "All Service Types",   updateMisoDeepDive);
    buildMultiSelect("misoTransmissionOwnerFilterDropdown", misoData.map(d=>d.TransmissionOwner), "All Transmission Owners", updateMisoDeepDive);
    const q=[...new Set(misoData.map(d=>d.year).filter(Boolean))].sort((a,b)=>a-b);
    const p=[...new Set(misoData.map(d=>d.proposedYear).filter(Boolean))].sort((a,b)=>a-b);
    fillMisoYears("misoQueueYearStart",q); fillMisoYears("misoQueueYearEnd",q); fillMisoYears("misoProposedYearStart",p); fillMisoYears("misoProposedYearEnd",p);
    if(q.length){misoEl("misoQueueYearStart").value=q[0];misoEl("misoQueueYearEnd").value=q[q.length-1];}
    if(p.length){misoEl("misoProposedYearStart").value=p[0];misoEl("misoProposedYearEnd").value=p[p.length-1];}
}
function getFilteredMisoData(){
    const states   = getMultiSelectValues("misoStateFilterDropdown");
    const counties = getMultiSelectValues("misoCountyFilterDropdown");
    const fuels    = getMultiSelectValues("misoFuelFilterDropdown");
    const statuses = getMultiSelectValues("misoStatusFilterDropdown");
    const cycles   = getMultiSelectValues("misoStudyCycleFilterDropdown");
    const groups   = getMultiSelectValues("misoStudyGroupFilterDropdown");
    const services = getMultiSelectValues("misoServiceTypeFilterDropdown");
    const tos      = getMultiSelectValues("misoTransmissionOwnerFilterDropdown");
    const qs=Number(misoEl("misoQueueYearStart")?.value), qe=Number(misoEl("misoQueueYearEnd")?.value);
    const ps=Number(misoEl("misoProposedYearStart")?.value), pe=Number(misoEl("misoProposedYearEnd")?.value);
    return misoData.filter(d =>
        (!states.length   || states.includes(d.State))   &&
        (!counties.length || counties.includes(d.County)) &&
        (!fuels.length    || fuels.includes(d.Fuel))     &&
        (!statuses.length || statuses.includes(d.Status)) &&
        (!cycles.length   || cycles.includes(d.StudyCycle)) &&
        (!groups.length   || groups.includes(d.StudyGroup)) &&
        (!services.length || services.includes(d.ServiceType)) &&
        (!tos.length      || tos.includes(d.TransmissionOwner)) &&
        (!Number.isFinite(qs)||!d.year||d.year>=qs) &&
        (!Number.isFinite(qe)||!d.year||d.year<=qe) &&
        (!Number.isFinite(ps)||!d.proposedYear||d.proposedYear>=ps) &&
        (!Number.isFinite(pe)||!d.proposedYear||d.proposedYear<=pe)
    );
}
function updateMisoDeepDive(){
    const content=misoEl("misoContent"), blank=misoEl("misoBlankState");
    if(!misoData.length){ if(blank)blank.classList.remove("hidden"); if(content)content.classList.add("hidden"); return; }
    if(blank)blank.classList.add("hidden"); if(content)content.classList.remove("hidden"); markChartsLoading("misoContent"); if(misoEl("misoStatus"))misoEl("misoStatus").innerText=`Loaded ${misoData.length.toLocaleString()} MISO records from the wide master JSON.`;
    const data=getFilteredMisoData(); renderMisoKpis(data); renderMisoYearFuelChart(data); renderMisoCombinedCycleGroupChart(data); renderMisoQueueVsProposedChart(data); renderMisoProjectTable(data);
}
function misoTop(data,key){const t={};data.forEach(d=>{const v=d[key]||"Unknown";t[v]=(t[v]||0)+(d.MW||0);});return Object.entries(t).sort((a,b)=>b[1]-a[1])[0]||["—",0];}
function misoMedian(values){const arr=values.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);if(!arr.length)return null;const mid=Math.floor(arr.length/2);return arr.length%2?arr[mid]:(arr[mid-1]+arr[mid])/2;}
function renderMisoKpis(data){const mw=data.reduce((s,d)=>s+(d.MW||0),0), n=data.length; const c=misoTop(data,"StudyCycle"), g=misoTop(data,"StudyGroup"); const durations=data.filter(d=>d.QueueDate&&d.ProposedDate).map(d=>(d.ProposedDate-d.QueueDate)/(1000*60*60*24*365.25)).filter(v=>v>=0); const med=misoMedian(durations); misoEl("misoKpiProjects").innerText=n.toLocaleString();misoEl("misoKpiCapacity").innerText=formatGW(mw);misoEl("misoKpiAverage").innerText=`${Math.round(n?mw/n:0).toLocaleString()} MW`;misoEl("misoKpiStudyCycle").innerText=c[0];misoEl("misoKpiStudyCycleShare").innerText=`${mw?(c[1]/mw*100).toFixed(1):0}% of visible capacity`;misoEl("misoKpiStudyGroup").innerText=g[0];misoEl("misoKpiStudyGroupShare").innerText=`${mw?(g[1]/mw*100).toFixed(1):0}% of visible capacity`;misoEl("misoKpiMedianYears").innerText=med===null?"—":`${med.toFixed(1)} yrs`;}
function renderMisoYearFuelChart(data){const view=misoEl("misoFuelDateView")?.value||"queue", totals={};data.forEach(d=>{const y=view==="proposed"?d.proposedYear:d.year;if(!y)return;const f=d.Fuel||"Unknown";totals[y]=totals[y]||{};totals[y][f]=(totals[y][f]||0)+(d.MW||0);});const years=Object.keys(totals).sort((a,b)=>a-b), fuels=[...new Set(data.map(d=>d.Fuel||"Unknown"))].sort();Plotly.newPlot("misoYearFuelChart",fuels.map(f=>({x:years,y:years.map(y=>((totals[y]&&totals[y][f])||0)/1000),name:f,type:"bar",marker:{color:fuelColors[f]||"#6b7280"},hovertemplate:"Fuel Type: "+f+"<br>"+(view==="proposed"?"Proposed Year":"Queue Year")+": %{x}<br>Capacity: %{y:.2f} GW<extra></extra>"})),{title:view==="proposed"?"MISO Fuel Mix by Proposed Year":"MISO Fuel Mix by Queue Year",barmode:"stack",xaxis:{title:view==="proposed"?"Proposed Year":"Queue Year"},yaxis:{title:"Capacity (GW)"},margin:{t:30,r:20,b:40,l:60}},{displayModeBar:false,responsive:true});}
function renderMisoCombinedCycleGroupChart(data){
    const groupBy=misoEl("misoCombinedGroupByView")?.value||"cycle";
    const metric=misoEl("misoCombinedMetricView")?.value||"capacity";
    const categoryKey=groupBy==="group"?"StudyGroup":"StudyCycle";
    const cats=[...new Set(data.map(d=>d[categoryKey]||"Unknown"))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:"base"}));
    const statuses=[...new Set(data.map(d=>d.Status||"Unknown"))].sort();
    const totals={}; cats.forEach(c=>totals[c]={});
    data.forEach(d=>{const c=d[categoryKey]||"Unknown", st=d.Status||"Unknown"; totals[c][st]=(totals[c][st]||0)+(metric==="projects"?1:(d.MW||0)/1000);});
    const xTitle=groupBy==="group"?"Study Group":"Study Cycle";
    const yTitle=metric==="projects"?"Project Count":"Capacity (GW)";
    const chartTitle=(metric==="projects"?"Project Count":"Capacity")+" by "+(groupBy==="group"?"Study Group":"Study Cycle")+" and Status";
    Plotly.newPlot("misoCombinedCycleGroupChart",statuses.map(st=>({x:cats,y:cats.map(c=>(totals[c]&&totals[c][st])||0),name:st,type:"bar",hovertemplate:xTitle+": %{x}<br>Status: "+st+"<br>"+(metric==="projects"?"Projects: %{y}":"Capacity: %{y:.2f} GW")+"<extra></extra>"})),{title:chartTitle,barmode:"stack",xaxis:{title:xTitle},yaxis:{title:yTitle},margin:{t:30,r:20,b:85,l:60}},{displayModeBar:false,responsive:true});
}
function renderMisoQueueVsProposedChart(data){const rows=data.filter(d=>d.QueueDate&&d.ProposedDate);const hidden=data.length-rows.length;const misoNoteEl=document.getElementById("misoScatterNote");if(misoNoteEl)misoNoteEl.innerText=hidden>0?`${hidden.toLocaleString()} project${hidden===1?"":"s"} not shown — missing queue or proposed date.`:"";const fuels=[...new Set(rows.map(d=>d.Fuel||"Unknown"))].sort();Plotly.newPlot("misoQueueVsProposedChart",fuels.map(f=>{const r=rows.filter(d=>(d.Fuel||"Unknown")===f);return{x:r.map(d=>d.QueueDate),y:r.map(d=>d.ProposedDate),mode:"markers",type:"scatter",name:f,marker:{size:9,color:fuelColors[f]||"#6b7280",opacity:.75,line:{width:.5,color:"#fff"}},customdata:r.map(d=>[d.ProjectID,d.State,d.County,d.POIName,d.MW,d.Fuel,d.Status,d.StudyCycle,d.StudyGroup,d.ServiceType]),hovertemplate:"Project ID: %{customdata[0]}<br>State: %{customdata[1]}<br>County: %{customdata[2]}<br>POI: %{customdata[3]}<br>MW Capacity: %{customdata[4]:.0f}<br>Fuel Type: %{customdata[5]}<br>Status: %{customdata[6]}<br>Study Cycle: %{customdata[7]}<br>Study Group: %{customdata[8]}<br>Service Type: %{customdata[9]}<extra></extra>"};}),{title:"Queue Date vs Proposed Date",xaxis:{title:"Queue Date"},yaxis:{title:"Proposed Date"},hovermode:"closest",hoverdistance:2,margin:{t:30,r:20,b:40,l:60}},{displayModeBar:false,responsive:true});}
function setMisoProjectTableSort(key,type,direction){misoProjectTableSort={key,type,direction};document.querySelectorAll(".miso-header-sort").forEach(s=>{if(s.dataset.key!==key)s.value="";});renderMisoProjectTable(getFilteredMisoData());}
function misoSortValue(row,key,type){const v=row[key];if(type==="number")return Number.isFinite(Number(v))?Number(v):null;if(type==="date")return v instanceof Date&&!isNaN(v)?v.getTime():null;return v==null?"":String(v).toLowerCase();}
function renderMisoProjectTable(data){const tbody=misoEl("misoProjectTableBody");if(!tbody)return;const search=(misoEl("misoTableSearch")?.value||"").trim().toLowerCase();let rows=search?data.filter(d=>String(d.ProjectID||"").toLowerCase().includes(search)||String(d.POIName||"").toLowerCase().includes(search)||String(d.TransmissionOwner||"").toLowerCase().includes(search)):data;if(misoProjectTableSort.key&&misoProjectTableSort.direction){const m=misoProjectTableSort.direction==="desc"?-1:1;rows=[...rows].sort((a,b)=>{const av=misoSortValue(a,misoProjectTableSort.key,misoProjectTableSort.type),bv=misoSortValue(b,misoProjectTableSort.key,misoProjectTableSort.type);if(av===null||av==="")return 1;if(bv===null||bv==="")return -1;return (misoProjectTableSort.type==="number"||misoProjectTableSort.type==="date"?(av-bv):String(av).localeCompare(String(bv)))*m;});}
tbody.innerHTML=(rows.map(d=>`<tr><td>${(d.ProjectID||"Unknown").replace(/</g,"&lt;")}</td><td>${d.QueueDate?d.QueueDate.toISOString().split("T")[0]:""}</td><td>${(d.Status||"").replace(/</g,"&lt;")}</td><td>${(d.County||"").replace(/</g,"&lt;")}</td><td>${(d.State||"").replace(/</g,"&lt;")}</td><td>${(d.POIName||"").replace(/</g,"&lt;")}</td><td>${(d.MW||0).toFixed(0)}</td><td>${(d.Fuel||"Unknown").replace(/</g,"&lt;")}</td><td>${d.ProposedDate?d.ProposedDate.toISOString().split("T")[0]:""}</td><td>${(d.TransmissionOwner||"").replace(/</g,"&lt;")}</td><td>${(d.StudyCycle||"").replace(/</g,"&lt;")}</td><td>${(d.StudyGroup||"").replace(/</g,"&lt;")}</td><td>${(d.ServiceType||"").replace(/</g,"&lt;")}</td></tr>`).join(""))||'<tr><td colspan="13" style="text-align:center;">No matching MISO projects.</td></tr>';}
function setupMisoDeepDive(){
    ["misoQueueYearStart","misoQueueYearEnd","misoProposedYearStart","misoProposedYearEnd"].forEach(id=>{const e=misoEl(id);if(e)e.addEventListener("change",updateMisoDeepDive);});
    const search=misoEl("misoTableSearch");if(search)search.addEventListener("input",()=>renderMisoProjectTable(getFilteredMisoData()));
    const reset=misoEl("misoResetFilters");if(reset)reset.addEventListener("click",()=>{
        resetMultiSelect("misoStateFilterDropdown","All States");
        resetMultiSelect("misoCountyFilterDropdown","All Counties");
        resetMultiSelect("misoFuelFilterDropdown","All Fuels");
        resetMultiSelect("misoStatusFilterDropdown","All Statuses");
        resetMultiSelect("misoStudyCycleFilterDropdown","All Study Cycles");
        resetMultiSelect("misoStudyGroupFilterDropdown","All Study Groups");
        resetMultiSelect("misoServiceTypeFilterDropdown","All Service Types");
        resetMultiSelect("misoTransmissionOwnerFilterDropdown","All Transmission Owners");
        if(search)search.value="";misoProjectTableSort={key:null,direction:"",type:"text"};
        populateMisoFilters();updateMisoDeepDive();
    });
}
const originalShowTabForMiso = showTab;
showTab = function(tabId){ originalShowTabForMiso(tabId); if(tabId==="miso"){ setTimeout(()=>{ if(Array.isArray(masterData)&&masterData.length>0){ if(!misoData.length) syncMisoDataFromMaster(true); else updateMisoDeepDive(); } else updateMisoDeepDive(); },80); } };
setupMisoDeepDive();


// ---------------- ISO-NE DEEP DIVE ----------------
var isoneData = [];
var isoneProjectTableSort = { key: null, direction: "", type: "text" };
function isoneEl(id){ return document.getElementById(id); }
function isoneZoneValue(d){ return d.Zone || (d.Raw && (d.Raw.Zone || d.Raw["Zone"])) || "Unknown"; }
function isoneHydrate(row){
    const zone = isoneZoneValue(row);
    const withdrawnDate = row.WithdrawnDate || toDate(row.Raw && (row.Raw["Withdrawn Date"] || row.Raw["W/ D Date"]));
    return Object.assign({}, row, { Zone: zone || "Unknown", WithdrawnDate: withdrawnDate });
}
function syncIsoneDataFromMaster(resetFilters){
    isoneData = (Array.isArray(masterData) ? masterData : [])
        .filter(d => ["ISONE", "ISO-NE", "ISO NE"].includes(String(d.ISO || "").toUpperCase()))
        .map(isoneHydrate);
    if (resetFilters) populateIsoneFilters();
    updateIsoneDeepDive();
}
function fillIsoneSelect(id, values, label){
    const select = isoneEl(id); if(!select) return;
    const previous = select.value;
    const vals = [...new Set(values.filter(v => !isMissing(v) && String(v).trim() !== ""))].sort();
    select.innerHTML = `<option value="All">${label}</option>` + vals.map(v => `<option value="${String(v).replace(/"/g, '&quot;')}">${v}</option>`).join("");
    select.value = vals.includes(previous) ? previous : "All";
}
function fillIsoneYears(id, years){
    const select = isoneEl(id); if(!select) return;
    select.innerHTML = "";
    years.forEach(y => { const opt = document.createElement("option"); opt.value = y; opt.textContent = y; select.appendChild(opt); });
}
function populateIsoneFilters(){
    buildMultiSelect("isoneZoneFilterDropdown",   isoneData.map(d => d.Zone),   "All Zones",    updateIsoneDeepDive);
    buildMultiSelect("isoneStateFilterDropdown",  isoneData.map(d => d.State),  "All States",   updateIsoneDeepDive);
    buildMultiSelect("isoneCountyFilterDropdown", isoneData.map(d => d.County), "All Counties", updateIsoneDeepDive);
    buildMultiSelect("isoneFuelFilterDropdown",   isoneData.map(d => d.Fuel),   "All Fuels",    updateIsoneDeepDive);
    buildMultiSelect("isoneStatusFilterDropdown", isoneData.map(d => d.Status), "All Statuses", updateIsoneDeepDive);
    const q = [...new Set(isoneData.map(d => d.year).filter(Boolean))].sort((a,b)=>a-b);
    const p = [...new Set(isoneData.map(d => d.proposedYear).filter(Boolean))].sort((a,b)=>a-b);
    fillIsoneYears("isoneQueueYearStart", q); fillIsoneYears("isoneQueueYearEnd", q);
    fillIsoneYears("isoneProposedYearStart", p); fillIsoneYears("isoneProposedYearEnd", p);
    if(q.length){ isoneEl("isoneQueueYearStart").value = q[0]; isoneEl("isoneQueueYearEnd").value = q[q.length-1]; }
    if(p.length){ isoneEl("isoneProposedYearStart").value = p[0]; isoneEl("isoneProposedYearEnd").value = p[p.length-1]; }
}
function getFilteredIsoneData(){
    const zones    = getMultiSelectValues("isoneZoneFilterDropdown");
    const states   = getMultiSelectValues("isoneStateFilterDropdown");
    const counties = getMultiSelectValues("isoneCountyFilterDropdown");
    const fuels    = getMultiSelectValues("isoneFuelFilterDropdown");
    const statuses = getMultiSelectValues("isoneStatusFilterDropdown");
    const qs = Number(isoneEl("isoneQueueYearStart")?.value);
    const qe = Number(isoneEl("isoneQueueYearEnd")?.value);
    const ps = Number(isoneEl("isoneProposedYearStart")?.value);
    const pe = Number(isoneEl("isoneProposedYearEnd")?.value);
    return isoneData.filter(d =>
        (!zones.length    || zones.includes(d.Zone))    &&
        (!states.length   || states.includes(d.State))  &&
        (!counties.length || counties.includes(d.County)) &&
        (!fuels.length    || fuels.includes(d.Fuel))    &&
        (!statuses.length || statuses.includes(d.Status)) &&
        (!Number.isFinite(qs) || !d.year || d.year >= qs) &&
        (!Number.isFinite(qe) || !d.year || d.year <= qe) &&
        (!Number.isFinite(ps) || !d.proposedYear || d.proposedYear >= ps) &&
        (!Number.isFinite(pe) || !d.proposedYear || d.proposedYear <= pe)
    );
}
function updateIsoneDeepDive(){
    const content = isoneEl("isoneContent"), blank = isoneEl("isoneBlankState");
    if(!isoneData.length){
        if(blank) blank.classList.remove("hidden");
        if(content) content.classList.add("hidden");
        return;
    }
    if(blank) blank.classList.add("hidden");
    if(content) content.classList.remove("hidden");
    markChartsLoading("isoneContent");
    if(isoneEl("isoneStatus")) isoneEl("isoneStatus").innerText = `Loaded ${isoneData.length.toLocaleString()} ISO-NE records from the wide master JSON.`;
    const data = getFilteredIsoneData();
    renderIsoneKpis(data);
    renderIsoneYearFuelChart(data);
    renderIsoneWithdrawalChart(data);
    renderIsoneZoneStatusChart(data);
    renderIsoneQueueVsProposedChart(data);
    renderIsoneProjectTable(data);
}
function isoneMedian(values){
    const arr = values.filter(v => Number.isFinite(v)).sort((a,b)=>a-b);
    if(!arr.length) return null;
    const mid = Math.floor(arr.length/2);
    return arr.length % 2 ? arr[mid] : (arr[mid-1] + arr[mid]) / 2;
}
function isoneTopByMW(data, key){
    const totals = {};
    data.forEach(d => { const v = d[key] || "Unknown"; totals[v] = (totals[v] || 0) + (d.MW || 0); });
    return Object.entries(totals).sort((a,b)=>b[1]-a[1])[0] || ["—",0];
}
function renderIsoneKpis(data){
    const mw = data.reduce((s,d)=>s+(d.MW||0),0), n = data.length;
    const topZone = isoneTopByMW(data, "Zone");
    const withdrawn = data.filter(d => String(d.Status || "").toLowerCase().includes("withdraw")).length;
    const durations = data.filter(d => d.QueueDate && d.ProposedDate).map(d => (d.ProposedDate - d.QueueDate) / (1000*60*60*24*365.25)).filter(v => v >= 0);
    const med = isoneMedian(durations);
    isoneEl("isoneKpiProjects").innerText = n.toLocaleString();
    isoneEl("isoneKpiCapacity").innerText = formatGW(mw);
    isoneEl("isoneKpiAverage").innerText = `${Math.round(n ? mw/n : 0).toLocaleString()} MW`;
    isoneEl("isoneKpiTopZone").innerText = topZone[0];
    isoneEl("isoneKpiTopZoneShare").innerText = `${mw ? (topZone[1]/mw*100).toFixed(1) : 0}% of visible capacity`;
    isoneEl("isoneKpiWithdrawnShare").innerText = `${n ? (withdrawn/n*100).toFixed(1) : 0}%`;
    isoneEl("isoneKpiMedianYears").innerText = med === null ? "—" : `${med.toFixed(1)} yrs`;
}
function renderIsoneYearFuelChart(data){
    const view = isoneEl("isoneFuelDateView")?.value || "queue";
    const totals = {};
    data.forEach(d => { const y = view === "proposed" ? d.proposedYear : d.year; if(!y) return; const f = d.Fuel || "Unknown"; totals[y] = totals[y] || {}; totals[y][f] = (totals[y][f] || 0) + (d.MW || 0); });
    const years = Object.keys(totals).sort((a,b)=>Number(a)-Number(b));
    const fuels = [...new Set(data.map(d => d.Fuel || "Unknown"))].sort();
    Plotly.newPlot("isoneYearFuelChart", fuels.map(f => ({
        x: years,
        y: years.map(y => ((totals[y] && totals[y][f]) || 0) / 1000),
        name: f,
        type: "bar",
        marker: { color: fuelColors[f] || "#6b7280" },
        hovertemplate: "Fuel Type: " + f + "<br>" + (view === "proposed" ? "Proposed Year" : "Queue Year") + ": %{x}<br>Capacity: %{y:.2f} GW<extra></extra>"
    })), { title: view === "proposed" ? "ISO-NE Fuel Mix by Proposed Year" : "ISO-NE Fuel Mix by Queue Year", barmode: "stack", xaxis: { title: view === "proposed" ? "Proposed Year" : "Queue Year" }, yaxis: { title: "Capacity (GW)" }, margin: { t:30,r:20,b:40,l:60 } }, { displayModeBar:false, responsive:true });
}
function renderIsoneWithdrawalChart(data) {
    var noteEl = document.getElementById("isoneWithdrawalNote");
    // Use full isoneData (not filtered) to get denominator per year
    var allRows = isoneData.length ? isoneData : data;
    var totalByYear = {};
    allRows.forEach(function(d) { if (d.year) totalByYear[d.year] = (totalByYear[d.year] || 0) + 1; });

    var wByYear = {};
    data.forEach(function(d) {
        if (!d.QueueDate) return;
        var yr = d.QueueDate.getFullYear();
        var isWithdrawn = String(d.Status || "").toLowerCase().includes("withdraw");
        if (isWithdrawn) wByYear[yr] = (wByYear[yr] || 0) + 1;
    });

    var years = Object.keys(totalByYear).map(Number).sort(function(a,b){return a-b;});
    // Exclude current year (incomplete)
    var currentYear = new Date().getFullYear();
    years = years.filter(function(y){ return y < currentYear; });

    if (!years.length) {
        if (noteEl) noteEl.innerText = "No queue-entry year data available.";
        return;
    }

    var counts = years.map(function(y){ return wByYear[y] || 0; });
    var rates  = years.map(function(y, i){ return totalByYear[y] ? ((wByYear[y] || 0) / totalByYear[y] * 100) : 0; });
    var totalWithdrawn = counts.reduce(function(s,v){return s+v;},0);
    if (noteEl) noteEl.innerText = totalWithdrawn + " withdrawn project" + (totalWithdrawn === 1 ? "" : "s") + " in filtered view across all years.";

    Plotly.newPlot("isoneWithdrawalChart", [
        {
            x: years, y: counts, name: "Withdrawn Projects",
            type: "bar",
            marker: { color: "rgba(220,53,69,0.75)" },
            yaxis: "y",
            hovertemplate: "Year: %{x}<br>Withdrawn: %{y}<extra></extra>"
        },
        {
            x: years, y: rates, name: "Withdrawal Rate %",
            type: "scatter", mode: "lines+markers",
            line: { color: "#f59e0b", width: 2 },
            marker: { size: 6, color: "#f59e0b" },
            yaxis: "y2",
            hovertemplate: "Year: %{x}<br>Rate: %{y:.1f}%<extra></extra>"
        }
    ], {
        title: "ISO-NE Withdrawals by Queue-Entry Year",
        barmode: "overlay",
        xaxis: { title: "Queue-Entry Year" },
        yaxis: { title: "Withdrawn Projects", side: "left" },
        yaxis2: { title: "Withdrawal Rate (%)", overlaying: "y", side: "right", showgrid: false, ticksuffix: "%" },
        legend: { x: 0, y: 1.12, orientation: "h" },
        margin: { t: 40, r: 60, b: 45, l: 55 }
    }, { displayModeBar: false, responsive: true });
}

function renderIsoneZoneStatusChart(data){
    const zones = [...new Set(data.map(d => d.Zone || "Unknown"))].sort();
    const statuses = [...new Set(data.map(d => d.Status || "Unknown"))].sort();
    const totals = {}; zones.forEach(z => totals[z] = {});
    data.forEach(d => { const z = d.Zone || "Unknown", st = d.Status || "Unknown"; totals[z][st] = (totals[z][st] || 0) + (d.MW || 0) / 1000; });
    Plotly.newPlot("isoneZoneStatusChart", statuses.map(st => ({ x: zones, y: zones.map(z => (totals[z] && totals[z][st]) || 0), name: st, type: "bar", hovertemplate: "Zone: %{x}<br>Status: " + st + "<br>Capacity: %{y:.2f} GW<extra></extra>" })), { title: "Capacity by Zone and Status", barmode: "stack", xaxis: { title: "Zone" }, yaxis: { title: "Capacity (GW)" }, margin: { t:30,r:20,b:70,l:60 } }, { displayModeBar:false, responsive:true });
}

function renderIsoneQueueVsProposedChart(data){
    const rows = data.filter(d => d.QueueDate && d.ProposedDate);
    const hidden = data.length - rows.length;
    const noteEl = document.getElementById("isoneScatterNote");
    if (noteEl) noteEl.innerText = hidden > 0 ? `${hidden.toLocaleString()} project${hidden === 1 ? "" : "s"} not shown — missing queue or proposed date.` : "";
    const fuels = [...new Set(rows.map(d => d.Fuel || "Unknown"))].sort();
    Plotly.newPlot("isoneQueueVsProposedChart", fuels.map(f => {
        const r = rows.filter(d => (d.Fuel || "Unknown") === f);
        return {
            x: r.map(d => d.QueueDate),
            y: r.map(d => d.ProposedDate),
            mode: "markers",
            type: "scatter",
            name: f,
            marker: {
                size: 9,
                color: fuelColors[f] || "#6b7280",
                opacity: 0.72,
                line: { width: 0.5, color: "#ffffff" }
            },
            customdata: r.map(d => [d.ProjectID, d.Name, d.Zone, d.County, d.State, d.MW, d.Status]),
            hovertemplate: "Project ID: %{customdata[0]}<br>Name: %{customdata[1]}<br>Zone: %{customdata[2]}<br>County: %{customdata[3]}<br>State: %{customdata[4]}<br>MW Capacity: %{customdata[5]:.0f}<br>Status: %{customdata[6]}<extra></extra>"
        };
    }), {
        title: "Queue Date vs Proposed Date",
        xaxis: { title: "Queue Date" },
        yaxis: { title: "Proposed Date" },
        hovermode: "closest",
        margin: { t:30, r:20, b:45, l:60 }
    }, { displayModeBar:false, responsive:true });
}

function setIsoneProjectTableSort(key, type, direction){ isoneProjectTableSort = { key, type, direction }; document.querySelectorAll(".isone-header-sort").forEach(s => { if(s.dataset.key !== key) s.value = ""; }); renderIsoneProjectTable(getFilteredIsoneData()); }
function isoneSortValue(row, key, type){ const v = row[key]; if(type === "number") return Number.isFinite(Number(v)) ? Number(v) : null; if(type === "date") return v instanceof Date && !isNaN(v) ? v.getTime() : null; return v == null ? "" : String(v).toLowerCase(); }
function renderIsoneProjectTable(data){
    const tbody = isoneEl("isoneProjectTableBody"); if(!tbody) return;
    const search = (isoneEl("isoneTableSearch")?.value || "").trim().toLowerCase();
    let rows = search ? data.filter(d => String(d.ProjectID || "").toLowerCase().includes(search) || String(d.Name || "").toLowerCase().includes(search) || String(d.County || "").toLowerCase().includes(search) || String(d.Zone || "").toLowerCase().includes(search)) : data;
    if(isoneProjectTableSort.key && isoneProjectTableSort.direction){ const m = isoneProjectTableSort.direction === "desc" ? -1 : 1; rows = [...rows].sort((a,b) => { const av = isoneSortValue(a, isoneProjectTableSort.key, isoneProjectTableSort.type), bv = isoneSortValue(b, isoneProjectTableSort.key, isoneProjectTableSort.type); if(av === null || av === "") return 1; if(bv === null || bv === "") return -1; return (isoneProjectTableSort.type === "number" || isoneProjectTableSort.type === "date" ? (av - bv) : String(av).localeCompare(String(bv))) * m; }); }
    tbody.innerHTML = rows.map(d => `<tr><td>${(d.ProjectID || "Unknown").replace(/</g,"&lt;")}</td><td>${(d.Name || "Unknown").replace(/</g,"&lt;")}</td><td>${(d.Status || "").replace(/</g,"&lt;")}</td><td>${d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : ""}</td><td>${d.WithdrawnDate ? d.WithdrawnDate.toISOString().split("T")[0] : ""}</td><td>${(d.County || "").replace(/</g,"&lt;")}</td><td>${(d.State || "").replace(/</g,"&lt;")}</td><td>${(d.Zone || "").replace(/</g,"&lt;")}</td><td>${(d.MW || 0).toFixed(0)}</td><td>${(d.Fuel || "Unknown").replace(/</g,"&lt;")}</td><td>${d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : ""}</td></tr>`).join("") || '<tr><td colspan="11" style="text-align:center;">No matching ISO-NE projects.</td></tr>';
}
function setupIsoneDeepDive(){
    ["isoneQueueYearStart","isoneQueueYearEnd","isoneProposedYearStart","isoneProposedYearEnd"].forEach(id => { const e = isoneEl(id); if(e) e.addEventListener("change", updateIsoneDeepDive); });
    const search = isoneEl("isoneTableSearch"); if(search) search.addEventListener("input", () => renderIsoneProjectTable(getFilteredIsoneData()));
    const reset = isoneEl("isoneResetFilters"); if(reset) reset.addEventListener("click", () => {
        resetMultiSelect("isoneZoneFilterDropdown",   "All Zones");
        resetMultiSelect("isoneStateFilterDropdown",  "All States");
        resetMultiSelect("isoneCountyFilterDropdown", "All Counties");
        resetMultiSelect("isoneFuelFilterDropdown",   "All Fuels");
        resetMultiSelect("isoneStatusFilterDropdown", "All Statuses");
        if(search) search.value = "";
        isoneProjectTableSort = { key:null, direction:"", type:"text" };
        populateIsoneFilters(); updateIsoneDeepDive();
    });
}
const originalShowTabForIsone = showTab;
showTab = function(tabId){ originalShowTabForIsone(tabId); if(tabId === "isone"){ setTimeout(() => { if(Array.isArray(masterData) && masterData.length > 0){ if(!isoneData.length) syncIsoneDataFromMaster(true); else updateIsoneDeepDive(); } else updateIsoneDeepDive(); }, 80); } };
setupIsoneDeepDive();




// ---------------- SPP DEEP DIVE ----------------
var sppData = [];
function sppEl(id){ return document.getElementById(id); }
function sppSafe(value){ return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function sppFirst(row, keys){
    const raw = row.Raw || {};
    for (const key of keys){
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
        if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== "") return raw[key];
    }
    return null;
}
function sppHydrate(row){
    const queueDate = row.QueueDate || toDate(sppFirst(row, ["Queue Date", "QueueDate"]));
    const rawProposedDate = row.ProposedDate || toDate(sppFirst(row, ["Proposed Date", "ProposedDate", "In-Service Date", "In Service Date"]));
    const proposedDate = (rawProposedDate && queueDate && rawProposedDate < queueDate) ? null : rawProposedDate;
    return Object.assign({}, row, {
        ISO: "SPP",
        ProjectID: sppFirst(row, ["Project ID", "ProjectID", "Generation Interconnection Number"]) || "Unknown",
        Status: sppFirst(row, ["Status"]) || "Unknown",
        QueueDate: queueDate,
        ProposedDate: proposedDate,
        year: queueDate ? queueDate.getFullYear() : null,
        proposedYear: proposedDate ? proposedDate.getFullYear() : null,
        TransmissionOwner: sppFirst(row, ["Transmission Owner", "TransmissionOwner", "TO at POI"]) || "Unknown",
        ServiceType: sppFirst(row, ["Service Type", "ServiceType"]) || "Unknown",
        County: sppFirst(row, ["County", "Nearest Town or County"]) || "Unknown",
        State: sppFirst(row, ["State"]) || "Unknown",
        StudyCycle: sppFirst(row, ["Study Cycle", "StudyCycle", "Current Cluster"]) || "Unknown",
        StudyGroup: sppFirst(row, ["Study Group", "StudyGroup", "Cluster Group"]) || "Unknown",
        MW: Number.isFinite(row.MW) ? row.MW : toNumber(sppFirst(row, ["MW Capacity", "MW", "Capacity"])),
        Fuel: sppFirst(row, ["Fuel Type", "Fuel", "Generation Type"]) || "Unknown"
    });
}
function syncSppDataFromMaster(resetFilters){
    sppData = (Array.isArray(masterData) ? masterData : []).filter(d => String(d.ISO || "").toUpperCase() === "SPP").map(sppHydrate);
    if (resetFilters) populateSppFilters();
    updateSppDeepDive();
}
function fillSppSelect(id, values, label){
    const sel = sppEl(id); if(!sel) return;
    const prev = sel.value;
    const vals = [...new Set(values.filter(v => !isMissing(v) && String(v).trim() !== ""))].sort((a,b)=>String(a).localeCompare(String(b), undefined, { numeric:true, sensitivity:"base" }));
    sel.innerHTML = `<option value="All">${label}</option>` + vals.map(v => `<option value="${sppSafe(v)}">${sppSafe(v)}</option>`).join("");
    sel.value = vals.includes(prev) ? prev : "All";
}
function fillSppYears(id, years){
    const sel = sppEl(id); if(!sel) return;
    sel.innerHTML = "";
    years.forEach(y => { const opt = document.createElement("option"); opt.value = y; opt.textContent = y; sel.appendChild(opt); });
}
function populateSppFilters(){
    buildMultiSelect("sppStateFilterDropdown",             sppData.map(d=>d.State),             "All States",             updateSppDeepDive);
    buildMultiSelect("sppCountyFilterDropdown",            sppData.map(d=>d.County),            "All Counties",           updateSppDeepDive);
    buildMultiSelect("sppFuelFilterDropdown",              sppData.map(d=>d.Fuel),              "All Fuels",              updateSppDeepDive);
    buildMultiSelect("sppStatusFilterDropdown",            sppData.map(d=>d.Status),            "All Statuses",           updateSppDeepDive);
    buildMultiSelect("sppStudyCycleFilterDropdown",        sppData.map(d=>d.StudyCycle),        "All Study Cycles",       updateSppDeepDive);
    buildMultiSelect("sppStudyGroupFilterDropdown",        sppData.map(d=>d.StudyGroup),        "All Study Groups",       updateSppDeepDive);
    buildMultiSelect("sppServiceTypeFilterDropdown",       sppData.map(d=>d.ServiceType),       "All Service Types",      updateSppDeepDive);
    buildMultiSelect("sppTransmissionOwnerFilterDropdown", sppData.map(d=>d.TransmissionOwner), "All Transmission Owners", updateSppDeepDive);
    const q = [...new Set(sppData.map(d=>d.year).filter(Boolean))].sort((a,b)=>a-b);
    const p = [...new Set(sppData.map(d=>d.proposedYear).filter(Boolean))].sort((a,b)=>a-b);
    fillSppYears("sppQueueYearStart", q); fillSppYears("sppQueueYearEnd", q);
    fillSppYears("sppProposedYearStart", p); fillSppYears("sppProposedYearEnd", p);
    if(q.length){ sppEl("sppQueueYearStart").value = q[0]; sppEl("sppQueueYearEnd").value = q[q.length-1]; }
    if(p.length){ sppEl("sppProposedYearStart").value = p[0]; sppEl("sppProposedYearEnd").value = p[p.length-1]; }
}
function getFilteredSppData(){
    const states   = getMultiSelectValues("sppStateFilterDropdown");
    const counties = getMultiSelectValues("sppCountyFilterDropdown");
    const fuels    = getMultiSelectValues("sppFuelFilterDropdown");
    const statuses = getMultiSelectValues("sppStatusFilterDropdown");
    const cycles   = getMultiSelectValues("sppStudyCycleFilterDropdown");
    const groups   = getMultiSelectValues("sppStudyGroupFilterDropdown");
    const services = getMultiSelectValues("sppServiceTypeFilterDropdown");
    const tos      = getMultiSelectValues("sppTransmissionOwnerFilterDropdown");
    const qs=Number(sppEl("sppQueueYearStart")?.value), qe=Number(sppEl("sppQueueYearEnd")?.value);
    const ps=Number(sppEl("sppProposedYearStart")?.value), pe=Number(sppEl("sppProposedYearEnd")?.value);
    return sppData.filter(d =>
        (!states.length   || states.includes(d.State))   &&
        (!counties.length || counties.includes(d.County)) &&
        (!fuels.length    || fuels.includes(d.Fuel))     &&
        (!statuses.length || statuses.includes(d.Status)) &&
        (!cycles.length   || cycles.includes(d.StudyCycle)) &&
        (!groups.length   || groups.includes(d.StudyGroup)) &&
        (!services.length || services.includes(d.ServiceType)) &&
        (!tos.length      || tos.includes(d.TransmissionOwner)) &&
        (!Number.isFinite(qs) || !d.year || d.year >= qs) &&
        (!Number.isFinite(qe) || !d.year || d.year <= qe) &&
        (!Number.isFinite(ps) || !d.proposedYear || d.proposedYear >= ps) &&
        (!Number.isFinite(pe) || !d.proposedYear || d.proposedYear <= pe)
    );
}
function sppTopByMW(data, key){
    const totals = {}; data.forEach(d => { const v = d[key] || "Unknown"; totals[v] = (totals[v] || 0) + (d.MW || 0); });
    return Object.entries(totals).sort((a,b)=>b[1]-a[1])[0] || ["—",0];
}
function sppMedian(values){
    const arr = values.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b);
    if(!arr.length) return null; const mid=Math.floor(arr.length/2); return arr.length%2 ? arr[mid] : (arr[mid-1]+arr[mid])/2;
}
function updateSppDeepDive(){
    const content = sppEl("sppContent"), blank = sppEl("sppBlankState");
    if(!sppData.length){
        if(blank){ blank.classList.remove("hidden"); const message=blank.querySelector("p"); if(message) message.innerText = (Array.isArray(masterData) && masterData.length>0) ? "No SPP rows were found in the loaded wide master JSON." : "Load the wide master JSON to view SPP queue timing, study cycle, study group, service type, and project-level detail."; }
        if(content) content.classList.add("hidden"); return;
    }
    if(blank) blank.classList.add("hidden"); if(content) content.classList.remove("hidden");
    markChartsLoading("sppContent");
    if(sppEl("sppStatus")) sppEl("sppStatus").innerText = `Loaded ${sppData.length.toLocaleString()} SPP records from the wide master JSON.`;
    const data = getFilteredSppData();
    renderSppKpis(data); renderSppFuelCharts(data); renderSppCombinedCycleGroupChart(data); renderSppQueueVsProposedChart(data); renderSppLocationCharts(data); renderSppProjectTable(data);
    setTimeout(()=>["sppYearFuelChart","sppCombinedCycleGroupChart","sppQueueVsProposedChart","sppCountyChart"].forEach(id=>{ const e=sppEl(id); if(e && typeof Plotly !== "undefined") Plotly.Plots.resize(e); }),80);
}
function renderSppKpis(data){
    const n=data.length, mw=data.reduce((s,d)=>s+(d.MW||0),0), avg=n?mw/n:0;
    const topCycle=sppTopByMW(data,"StudyCycle"), topGroup=sppTopByMW(data,"StudyGroup");
    const durations=data.filter(d=>d.QueueDate&&d.ProposedDate).map(d=>(d.ProposedDate-d.QueueDate)/(1000*60*60*24*365.25)).filter(v=>v>=0);
    const med=sppMedian(durations);
    sppEl("sppKpiProjects").innerText=n.toLocaleString(); sppEl("sppKpiCapacity").innerText=formatGW(mw); sppEl("sppKpiAverage").innerText=`${Math.round(avg).toLocaleString()} MW`;
    sppEl("sppKpiStudyCycle").innerText=topCycle[0]; sppEl("sppKpiStudyCycleShare").innerText=`${mw ? (topCycle[1]/mw*100).toFixed(1) : 0}% of visible capacity`;
    sppEl("sppKpiStudyGroup").innerText=topGroup[0]; sppEl("sppKpiStudyGroupShare").innerText=`${mw ? (topGroup[1]/mw*100).toFixed(1) : 0}% of visible capacity`;
    sppEl("sppKpiMedianYears").innerText=med===null ? "—" : `${med.toFixed(1)} yrs`;
}
function renderSppFuelCharts(data){
    const view=sppEl("sppFuelDateView")?.value||"queue"; const totals={};
    data.forEach(d=>{ const y=view==="proposed"?d.proposedYear:d.year; if(!y) return; const f=d.Fuel||"Unknown"; totals[y]=totals[y]||{}; totals[y][f]=(totals[y][f]||0)+(d.MW||0); });
    const years=Object.keys(totals).sort((a,b)=>Number(a)-Number(b)); const fuels=[...new Set(data.map(d=>d.Fuel||"Unknown"))].sort();
    Plotly.newPlot("sppYearFuelChart", fuels.map(f=>({x:years,y:years.map(y=>((totals[y]&&totals[y][f])||0)/1000),name:f,type:"bar",marker:{color:fuelColors[f]||"#6b7280"},hovertemplate:"Fuel Type: "+f+"<br>"+(view==="proposed"?"Proposed Year":"Queue Year")+": %{x}<br>Capacity: %{y:.2f} GW<extra></extra>"})), {title:view==="proposed"?"SPP Fuel Mix by Proposed Year":"SPP Fuel Mix by Queue Year",barmode:"stack",xaxis:{title:view==="proposed"?"Proposed Year":"Queue Year"},yaxis:{title:"Capacity (GW)"},margin:{t:30,r:20,b:45,l:60}}, {displayModeBar:false,responsive:true});
}
function renderSppStackedCategoryChart(divId, data, categoryKey, metricView, title, xTitle){
    const cats=[...new Set(data.map(d=>d[categoryKey]||"Unknown"))].sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true,sensitivity:"base"}));
    const statuses=[...new Set(data.map(d=>d.Status||"Unknown"))].sort(); const totals={}; cats.forEach(c=>totals[c]={});
    data.forEach(d=>{ const c=d[categoryKey]||"Unknown", st=d.Status||"Unknown"; totals[c][st]=(totals[c][st]||0)+(metricView==="projects"?1:(d.MW||0)/1000); });
    Plotly.newPlot(divId, statuses.map(st=>({x:cats,y:cats.map(c=>(totals[c]&&totals[c][st])||0),name:st,type:"bar",hovertemplate:xTitle+": %{x}<br>Status: "+st+"<br>"+(metricView==="projects"?"Projects: %{y}":"Capacity: %{y:.2f} GW")+"<extra></extra>"})), {title:title,barmode:"stack",xaxis:{title:xTitle},yaxis:{title:metricView==="projects"?"Project Count":"Capacity (GW)"},margin:{t:30,r:20,b:85,l:60}}, {displayModeBar:false,responsive:true});
}
function renderSppCombinedCycleGroupChart(data){
    const groupBy = sppEl("sppCombinedGroupByView")?.value || "cycle";
    const metric  = sppEl("sppCombinedMetricView")?.value  || "capacity";
    const key     = groupBy === "group" ? "StudyGroup" : "StudyCycle";
    const title   = groupBy === "group" ? "SPP Study Group by Status" : "SPP Study Cycle by Status";
    const xTitle  = groupBy === "group" ? "Study Group" : "Study Cycle";
    renderSppStackedCategoryChart("sppCombinedCycleGroupChart", data, key, metric, title, xTitle);
}
function renderSppQueueVsProposedChart(data){
    const rows=data.filter(d=>d.QueueDate&&d.ProposedDate);
    const hidden=data.length-rows.length;
    const noteEl=document.getElementById("sppScatterNote");
    if(noteEl)noteEl.innerText=hidden>0?`${hidden.toLocaleString()} project${hidden===1?"":"s"} not shown — missing queue or proposed date.`:"";
    const fuels=[...new Set(rows.map(d=>d.Fuel||"Unknown"))].sort();
    Plotly.newPlot("sppQueueVsProposedChart", fuels.map(f=>{ const r=rows.filter(d=>(d.Fuel||"Unknown")===f); return {x:r.map(d=>d.QueueDate),y:r.map(d=>d.ProposedDate),mode:"markers",type:"scatter",name:f,marker:{size:r.map(d=>Math.max(7,Math.min(26,Math.sqrt(d.MW||0)*1.35))),color:fuelColors[f]||"#6b7280",opacity:0.78,line:{width:0.5,color:"#ffffff"}},customdata:r.map(d=>[d.ProjectID,d.Status,d.TransmissionOwner,d.ServiceType,d.County,d.State,d.StudyCycle,d.StudyGroup,d.MW,d.Fuel]),hovertemplate:"Project ID: %{customdata[0]}<br>Status: %{customdata[1]}<br>Transmission Owner: %{customdata[2]}<br>Service Type: %{customdata[3]}<br>County: %{customdata[4]}<br>State: %{customdata[5]}<br>Study Cycle: %{customdata[6]}<br>Study Group: %{customdata[7]}<br>MW Capacity: %{customdata[8]:.0f}<br>Fuel Type: %{customdata[9]}<extra></extra>"}; }), {title:"SPP Queue Date vs Proposed Date",xaxis:{title:"Queue Date"},yaxis:{title:"Proposed Date"},margin:{t:30,r:20,b:45,l:60}}, {displayModeBar:false,responsive:true});
}
function renderSppLocationCharts(data){
    const countyTotals={}; data.forEach(d=>{ const c=d.County||"Unknown"; countyTotals[c]=(countyTotals[c]||0)+(d.MW||0); });
    const counties=Object.entries(countyTotals).sort((a,b)=>b[1]-a[1]).slice(0,15);
    Plotly.newPlot("sppCountyChart", [{x:counties.map(r=>r[1]/1000),y:counties.map(r=>r[0]),type:"bar",orientation:"h",marker:{color:"#fbbf24"},hovertemplate:"County: %{y}<br>Capacity: %{x:.2f} GW<extra></extra>"}], {title:"Top Counties by SPP Capacity",xaxis:{title:"Capacity (GW)"},yaxis:{title:"County",autorange:"reversed",automargin:true},margin:{t:30,r:20,b:45,l:120}}, {displayModeBar:false,responsive:true});
}
function setupSppDeepDive(){
    ["sppQueueYearStart","sppQueueYearEnd","sppProposedYearStart","sppProposedYearEnd","sppCombinedGroupByView","sppCombinedMetricView","sppFuelDateView"].forEach(id=>{ const el=sppEl(id); if(el) el.addEventListener("change", updateSppDeepDive); });
    const reset=sppEl("sppResetFilters"); if(reset) reset.addEventListener("click", ()=>{
        resetMultiSelect("sppStateFilterDropdown",             "All States");
        resetMultiSelect("sppCountyFilterDropdown",            "All Counties");
        resetMultiSelect("sppFuelFilterDropdown",              "All Fuels");
        resetMultiSelect("sppStatusFilterDropdown",            "All Statuses");
        resetMultiSelect("sppStudyCycleFilterDropdown",        "All Study Cycles");
        resetMultiSelect("sppStudyGroupFilterDropdown",        "All Study Groups");
        resetMultiSelect("sppServiceTypeFilterDropdown",       "All Service Types");
        resetMultiSelect("sppTransmissionOwnerFilterDropdown", "All Transmission Owners");
        populateSppFilters(); updateSppDeepDive();
    });
}
const originalShowTabForSpp = showTab;
showTab = function(tabId){
    originalShowTabForSpp(tabId);
    if(tabId === "spp"){
        setTimeout(()=>{ if(Array.isArray(masterData)&&masterData.length>0){ if(!sppData.length) syncSppDataFromMaster(true); else updateSppDeepDive(); } else updateSppDeepDive(); },80);
    }
};
setupSppDeepDive();


// ---------------- PJM DEEP DIVE ----------------
var pjmData = [];
var pjmProjectTableSort = { key: null, direction: "", type: "text" };
const pjmPhaseOrder = [
    "Application",
    "Phase 1",
    "Phase 2",
    "Phase 3",
    "Final Agreement",
    "Unknown"
];
const pjmPhaseColors = {
    "Application":"#60a5fa",
    "Phase 1":"#2563eb",
    "Phase 2":"#7c3aed",
    "Phase 3":"#db2777",
    "Final Agreement":"#16a34a",
    "Unknown":"#9ca3af"
};
function pjmEl(id){ return document.getElementById(id); }
function pjmSafe(value){ return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function pjmFirst(row, keys){
    const raw = row.Raw || {};
    for (const key of keys){
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
        if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== "") return raw[key];
    }
    return null;
}
function pjmReduceStudyPhase(value){
    if (isMissing(value)) return "Unknown";
    const phase = String(value).trim();
    const normalized = phase.toUpperCase();
    const phaseMap = {
        "APPLICATION SUBMISSION": "Application",
        "APPLICATION PHASE": "Application",
        "APPLICATION REVIEW": "Application",
        "RRI APPLICATION REVIEW": "Application",
        "PHASE 1": "Phase 1",
        "DP1": "Phase 1",
        "DECISION POINT 1": "Phase 1",
        "PHASE 2": "Phase 2",
        "DP2": "Phase 2",
        "DECISION POINT 2": "Phase 2",
        "PHASE 3": "Phase 3",
        "DP3": "Phase 3",
        "DECISION POINT 3": "Phase 3",
        "FINAL AGREEMENT": "Final Agreement"
    };
    return phaseMap[normalized] || phase;
}
function pjmPhaseRank(phase){
    const reduced = pjmReduceStudyPhase(phase);
    const idx = pjmPhaseOrder.indexOf(reduced || "Unknown");
    return idx === -1 ? pjmPhaseOrder.length : idx;
}
function pjmHydrate(row){
    const queueDate = row.QueueDate || toDate(pjmFirst(row, ["Queue Date", "QueueDate"]));
    const rawProposedDate = row.ProposedDate || toDate(pjmFirst(row, ["Proposed Date", "ProposedDate", "Requested In-Service Date", "Requested In Service Date"]));
    const proposedDate = (rawProposedDate && queueDate && rawProposedDate < queueDate) ? null : rawProposedDate;
    const withdrawnDate = row.WithdrawnDate || toDate(pjmFirst(row, ["Withdrawn Date", "WithdrawnDate"]));
    const phase = pjmReduceStudyPhase(pjmFirst(row, ["Study Phase", "StudyPhase", "Stage"]));
    const cycle = pjmFirst(row, ["Study Cycle", "StudyCycle", "Cycle"]) || "Unknown";
    const mw = Number.isFinite(row.MW) ? row.MW : toNumber(pjmFirst(row, ["MW Capacity", "MW", "Capacity"]));
    return Object.assign({}, row, {
        ISO: "PJM",
        ProjectID: pjmFirst(row, ["Project ID", "ProjectID", "Queue Number", "QueueNumber"]) || "Unknown",
        QueueDate: queueDate,
        ProposedDate: proposedDate,
        WithdrawnDate: withdrawnDate,
        year: queueDate ? queueDate.getFullYear() : null,
        proposedYear: proposedDate ? proposedDate.getFullYear() : null,
        Status: pjmFirst(row, ["Status"]) || "Unknown",
        StudyCycle: cycle,
        StudyPhase: phase,
        POIName: pjmFirst(row, ["POI Name", "POIName", "Name"]) || "Unknown",
        TransmissionOwner: pjmFirst(row, ["Transmission Owner", "TransmissionOwner"]) || "Unknown",
        State: pjmFirst(row, ["State"]) || "Unknown",
        County: pjmFirst(row, ["County"]) || "",
        MW: mw,
        Fuel: pjmFirst(row, ["Fuel Type", "Fuel", "FuelType"]) || "Unknown"
    });
}
function pjmSortedPhases(values){
    return [...new Set(values)].sort((a,b) => pjmPhaseRank(a) - pjmPhaseRank(b) || String(a).localeCompare(String(b)));
}
function pjmSortedCycles(values){
    return [...new Set(values)].sort((a,b) => String(a).localeCompare(String(b), undefined, { numeric:true, sensitivity:"base" }));
}
function syncPjmDataFromMaster(resetFilters){
    pjmData = (Array.isArray(masterData) ? masterData : [])
        .filter(d => String(d.ISO || pjmFirst(d, ["ISO"]) || "").toUpperCase() === "PJM")
        .map(pjmHydrate);
    if (resetFilters) populatePjmFilters();
    updatePjmDeepDive();
}
function fillPjmSelect(id, values, label, sorter){
    const select = pjmEl(id); if(!select) return;
    const previous = select.value;
    const vals = [...new Set(values.filter(v => !isMissing(v) && String(v).trim() !== ""))];
    const sorted = sorter ? sorter(vals) : vals.sort();
    select.innerHTML = `<option value="All">${label}</option>` + sorted.map(v => `<option value="${pjmSafe(v)}">${pjmSafe(v)}</option>`).join("");
    select.value = sorted.includes(previous) ? previous : "All";
}
function fillPjmYears(id, years){
    const select = pjmEl(id); if(!select) return;
    select.innerHTML = "";
    years.forEach(y => { const opt = document.createElement("option"); opt.value = y; opt.textContent = y; select.appendChild(opt); });
}
function populatePjmFilters(){
    buildMultiSelect("pjmStateFilterDropdown",             pjmData.map(d => d.State),             "All States",             updatePjmDeepDive);
    buildMultiSelect("pjmCountyFilterDropdown",            pjmData.map(d => d.County),            "All Counties",           updatePjmDeepDive);
    buildMultiSelect("pjmStudyCycleFilterDropdown",        pjmData.map(d => d.StudyCycle),        "All Study Cycles",       updatePjmDeepDive);
    buildMultiSelect("pjmStudyPhaseFilterDropdown",        pjmData.map(d => d.StudyPhase),        "All Study Phases",       updatePjmDeepDive);
    buildMultiSelect("pjmStatusFilterDropdown",            pjmData.map(d => d.Status),            "All Statuses",           updatePjmDeepDive);
    buildMultiSelect("pjmFuelFilterDropdown",              pjmData.map(d => d.Fuel),              "All Fuels",              updatePjmDeepDive);
    buildMultiSelect("pjmTransmissionOwnerFilterDropdown", pjmData.map(d => d.TransmissionOwner), "All Transmission Owners", updatePjmDeepDive);
    const q = [...new Set(pjmData.map(d => d.year).filter(Boolean))].sort((a,b)=>a-b);
    const p = [...new Set(pjmData.map(d => d.proposedYear).filter(Boolean))].sort((a,b)=>a-b);
    fillPjmYears("pjmQueueYearStart", q); fillPjmYears("pjmQueueYearEnd", q);
    fillPjmYears("pjmProposedYearStart", p); fillPjmYears("pjmProposedYearEnd", p);
    if(q.length){ pjmEl("pjmQueueYearStart").value = q[0]; pjmEl("pjmQueueYearEnd").value = q[q.length-1]; }
    if(p.length){ pjmEl("pjmProposedYearStart").value = p[0]; pjmEl("pjmProposedYearEnd").value = p[p.length-1]; }
}
function getFilteredPjmData(){
    const states   = getMultiSelectValues("pjmStateFilterDropdown");
    const counties = getMultiSelectValues("pjmCountyFilterDropdown");
    const cycles   = getMultiSelectValues("pjmStudyCycleFilterDropdown");
    const phases   = getMultiSelectValues("pjmStudyPhaseFilterDropdown");
    const statuses = getMultiSelectValues("pjmStatusFilterDropdown");
    const fuels    = getMultiSelectValues("pjmFuelFilterDropdown");
    const tos      = getMultiSelectValues("pjmTransmissionOwnerFilterDropdown");
    const qs = Number(pjmEl("pjmQueueYearStart")?.value);
    const qe = Number(pjmEl("pjmQueueYearEnd")?.value);
    const ps = Number(pjmEl("pjmProposedYearStart")?.value);
    const pe = Number(pjmEl("pjmProposedYearEnd")?.value);
    return pjmData.filter(d =>
        (!states.length   || states.includes(d.State))   &&
        (!counties.length || counties.includes(d.County)) &&
        (!cycles.length   || cycles.includes(d.StudyCycle)) &&
        (!phases.length   || phases.includes(d.StudyPhase)) &&
        (!statuses.length || statuses.includes(d.Status)) &&
        (!fuels.length    || fuels.includes(d.Fuel))     &&
        (!tos.length      || tos.includes(d.TransmissionOwner)) &&
        (!Number.isFinite(qs) || !d.year || d.year >= qs) &&
        (!Number.isFinite(qe) || !d.year || d.year <= qe) &&
        (!Number.isFinite(ps) || !d.proposedYear || d.proposedYear >= ps) &&
        (!Number.isFinite(pe) || !d.proposedYear || d.proposedYear <= pe)
    );
}
function pjmMedian(values){
    const arr = values.filter(v => Number.isFinite(v)).sort((a,b)=>a-b);
    if(!arr.length) return null;
    const mid = Math.floor(arr.length/2);
    return arr.length % 2 ? arr[mid] : (arr[mid-1] + arr[mid]) / 2;
}
function pjmTopByMW(data, key){
    const totals = {};
    data.forEach(d => { const v = d[key] || "Unknown"; totals[v] = (totals[v] || 0) + (d.MW || 0); });
    return Object.entries(totals).sort((a,b)=>b[1]-a[1])[0] || ["—",0];
}
function updatePjmDeepDive(){
    const content = pjmEl("pjmContent"), blank = pjmEl("pjmBlankState");
    if(!pjmData.length){
        if(blank) blank.classList.remove("hidden");
        if(content) content.classList.add("hidden");
        return;
    }
    if(blank) blank.classList.add("hidden");
    if(content) content.classList.remove("hidden");
    markChartsLoading("pjmContent");
    if(pjmEl("pjmStatus")) pjmEl("pjmStatus").innerText = `Loaded ${pjmData.length.toLocaleString()} PJM records from the wide master JSON.`;
    const data = getFilteredPjmData();
    renderPjmKpis(data);
    renderPjmYearFuelChart(data);
    renderPjmQueueVsProposedChart(data);
    renderPjmPhaseAdvancementTable(data);
    renderPjmProjectTable(data);
}
function renderPjmKpis(data){
    const mw = data.reduce((s,d)=>s+(d.MW||0),0), n = data.length;
    const topPhase = pjmTopByMW(data, "StudyPhase");
    const topCycle = pjmTopByMW(data, "StudyCycle");
    const durations = data.filter(d => d.QueueDate && d.ProposedDate).map(d => (d.ProposedDate - d.QueueDate) / (1000*60*60*24*365.25)).filter(v => v >= 0);
    const med = pjmMedian(durations);
    pjmEl("pjmKpiProjects").innerText = n.toLocaleString();
    pjmEl("pjmKpiCapacity").innerText = formatGW(mw);
    pjmEl("pjmKpiAverage").innerText = `${Math.round(n ? mw/n : 0).toLocaleString()} MW`;
    pjmEl("pjmKpiTopPhase").innerText = topPhase[0];
    pjmEl("pjmKpiTopPhaseShare").innerText = `${mw ? (topPhase[1]/mw*100).toFixed(1) : 0}% of visible capacity`;
    pjmEl("pjmKpiTopCycle").innerText = topCycle[0];
    pjmEl("pjmKpiTopCycleShare").innerText = `${mw ? (topCycle[1]/mw*100).toFixed(1) : 0}% of visible capacity`;
    pjmEl("pjmKpiMedianYears").innerText = med === null ? "—" : `${med.toFixed(1)} yrs`;
}
function renderPjmYearFuelChart(data){
    const view = pjmEl("pjmFuelDateView")?.value || "queue";
    const totals = {};
    data.forEach(d => { const y = view === "proposed" ? d.proposedYear : d.year; if(!y) return; const f = d.Fuel || "Unknown"; totals[y] = totals[y] || {}; totals[y][f] = (totals[y][f] || 0) + (d.MW || 0); });
    const years = Object.keys(totals).sort((a,b)=>Number(a)-Number(b));
    const fuels = [...new Set(data.map(d => d.Fuel || "Unknown"))].sort();
    Plotly.newPlot("pjmYearFuelChart", fuels.map(f => ({
        x: years,
        y: years.map(y => ((totals[y] && totals[y][f]) || 0) / 1000),
        name: f,
        type: "bar",
        marker: { color: fuelColors[f] || "#6b7280" },
        hovertemplate: "Fuel Type: " + f + "<br>" + (view === "proposed" ? "Proposed Year" : "Queue Year") + ": %{x}<br>Capacity: %{y:.2f} GW<extra></extra>"
    })), { title: view === "proposed" ? "PJM Fuel Mix by Proposed Year" : "PJM Fuel Mix by Queue Year", barmode: "stack", xaxis: { title: view === "proposed" ? "Proposed Year" : "Queue Year" }, yaxis: { title: "Capacity (GW)" }, margin: { t:30,r:20,b:40,l:60 } }, { displayModeBar:false, responsive:true });
}
function renderPjmQueueVsProposedChart(data){
    const rows = data.filter(d => d.QueueDate && d.ProposedDate);
    const hidden = data.length - rows.length;
    const noteEl = document.getElementById("pjmScatterNote");
    if (noteEl) noteEl.innerText = hidden > 0 ? `${hidden.toLocaleString()} project${hidden === 1 ? "" : "s"} not shown — missing queue or proposed date.` : "";
    const phases = pjmSortedPhases(rows.map(d => d.StudyPhase || "Unknown"));
    Plotly.newPlot("pjmQueueVsProposedChart", phases.map(ph => {
        const r = rows.filter(d => (d.StudyPhase || "Unknown") === ph);
        return {
            x: r.map(d => d.QueueDate),
            y: r.map(d => d.ProposedDate),
            mode: "markers",
            type: "scatter",
            name: ph,
            marker: { size: r.map(d => Math.max(7, Math.min(26, Math.sqrt(d.MW || 0) * 1.4))), color: pjmPhaseColors[ph] || "#6b7280", opacity: 0.75, line: { width: 0.5, color: "#ffffff" } },
            customdata: r.map(d => [d.ProjectID, d.StudyCycle, d.StudyPhase, d.POIName, d.TransmissionOwner, d.MW, d.Fuel, d.Status]),
            hovertemplate: "Project ID: %{customdata[0]}<br>Study Cycle: %{customdata[1]}<br>Study Phase: %{customdata[2]}<br>POI Name: %{customdata[3]}<br>Transmission Owner: %{customdata[4]}<br>MW Capacity: %{customdata[5]:.0f}<br>Fuel Type: %{customdata[6]}<br>Status: %{customdata[7]}<extra></extra>"
        };
    }), { title: "Queue Date vs Proposed Date", xaxis: { title: "Queue Date" }, yaxis: { title: "Proposed Date" }, hovermode: "closest", margin: { t:30,r:20,b:45,l:60 } }, { displayModeBar:false, responsive:true });
}
function renderPjmPhaseAdvancementTable(data){
    const tbody = pjmEl("pjmPhaseAdvancementBody"); if(!tbody) return;
    const phases = pjmSortedPhases(data.map(d => d.StudyPhase || "Unknown"));
    const totalProjects = data.length;
    const totalMW = data.reduce((s,d)=>s+(d.MW||0),0);
    const rows = phases.map(ph => {
        const phRows = data.filter(d => (d.StudyPhase || "Unknown") === ph);
        const projects = phRows.length;
        const mw = phRows.reduce((s,d)=>s+(d.MW||0),0);
        const pctProjects = totalProjects ? (projects/totalProjects*100) : 0;
        const pctCap = totalMW ? (mw/totalMW*100) : 0;
        const active = phRows.filter(d => String(d.Status||"").toLowerCase().includes("active")||String(d.Status||"").toLowerCase().includes("in service")).length;
        const done = phRows.filter(d => String(d.Status||"").toLowerCase().includes("done")||String(d.Status||"").toLowerCase().includes("complete")||String(d.Status||"").toLowerCase().includes("operational")).length;
        const withdrawn = phRows.filter(d => String(d.Status||"").toLowerCase().includes("withdrawn")||String(d.Status||"").toLowerCase().includes("withdraw")).length;
        return `<tr>
            <td style="font-weight:600;">${pjmSafe(ph)}</td>
            <td>${projects.toLocaleString()}</td>
            <td>${pctProjects.toFixed(1)}%</td>
            <td>${(mw/1000).toFixed(2)} GW</td>
            <td>${pctCap.toFixed(1)}%</td>
            <td>${active.toLocaleString()}</td>
            <td>${done.toLocaleString()}</td>
            <td>${withdrawn.toLocaleString()}</td>
        </tr>`;
    });
    const totalActive = data.filter(d=>String(d.Status||"").toLowerCase().includes("active")||String(d.Status||"").toLowerCase().includes("in service")).length;
    const totalDone = data.filter(d=>String(d.Status||"").toLowerCase().includes("done")||String(d.Status||"").toLowerCase().includes("complete")||String(d.Status||"").toLowerCase().includes("operational")).length;
    const totalWithdrawn = data.filter(d=>String(d.Status||"").toLowerCase().includes("withdrawn")||String(d.Status||"").toLowerCase().includes("withdraw")).length;
    tbody.innerHTML = (rows.join("") || '<tr><td colspan="8" style="text-align:center;">No PJM data.</td></tr>') +
        `<tr style="border-top:2px solid var(--border);font-weight:700;">
            <td>Total</td>
            <td>${totalProjects.toLocaleString()}</td>
            <td>100%</td>
            <td>${(totalMW/1000).toFixed(2)} GW</td>
            <td>100%</td>
            <td>${totalActive.toLocaleString()}</td>
            <td>${totalDone.toLocaleString()}</td>
            <td>${totalWithdrawn.toLocaleString()}</td>
        </tr>`;
}
function setPjmProjectTableSort(key, type, direction){
    pjmProjectTableSort = { key, type, direction };
    document.querySelectorAll(".pjm-header-sort").forEach(s => { if(s.dataset.key !== key) s.value = ""; });
    renderPjmProjectTable(getFilteredPjmData());
}
function pjmSortValue(row, key, type){
    const v = row[key];
    if(type === "number") return Number.isFinite(Number(v)) ? Number(v) : null;
    if(type === "date") return v instanceof Date && !isNaN(v) ? v.getTime() : null;
    if(type === "phase") return pjmPhaseRank(v);
    return v == null ? "" : String(v).toLowerCase();
}
function renderPjmProjectTable(data){
    const tbody = pjmEl("pjmProjectTableBody"); if(!tbody) return;
    const search = (pjmEl("pjmTableSearch")?.value || "").trim().toLowerCase();
    let rows = search ? data.filter(d =>
        String(d.ProjectID || "").toLowerCase().includes(search) ||
        String(d.POIName || "").toLowerCase().includes(search) ||
        String(d.StudyCycle || "").toLowerCase().includes(search) ||
        String(d.StudyPhase || "").toLowerCase().includes(search) ||
        String(d.TransmissionOwner || "").toLowerCase().includes(search)
    ) : data;
    if(pjmProjectTableSort.key && pjmProjectTableSort.direction){
        const m = pjmProjectTableSort.direction === "desc" ? -1 : 1;
        rows = [...rows].sort((a,b) => {
            const av = pjmSortValue(a, pjmProjectTableSort.key, pjmProjectTableSort.type), bv = pjmSortValue(b, pjmProjectTableSort.key, pjmProjectTableSort.type);
            if(av === null || av === "") return 1;
            if(bv === null || bv === "") return -1;
            return (pjmProjectTableSort.type === "number" || pjmProjectTableSort.type === "date" || pjmProjectTableSort.type === "phase" ? (av - bv) : String(av).localeCompare(String(bv))) * m;
        });
    }
    tbody.innerHTML = rows.map(d => `<tr><td>${pjmSafe(d.ProjectID || "Unknown")}</td><td>PJM</td><td>${d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : ""}</td><td>${pjmSafe(d.Status || "")}</td><td>${d.WithdrawnDate ? d.WithdrawnDate.toISOString().split("T")[0] : ""}</td><td>${d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : ""}</td><td>${pjmSafe(d.StudyCycle || "")}</td><td>${pjmSafe(d.StudyPhase || "")}</td><td>${pjmSafe(d.POIName || "")}</td><td>${pjmSafe(d.TransmissionOwner || "")}</td><td>${(d.MW || 0).toFixed(0)}</td><td>${pjmSafe(d.Fuel || "Unknown")}</td></tr>`).join("") || '<tr><td colspan="12" style="text-align:center;">No matching PJM projects.</td></tr>';
}
function setupPjmDeepDive(){
    ["pjmQueueYearStart","pjmQueueYearEnd","pjmProposedYearStart","pjmProposedYearEnd"].forEach(id => { const e = pjmEl(id); if(e) e.addEventListener("change", updatePjmDeepDive); });
    const search = pjmEl("pjmTableSearch"); if(search) search.addEventListener("input", () => renderPjmProjectTable(getFilteredPjmData()));
    const reset = pjmEl("pjmResetFilters"); if(reset) reset.addEventListener("click", () => {
        resetMultiSelect("pjmStateFilterDropdown",             "All States");
        resetMultiSelect("pjmCountyFilterDropdown",            "All Counties");
        resetMultiSelect("pjmStudyCycleFilterDropdown",        "All Study Cycles");
        resetMultiSelect("pjmStudyPhaseFilterDropdown",        "All Study Phases");
        resetMultiSelect("pjmStatusFilterDropdown",            "All Statuses");
        resetMultiSelect("pjmFuelFilterDropdown",              "All Fuels");
        resetMultiSelect("pjmTransmissionOwnerFilterDropdown", "All Transmission Owners");
        if(search) search.value = "";
        pjmProjectTableSort = { key:null, direction:"", type:"text" };
        populatePjmFilters();
        updatePjmDeepDive();
    });
}
const originalShowTabForPjm = showTab;
showTab = function(tabId){
    originalShowTabForPjm(tabId);
    if(tabId === "pjm"){
        setTimeout(() => {
            if(Array.isArray(masterData) && masterData.length > 0){
                if(!pjmData.length) syncPjmDataFromMaster(true); else updatePjmDeepDive();
            } else updatePjmDeepDive();
        }, 80);
    }
};
setupPjmDeepDive();


function renderDataQualitySummary(data) {
    const panel = document.getElementById("dataQualityPanel");
    if (!panel || !data || !data.length) return;

    const isos = ["ERCOT", "ISO-NE", "MISO", "PJM", "SPP"];
    const rows = isos.map(iso => {
        const subset = data.filter(d => String(d.ISO || "").toUpperCase() === iso.toUpperCase() ||
            (iso === "ISO-NE" && String(d.ISO || "").toUpperCase() === "ISONE"));
        if (!subset.length) return null;
        const total = subset.length;
        const missingMW = subset.filter(d => !d.MW || d.MW <= 0).length;
        const missingQueue = subset.filter(d => !d.QueueDate).length;
        const missingProposed = subset.filter(d => !d.ProposedDate).length;
        const pct = (n) => total ? `${Math.round(n / total * 100)}%` : "—";
        return `<tr>
            <td style="font-weight:600">${iso}</td>
            <td>${total.toLocaleString()}</td>
            <td>${missingMW > 0 ? `<span style="color:var(--warning)">${missingMW} (${pct(missingMW)})</span>` : `<span style="color:var(--success)">✓</span>`}</td>
            <td>${missingQueue > 0 ? `<span style="color:var(--warning)">${missingQueue} (${pct(missingQueue)})</span>` : `<span style="color:var(--success)">✓</span>`}</td>
            <td>${missingProposed > 0 ? `<span style="color:var(--warning)">${missingProposed} (${pct(missingProposed)})</span>` : `<span style="color:var(--success)">✓</span>`}</td>
        </tr>`;
    }).filter(Boolean).join("");

    panel.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.82rem;">
        <thead><tr style="text-align:left;border-bottom:1px solid var(--border)">
            <th style="padding:6px 10px">ISO</th>
            <th style="padding:6px 10px">Total</th>
            <th style="padding:6px 10px">Missing MW</th>
            <th style="padding:6px 10px">Missing Queue Date</th>
            <th style="padding:6px 10px">Missing Proposed Date</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

// ============================================================
// DataTables integration — overrides the original hand-rolled
// render*ProjectTable functions with jQuery DataTables versions
// that provide pagination (25/page), built-in search/sort, and
// CSV/Excel export via the Buttons extension.
// ============================================================

var _dtErcot  = null;
var _dtIsone  = null;
var _dtMiso   = null;
var _dtPjm    = null;
var _dtSpp    = null;

function _dtDestroy(instance, tableId){
    try {
        if(typeof $ !== "undefined" && $.fn && $.fn.DataTable && $.fn.DataTable.isDataTable(tableId)){
            $(tableId).DataTable().destroy();
        } else if(instance){
            instance.destroy();
        }
    } catch(e){}
    return null;
}

function _dtInit(tableId, mwColIndex){
    if(typeof $ === "undefined" || !$.fn || !$.fn.DataTable) return null;
    return $(tableId).DataTable({
        destroy: true,
        pageLength: 10,
        order: [[mwColIndex, "desc"]],
        dom: 'B<"dt-top"lf>rtip',
        buttons: [
            { extend: "csv",   text: "Export CSV",   className: "btn-export" },
            { extend: "excel", text: "Export Excel", className: "btn-export" }
        ],
        columnDefs: [{ targets: [mwColIndex], className: "dt-right" }],
        language: { search: "Search table:" }
    });
}

// ── Sidebar tab visibility ──────────────────────────────────
const _originalShowTabForSidebar = showTab;
showTab = function(tabId){
    _originalShowTabForSidebar(tabId);
    document.querySelectorAll(".iso-filter-group").forEach(function(el){
        el.classList.toggle("hidden", el.dataset.tab !== tabId);
    });
};

// ── ERCOT project table ─────────────────────────────────────
function renderErcotProjectTable(data){
    const tbody = document.getElementById("ercotProjectTableBody");
    if(!tbody) return;
    _dtErcot = _dtDestroy(_dtErcot, "#ercot-dt");
    tbody.innerHTML = data.map(function(d){
        return "<tr>" +
            "<td>" + (d.ProjectID || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.Name || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.Developer || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.POI || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.County || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.Zone || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + (d.Fuel || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.MW || 0).toFixed(0) + "</td>" +
            "<td>" + (d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + (d.Status || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.CompletionProbability || 0).toFixed(0) + "%" + "</td>" +
            "<td>" + (d.LatestMilestone || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.LatestMilestoneDate ? d.LatestMilestoneDate.toISOString().split("T")[0] : "") + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="14" style="text-align:center;">No matching ERCOT projects.</td></tr>';
    _dtErcot = _dtInit("#ercot-dt", 8);
}

// ── ISO-NE project table ────────────────────────────────────
function renderIsoneProjectTable(data){
    const tbody = document.getElementById("isoneProjectTableBody");
    if(!tbody) return;
    _dtIsone = _dtDestroy(_dtIsone, "#isone-dt");
    tbody.innerHTML = data.map(function(d){
        return "<tr>" +
            "<td>" + (d.ProjectID || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.Name || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.Status || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + (d.WithdrawnDate ? d.WithdrawnDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + (d.County || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.State || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.Zone || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.MW || 0).toFixed(0) + "</td>" +
            "<td>" + (d.Fuel || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : "") + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="11" style="text-align:center;">No matching ISO-NE projects.</td></tr>';
    _dtIsone = _dtInit("#isone-dt", 8);
}

// ── MISO project table ──────────────────────────────────────
function renderMisoProjectTable(data){
    const tbody = document.getElementById("misoProjectTableBody");
    if(!tbody) return;
    _dtMiso = _dtDestroy(_dtMiso, "#miso-dt");
    tbody.innerHTML = data.map(function(d){
        return "<tr>" +
            "<td>" + (d.ProjectID || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + (d.Status || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.County || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.State || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.POIName || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.MW || 0).toFixed(0) + "</td>" +
            "<td>" + (d.Fuel || "Unknown").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + (d.TransmissionOwner || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.StudyCycle || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.StudyGroup || "").replace(/</g,"&lt;") + "</td>" +
            "<td>" + (d.ServiceType || "").replace(/</g,"&lt;") + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="13" style="text-align:center;">No matching MISO projects.</td></tr>';
    _dtMiso = _dtInit("#miso-dt", 6);
}

// ── PJM project table ───────────────────────────────────────
function renderPjmProjectTable(data){
    const tbody = document.getElementById("pjmProjectTableBody");
    if(!tbody) return;
    _dtPjm = _dtDestroy(_dtPjm, "#pjm-dt");
    tbody.innerHTML = data.map(function(d){
        return "<tr>" +
            "<td>" + pjmSafe(d.ProjectID || "Unknown") + "</td>" +
            "<td>PJM</td>" +
            "<td>" + (d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + pjmSafe(d.Status || "") + "</td>" +
            "<td>" + (d.WithdrawnDate ? d.WithdrawnDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + (d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + pjmSafe(d.StudyCycle || "") + "</td>" +
            "<td>" + pjmSafe(d.StudyPhase || "") + "</td>" +
            "<td>" + pjmSafe(d.POIName || "") + "</td>" +
            "<td>" + pjmSafe(d.TransmissionOwner || "") + "</td>" +
            "<td>" + (d.MW || 0).toFixed(0) + "</td>" +
            "<td>" + pjmSafe(d.Fuel || "Unknown") + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="12" style="text-align:center;">No matching PJM projects.</td></tr>';
    _dtPjm = _dtInit("#pjm-dt", 10);
}

// ── SPP project table ───────────────────────────────────────
function renderSppProjectTable(data){
    const tbody = document.getElementById("sppProjectTableBody");
    if(!tbody) return;
    _dtSpp = _dtDestroy(_dtSpp, "#spp-dt");
    tbody.innerHTML = data.map(function(d){
        return "<tr>" +
            "<td>" + sppSafe(d.ProjectID) + "</td>" +
            "<td>SPP</td>" +
            "<td>" + sppSafe(d.Status) + "</td>" +
            "<td>" + (d.QueueDate ? d.QueueDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + (d.ProposedDate ? d.ProposedDate.toISOString().split("T")[0] : "") + "</td>" +
            "<td>" + sppSafe(d.TransmissionOwner) + "</td>" +
            "<td>" + sppSafe(d.ServiceType) + "</td>" +
            "<td>" + sppSafe(d.County) + "</td>" +
            "<td>" + sppSafe(d.State) + "</td>" +
            "<td>" + sppSafe(d.StudyCycle) + "</td>" +
            "<td>" + sppSafe(d.StudyGroup) + "</td>" +
            "<td>" + sppSafe(d.CauseOfDelay) + "</td>" +
            "<td>" + sppSafe(d.JTIQParticipant) + "</td>" +
            "<td>" + (d.MW || 0).toFixed(0) + "</td>" +
            "<td>" + sppSafe(d.Fuel) + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="15" style="text-align:center;">No matching SPP projects.</td></tr>';
    _dtSpp = _dtInit("#spp-dt", 13);
}

// ── Lazy tab rendering ──────────────────────────────────────────────────────
// Wraps the five ISO updateXxxDeepDive functions so they skip chart rendering
// when their tab is not visible. A dirty flag is set instead and the render
// fires the first time the user actually clicks that tab.
(function () {
    var _dirty = { ercot: false, isone: false, miso: false, pjm: false, spp: false };

    function isActive(tabId) {
        var btn = document.querySelector(".tab-button.active");
        return btn ? btn.dataset.tab === tabId : false;
    }

    var isoMap = {
        ercot: "updateErcotDeepDive",
        isone: "updateIsoneDeepDive",
        miso:  "updateMisoDeepDive",
        pjm:   "updatePjmDeepDive",
        spp:   "updateSppDeepDive"
    };

    Object.keys(isoMap).forEach(function (tabId) {
        var fnName = isoMap[tabId];
        var orig = window[fnName];
        if (typeof orig !== "function") return;
        window[fnName] = function () {
            if (!isActive(tabId)) { _dirty[tabId] = true; return; }
            _dirty[tabId] = false;
            orig.apply(this, arguments);
        };
    });

    // Extend the existing showTab wrapper — when switching to a non-ERCOT ISO tab

    // that has a pending dirty render, fire it now. ERCOT is already handled by
    // the original showTab logic inside app.js.
    var _prevShowTab = showTab;
    showTab = function (tabId) {
        _prevShowTab(tabId);
        var lazyRender = {
            isone: function () { if (typeof updateIsoneDeepDive === "function") updateIsoneDeepDive(); },
            miso:  function () { if (typeof updateMisoDeepDive  === "function") updateMisoDeepDive();  },
            pjm:   function () { if (typeof updatePjmDeepDive   === "function") updatePjmDeepDive();   },
            spp:   function () { if (typeof updateSppDeepDive   === "function") updateSppDeepDive();   }
        };
        if (lazyRender[tabId] && _dirty[tabId]) {
            setTimeout(lazyRender[tabId], 80);
        }
    };
}());


// ── Detail Modal ────────────────────────────────────────────────────────────
// Opens on scatter-point click (project detail) or stacked-bar click (segment
// aggregate). One modal, one event delegation point per chart div.

(function () {
    var modal     = document.getElementById("detail-modal");
    var badge     = document.getElementById("detail-modal-badge");
    var titleEl   = document.getElementById("detail-modal-title");
    var body      = document.getElementById("detail-modal-body");
    var closeBtn  = document.getElementById("detail-modal-close");

    function openModal(badgeText, title, html) {
        badge.textContent   = badgeText;
        titleEl.textContent = title;
        body.innerHTML      = html;
        modal.classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.classList.remove("open");
        document.body.style.overflow = "";
    }

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

    // ── helpers ──────────────────────────────────────────────────────────────
    function esc(v) {
        return String(v == null ? "—" : v)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function field(label, value, full) {
        var cls = full ? "detail-field full" : "detail-field";
        return '<div class="' + cls + '">' +
               '<div class="detail-field-label">' + label + '</div>' +
               '<div class="detail-field-value">' + esc(value) + '</div>' +
               '</div>';
    }

    function accentField(label, value, full) {
        var cls = full ? "detail-field full" : "detail-field";
        return '<div class="' + cls + '">' +
               '<div class="detail-field-label">' + label + '</div>' +
               '<div class="detail-field-value accent">' + esc(value) + '</div>' +
               '</div>';
    }

    function sectionLabel(text) {
        return '<div class="detail-section-label">' + text + '</div>';
    }

    function fmtDate(v) {
        if (!v) return "—";
        if (v instanceof Date) return v.toISOString().split("T")[0];
        return String(v);
    }

    function fmtMW(v) {
        var n = Number(v);
        return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " MW" : "—";
    }

    function barRow(label, pct) {
        var p = Math.max(0, Math.min(100, pct || 0)).toFixed(1);
        return '<div class="detail-bar-row">' +
               '<span class="detail-bar-label">' + esc(label) + '</span>' +
               '<div class="detail-bar-track"><div class="detail-bar-fill" style="width:' + p + '%"></div></div>' +
               '<span class="detail-bar-pct">' + p + '%</span>' +
               '</div>';
    }

    // ── Stacked-bar segment aggregate ────────────────────────────────────────
    // yearKey=null signals that xVal is a category label (study cycle/group),
    // not a year. In that case segName is the Status (trace name), not the group.
    function buildBarSegmentContent(isoLabel, point, dataset, groupKey, yearKey) {
        var segName  = point.data.name;  // fuel OR status (for combined cycle/group charts)
        var xVal     = point.x;          // year number OR category string
        var isYearAxis = yearKey !== null;

        // bucket = all rows in this x-column
        var bucket = dataset.filter(function (d) {
            if (isYearAxis) {
                var dKey = d[yearKey] != null ? d[yearKey] : d.year;
                return String(dKey) === String(xVal);
            }
            // x-axis is the groupKey (StudyCycle / StudyGroup)
            return String(d[groupKey] || "Unknown") === String(xVal);
        });

        // segRows = rows matching the clicked trace
        var segRows = bucket.filter(function (d) {
            if (isYearAxis) {
                // trace name is Fuel
                return String(d[groupKey] || d.Fuel || "Unknown") === String(segName);
            }
            // trace name is Status
            return String(d.Status || "Unknown") === String(segName);
        });

        var totalMW        = bucket.reduce(function (s, d) { return s + (d.MW || 0); }, 0);
        var segMW          = segRows.reduce(function (s, d) { return s + (d.MW || 0); }, 0);
        var segProjects    = segRows.length;
        var bucketProjects = bucket.length;
        var share          = totalMW > 0 ? (segMW / totalMW * 100) : 0;

        // status breakdown within segment
        var statuses = {};
        segRows.forEach(function (d) {
            var s = d.Status || "Unknown";
            statuses[s] = (statuses[s] || 0) + 1;
        });
        var statusRows = Object.entries(statuses)
            .sort(function (a, b) { return b[1] - a[1]; })
            .map(function (e) { return barRow(e[0], (e[1] / segProjects) * 100); })
            .join("");

        var contextLabel = isYearAxis ? "Year" : (groupKey || "Category");
        var segLabel     = isYearAxis ? "Fuel / Group" : "Status";
        var html =
            sectionLabel("Segment") +
            '<div class="detail-grid">' +
            accentField(contextLabel, xVal) +
            field(segLabel, segName) +
            accentField("Segment Capacity", (segMW / 1000).toFixed(2) + " GW") +
            field("Segment Projects", segProjects.toLocaleString()) +
            field("Share of Bucket MW", share.toFixed(1) + "%") +
            field("Bucket Total MW", (totalMW / 1000).toFixed(2) + " GW") +
            '</div>';

        if (statusRows) {
            html += sectionLabel("Status Breakdown (within segment)") + statusRows;
        }

        return html;
    }

    // ── Per-ISO scatter project detail builders ───────────────────────────────

    function buildErcotScatterDetail(cd) {
        // cd: [ProjectID, Name, Developer, Zone, County, MW, Status, CompletionProbability]
        return sectionLabel("Project") +
            '<div class="detail-grid">' +
            field("Project ID", cd[0]) +
            field("Status", cd[6]) +
            field("Name", cd[1], true) +
            field("Developer", cd[2], true) +
            '</div>' +
            sectionLabel("Location & Capacity") +
            '<div class="detail-grid">' +
            accentField("MW Capacity", fmtMW(cd[5])) +
            field("Zone", cd[3]) +
            field("County", cd[4]) +
            field("Completion %", cd[7] !== "—" ? cd[7] + "%" : "—") +
            '</div>';
    }

    function buildDevInsightsScatterDetail(cd) {
        // cd: [ProjectID, ISO, State, Fuel, MW, QueueDate]
        return sectionLabel("Project") +
            '<div class="detail-grid">' +
            field("Project ID", cd[0]) +
            field("ISO", cd[1]) +
            field("State", cd[2]) +
            field("Fuel Type", cd[3]) +
            accentField("MW Capacity", fmtMW(cd[4])) +
            field("Queue Date", cd[5]) +
            '</div>';
    }

    function buildIsoneScatterDetail(cd) {
        // cd: [ProjectID, Name, Zone, County, State, MW, Status]
        return sectionLabel("Project") +
            '<div class="detail-grid">' +
            field("Project ID", cd[0]) +
            field("Status", cd[6]) +
            field("Name", cd[1], true) +
            '</div>' +
            sectionLabel("Location & Capacity") +
            '<div class="detail-grid">' +
            accentField("MW Capacity", fmtMW(cd[5])) +
            field("Zone", cd[2]) +
            field("County", cd[3]) +
            field("State", cd[4]) +
            '</div>';
    }

    function buildMisoScatterDetail(cd) {
        // cd: [ProjectID, State, County, POIName, MW, Fuel, Status, StudyCycle, StudyGroup, ServiceType]
        return sectionLabel("Project") +
            '<div class="detail-grid">' +
            field("Project ID", cd[0]) +
            field("Status", cd[6]) +
            field("Fuel Type", cd[5]) +
            accentField("MW Capacity", fmtMW(cd[4])) +
            field("State", cd[1]) +
            field("County", cd[2]) +
            field("POI Name", cd[3], true) +
            '</div>' +
            sectionLabel("Study Info") +
            '<div class="detail-grid">' +
            field("Study Cycle", cd[7]) +
            field("Study Group", cd[8]) +
            field("Service Type", cd[9]) +
            '</div>';
    }

    function buildPjmScatterDetail(cd) {
        // cd: [ProjectID, StudyCycle, StudyPhase, POIName, TransmissionOwner, MW, Fuel, Status]
        return sectionLabel("Project") +
            '<div class="detail-grid">' +
            field("Project ID", cd[0]) +
            field("Status", cd[7]) +
            field("Fuel Type", cd[6]) +
            accentField("MW Capacity", fmtMW(cd[5])) +
            field("POI Name", cd[3], true) +
            field("Transmission Owner", cd[4], true) +
            '</div>' +
            sectionLabel("Study Info") +
            '<div class="detail-grid">' +
            field("Study Cycle", cd[1]) +
            field("Study Phase", cd[2]) +
            '</div>';
    }

    function buildSppScatterDetail(cd) {
        // cd: [ProjectID, Status, TransmissionOwner, ServiceType, County, State, StudyCycle, StudyGroup, MW, Fuel]
        return sectionLabel("Project") +
            '<div class="detail-grid">' +
            field("Project ID", cd[0]) +
            field("Status", cd[1]) +
            field("Fuel Type", cd[9]) +
            accentField("MW Capacity", fmtMW(cd[8])) +
            field("State", cd[5]) +
            field("County", cd[4]) +
            field("Transmission Owner", cd[2]) +
            field("Service Type", cd[3]) +
            '</div>' +
            sectionLabel("Study Info") +
            '<div class="detail-grid">' +
            field("Study Cycle", cd[6]) +
            field("Study Group", cd[7]) +
            '</div>';
    }

    // ── Wire up click events after Plotly renders ──────────────────────────
    // Plotly fires plotly_click on the div element. We attach after first render
    // by wrapping the underlying newPlot. Since it's already monkey-patched for
    // theme, we layer on top here instead.

    var _origNewPlotForModal = Plotly.newPlot.bind(Plotly);
    Plotly.newPlot = function (div, data, layout, config) {
        var result = _origNewPlotForModal(div, data, layout, config);
        var el = typeof div === "string" ? document.getElementById(div) : div;
        if (!el) return result;
        var divId = el.id;

        // Remove any old listener to avoid stacking on re-renders
        if (el._modalClickHandler && el.removeAllListeners) {
            el.removeAllListeners("plotly_click");
        }

        function handler(evt) {
            var pt = evt.points && evt.points[0];
            if (!pt) return;

            var cd  = pt.customdata;   // array for scatter; undefined for bar
            var iso = "";
            var titleText = "";
            var html = "";

            // ── Scatter charts ──────────────────────────────────────────────
            if (cd && Array.isArray(cd)) {
                if (divId === "fuel") {
                    iso = cd[1] || "Multi-ISO";
                    titleText = cd[0] || "Project";
                    html = buildDevInsightsScatterDetail(cd);
                } else if (divId === "ercotQueueVsProposedChart") {
                    iso = "ERCOT";
                    titleText = (cd[1] && cd[1] !== "Unknown") ? cd[1] : cd[0];
                    html = buildErcotScatterDetail(cd);
                } else if (divId === "isoneQueueVsProposedChart") {
                    iso = "ISO-NE";
                    titleText = (cd[1] && cd[1] !== "Unknown") ? cd[1] : cd[0];
                    html = buildIsoneScatterDetail(cd);
                } else if (divId === "misoQueueVsProposedChart") {
                    iso = "MISO";
                    titleText = cd[0] || "Project";
                    html = buildMisoScatterDetail(cd);
                } else if (divId === "pjmQueueVsProposedChart") {
                    iso = "PJM";
                    titleText = cd[0] || "Project";
                    html = buildPjmScatterDetail(cd);
                } else if (divId === "sppQueueVsProposedChart") {
                    iso = "SPP";
                    titleText = cd[0] || "Project";
                    html = buildSppScatterDetail(cd);
                } else {
                    return; // not a handled scatter
                }
                openModal(iso, titleText, html);
                return;
            }

            // ── Stacked bar charts ──────────────────────────────────────────
            var isBar = pt.data && (pt.data.type === "bar" || pt.data.type === "histogram");
            if (!isBar) return;

            var segName = pt.data.name || "";
            var xVal    = pt.x;

            // resolve dataset + groupKey from divId
            var dataset  = null;
            var groupKey = "Fuel";
            var yearKey  = "year";

            if (divId === "ercotYearFuelChart") {
                dataset = typeof getFilteredErcotData === "function" ? getFilteredErcotData() : ercotData;
                iso = "ERCOT";
                var ercotDateView = document.getElementById("ercotFuelDateView");
                yearKey = (ercotDateView && ercotDateView.value === "proposed") ? "proposedYear" : "year";
            } else if (divId === "isoneYearFuelChart") {
                dataset = typeof getFilteredIsoneData === "function" ? getFilteredIsoneData() : isoneData;
                iso = "ISO-NE";
                var isoneDateView = document.getElementById("isoneFuelDateView");
                yearKey = (isoneDateView && isoneDateView.value === "proposed") ? "proposedYear" : "year";
            } else if (divId === "misoYearFuelChart") {
                dataset = typeof getFilteredMisoData === "function" ? getFilteredMisoData() : misoData;
                iso = "MISO";
                var misoDateView = document.getElementById("misoFuelDateView");
                yearKey = (misoDateView && misoDateView.value === "proposed") ? "proposedYear" : "year";
            } else if (divId === "misoCombinedCycleGroupChart") {
                dataset = typeof getFilteredMisoData === "function" ? getFilteredMisoData() : misoData;
                iso = "MISO";
                var misoGroupBy = document.getElementById("misoCombinedGroupByView");
                groupKey = (misoGroupBy && misoGroupBy.value === "group") ? "StudyGroup" : "StudyCycle";
                yearKey  = null; // x-axis is the group, not a year
            } else if (divId === "pjmYearFuelChart") {
                dataset = typeof getFilteredPjmData === "function" ? getFilteredPjmData() : pjmData;
                iso = "PJM";
                var pjmDateView = document.getElementById("pjmFuelDateView");
                yearKey = (pjmDateView && pjmDateView.value === "proposed") ? "proposedYear" : "year";
            } else if (divId === "sppYearFuelChart") {
                dataset = typeof getFilteredSppData === "function" ? getFilteredSppData() : sppData;
                iso = "SPP";
                var sppDateView = document.getElementById("sppFuelDateView");
                yearKey = (sppDateView && sppDateView.value === "proposed") ? "proposedYear" : "year";
            } else if (divId === "sppCombinedCycleGroupChart") {
                dataset = typeof getFilteredSppData === "function" ? getFilteredSppData() : sppData;
                iso = "SPP";
                var sppGroupBy = document.getElementById("sppCombinedGroupByView");
                groupKey = (sppGroupBy && sppGroupBy.value === "group") ? "StudyGroup" : "StudyCycle";
                yearKey  = null;
            } else if (divId === "isoChart") {
                iso = "Multi-ISO";
                yearKey = "year";
                try {
                    dataset = getFuelFilteredData(getMarketScopedData());
                } catch (e) {
                    dataset = masterData || [];
                }
            } else {
                return;
            }

            if (!dataset) return;
            titleText = segName + " — " + xVal;
            html = buildBarSegmentContent(iso, pt, dataset, groupKey, yearKey);
            openModal(iso, titleText, html);
        }

        el._modalClickHandler = handler;
        el.on("plotly_click", handler);
        return result;
    };

}());

// =====================================================================
// ISO SCORECARD
// =====================================================================

function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

function updateScorecard() {
    var blank   = document.getElementById("scorecardBlankState");
    var content = document.getElementById("scorecardContent");
    if (!Array.isArray(masterData) || !masterData.length) {
        if (blank)   blank.classList.remove("hidden");
        if (content) content.classList.add("hidden");
        return;
    }
    if (blank)   blank.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    var isoOrder = ["ERCOT", "MISO", "ISONE", "PJM", "SPP"];
    var isoLabels = { ERCOT: "ERCOT", MISO: "MISO", ISONE: "ISO-NE", PJM: "PJM", SPP: "SPP" };
    var isoEmoji  = { ERCOT: "⚡", MISO: "🌽", ISONE: "🌊", PJM: "🏙️", SPP: "🌾" };

    // Build per-ISO stats from unfiltered masterData
    var stats = {};
    isoOrder.forEach(function(iso) {
        var rows = masterData.filter(function(d) {
            return String(d.ISO || "").toUpperCase().replace(/-/g, "") === iso.replace(/-/g, "");
        });
        var totalMW   = rows.reduce(function(s, d) { return s + (d.MW || 0); }, 0);
        var withdrawn = rows.filter(function(d) { return String(d.Status || "").toLowerCase().includes("withdraw"); });
        var withdrawnMW = withdrawn.reduce(function(s, d) { return s + (d.MW || 0); }, 0);
        var withdrawRate = rows.length ? (withdrawn.length / rows.length * 100) : 0;

        // Top fuel by MW
        var fuelMW = {};
        rows.forEach(function(d) { fuelMW[d.Fuel] = (fuelMW[d.Fuel] || 0) + (d.MW || 0); });
        var topFuel = Object.entries(fuelMW).sort(function(a, b) { return b[1] - a[1]; })[0];

        // Projects by year for sparkline (last 10 years)
        var currentYear = new Date().getFullYear();
        var yearCounts  = {};
        rows.forEach(function(d) { if (d.year) yearCounts[d.year] = (yearCounts[d.year] || 0) + 1; });
        var sparkYears = [];
        for (var y = currentYear - 9; y <= currentYear; y++) sparkYears.push(y);
        var sparkCounts = sparkYears.map(function(y) { return yearCounts[y] || 0; });

        stats[iso] = {
            label: isoLabels[iso],
            emoji: isoEmoji[iso],
            projects: rows.length,
            totalGW: (totalMW / 1000).toFixed(1),
            avgMW: rows.length ? Math.round(totalMW / rows.length) : 0,
            withdrawRate: withdrawRate.toFixed(1),
            topFuel: topFuel ? topFuel[0] : "—",
            topFuelShare: topFuel && totalMW ? (topFuel[1] / totalMW * 100).toFixed(0) : 0,
            sparkYears: sparkYears,
            sparkCounts: sparkCounts,
            fuelMW: fuelMW
        };
    });

    // Render scorecard tiles
    var grid = document.getElementById("scorecardGrid");
    if (grid) {
        grid.innerHTML = isoOrder.map(function(iso) {
            var s = stats[iso];
            if (!s) return "";
            var withdrawClass = +s.withdrawRate > 40 ? "danger" : +s.withdrawRate > 25 ? "warning" : "success";
            var sparkId = "sparkline-" + iso;
            return '<div class="scorecard-tile">' +
                '<div class="scorecard-tile-header">' +
                    '<span class="scorecard-iso-emoji">' + s.emoji + '</span>' +
                    '<span class="scorecard-iso-name">' + s.label + '</span>' +
                '</div>' +
                '<div class="scorecard-kpis">' +
                    '<div class="scorecard-kpi"><div class="scorecard-kpi-val">' + s.projects.toLocaleString() + '</div><div class="scorecard-kpi-lbl">Projects</div></div>' +
                    '<div class="scorecard-kpi"><div class="scorecard-kpi-val">' + s.totalGW + ' GW</div><div class="scorecard-kpi-lbl">Total Capacity</div></div>' +
                    '<div class="scorecard-kpi"><div class="scorecard-kpi-val">' + s.avgMW + ' MW</div><div class="scorecard-kpi-lbl">Avg Size</div></div>' +
                    '<div class="scorecard-kpi"><div class="scorecard-kpi-val scorecard-kpi-' + withdrawClass + '">' + s.withdrawRate + '%</div><div class="scorecard-kpi-lbl">Withdrawal Rate</div></div>' +
                '</div>' +
                '<div class="scorecard-fuel-row">' +
                    '<span class="scorecard-fuel-label">Top fuel:</span>' +
                    '<span class="scorecard-fuel-val">' + s.topFuel + ' (' + s.topFuelShare + '%)</span>' +
                '</div>' +
                '<div class="scorecard-spark-label">Queue entries per year (last 10 yrs)</div>' +
                '<div class="scorecard-sparkline" id="' + sparkId + '"></div>' +
            '</div>';
        }).join("");

        // Draw sparklines with Plotly
        isoOrder.forEach(function(iso) {
            var s = stats[iso];
            if (!s) return;
            var el = document.getElementById("sparkline-" + iso);
            if (!el || typeof Plotly === "undefined") return;
            var dark = isDark();
            var lineColor = isoColors[iso] || "#2e8b57";
            Plotly.newPlot(el, [{
                x: s.sparkYears,
                y: s.sparkCounts,
                type: "scatter",
                mode: "lines+markers",
                line: { color: lineColor, width: 2 },
                marker: { color: lineColor, size: 4 },
                fill: "tozeroy",
                fillcolor: hexToRgba(lineColor, 0.12),
                hovertemplate: "%{x}: %{y} projects<extra></extra>"
            }], {
                margin: { t: 0, b: 24, l: 28, r: 8 },
                height: 90,
                xaxis: { showgrid: false, tickfont: { size: 9 }, dtick: 2 },
                yaxis: { showgrid: true, tickfont: { size: 9 }, rangemode: "tozero" },
                showlegend: false
            }, { displayModeBar: false, responsive: true });
        });
    }

    // Cross-ISO volume chart
    var allYears = [];
    var currentYr = new Date().getFullYear();
    for (var y = currentYr - 14; y <= currentYr; y++) allYears.push(y);

    var volumeTraces = isoOrder.map(function(iso) {
        var s = stats[iso];
        return {
            name: s.label,
            x: allYears,
            y: allYears.map(function(yr) { return s.sparkYears.includes(yr) ? s.sparkCounts[s.sparkYears.indexOf(yr)] : 0; }),
            type: "bar",
            marker: { color: isoColors[iso] || "#2e8b57" }
        };
    });

    Plotly.newPlot("scorecardVolumeChart", volumeTraces, {
        barmode: "stack",
        height: 320,
        margin: { t: 10, b: 40, l: 50, r: 20 },
        xaxis: { title: "Queue Year" },
        yaxis: { title: "Projects Entering Queue" },
        legend: { orientation: "h", y: -0.2 }
    }, { displayModeBar: false, responsive: true });

    // Cross-ISO fuel mix chart
    var allFuels = [...new Set(masterData.map(function(d) { return d.Fuel; }).filter(Boolean))];
    var fuelTraces = allFuels.map(function(fuel) {
        return {
            name: fuel,
            x: isoOrder.map(function(iso) { return isoLabels[iso]; }),
            y: isoOrder.map(function(iso) { return (stats[iso] && stats[iso].fuelMW[fuel]) ? stats[iso].fuelMW[fuel] / 1000 : 0; }),
            type: "bar",
            marker: { color: fuelColors[fuel] || "#6e7681" }
        };
    });

    Plotly.newPlot("scorecardFuelChart", fuelTraces, {
        barmode: "stack",
        height: 320,
        margin: { t: 10, b: 40, l: 60, r: 20 },
        xaxis: { title: "ISO/RTO" },
        yaxis: { title: "Queued Capacity (GW)" },
        legend: { orientation: "h", y: -0.22 }
    }, { displayModeBar: false, responsive: true });
}