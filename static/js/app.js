
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
        return _origNewPlot(div, data, merged, config);
    };
    Plotly.__themePatched = true;
}

// ---------------- THEME TOGGLE / INIT ----------------
function refreshActiveTabCharts() {
    // Rebuild Plotly theme then re-render whichever tab is active so charts
    // pick up the new dark/light colors. Uses existing update functions only.
    applyPlotlyTheme();
    const activeBtn = document.querySelector(".tab-button.active");
    const tabId = activeBtn ? activeBtn.dataset.tab : "developer-insights";
    try {
        if (tabId === "developer-insights" && typeof render === "function") render();
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

function applyMasterDataRecords(records, sourceLabel){
    masterData = normalize(Array.isArray(records) ? records : []);

    if (!Array.isArray(masterData) || masterData.length === 0) {
        document.getElementById("status").innerText = "No records found in selected master data";
        return false;
    }

    document.getElementById("status").innerText = sourceLabel ? `Loaded ${sourceLabel} ✅` : "Loaded ✅";
    populateMarketFilter();
    populateFuelFilter();
    populateYearFilters();
    render();

    if (typeof syncErcotDataFromMaster === "function") syncErcotDataFromMaster(true);
    if (typeof syncMisoDataFromMaster === "function") syncMisoDataFromMaster(true);
    if (typeof syncIsoneDataFromMaster === "function") syncIsoneDataFromMaster(true);
    if (typeof syncPjmDataFromMaster === "function") syncPjmDataFromMaster(true);
    if (typeof syncSppDataFromMaster === "function") syncSppDataFromMaster(true);
    renderDataQualitySummary(masterData);
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

// Fuel dropdown interactions
fuelDropdownButton.addEventListener("click", () => {
    fuelDropdownMenu.classList.toggle("hidden");
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
    btn.addEventListener("click", e => { e.stopPropagation(); menu.classList.toggle("hidden"); });
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

    document.getElementById("ercotKpiProjects").innerText = totalProjects.toLocaleString();
    document.getElementById("ercotKpiCapacity").innerText = formatGW(totalCapacity);
    document.getElementById("ercotKpiAverage").innerText = `${Math.round(averageProjectSize).toLocaleString()} MW`;
    document.getElementById("ercotKpiZone").innerText = dominantZone[0];
    document.getElementById("ercotKpiZoneShare").innerText = `${totalCapacity ? (dominantZone[1] / totalCapacity * 100).toFixed(1) : 0}% of visible capacity`;
    document.getElementById("ercotKpiProbability").innerText = formatPercent(averageProbability);
    document.getElementById("ercotKpiPercentActive").innerText = formatPercent(percentActive);
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
    if(blank)blank.classList.add("hidden"); if(content)content.classList.remove("hidden"); if(misoEl("misoStatus"))misoEl("misoStatus").innerText=`Loaded ${misoData.length.toLocaleString()} MISO records from the wide master JSON.`;
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
    if(isoneEl("isoneStatus")) isoneEl("isoneStatus").innerText = `Loaded ${isoneData.length.toLocaleString()} ISO-NE records from the wide master JSON.`;
    const data = getFilteredIsoneData();
    renderIsoneKpis(data);
    renderIsoneYearFuelChart(data);
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
        pageLength: 25,
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
            "<td>" + (d.MW || 0).toFixed(0) + "</td>" +
            "<td>" + sppSafe(d.Fuel) + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="13" style="text-align:center;">No matching SPP projects.</td></tr>';
    _dtSpp = _dtInit("#spp-dt", 11);
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