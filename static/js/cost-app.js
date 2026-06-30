'use strict';

// ── Color Palettes ────────────────────────────────────────────────────────────

const COST_COLORS = {
  eris:            '#0077BB',
  nris:            '#EE7733',
  interconnection: '#009988',
};

const FUEL_COLORS = {
  'Solar':           '#FFCC00',
  'Wind':            '#44BB99',
  'Hybrid':          '#AA3377',
  'Battery Storage': '#BBBBBB',
  'Gas':             '#EE3377',
  'Battery':         '#8888CC',
  'Natural Gas':     '#EE3377',
};

const STATE_COLORS = {
  AR: '#4477AA',
  LA: '#EE6677',
  MS: '#228833',
  TX: '#CCBB44',
};

function fuelColor(fuel)  { return FUEL_COLORS[fuel]  || '#888888'; }
function stateColor(state){ return STATE_COLORS[state] || '#888888'; }

// ── State ─────────────────────────────────────────────────────────────────────

let _allProjects  = [];   // full dataset from JSON, never filtered
let _allData      = [];   // currently displayed (filtered) dataset
let _filterMeta   = {};
let _barSortMode  = 'id';
let _barSearch    = '';
let _dt           = null;

// ── Utilities ─────────────────────────────────────────────────────────────────

const fmt = {
  mm:  v => v == null ? '—' : '$' + Number(v).toFixed(1) + 'MM',
  kw:  v => v == null ? '—' : '$' + Number(v).toLocaleString(undefined, {maximumFractionDigits:0}) + '/kW',
  mw:  v => v == null ? '—' : Number(v).toLocaleString(undefined, {maximumFractionDigits:0}) + ' MW',
  pct: v => v == null ? '—' : Number(v).toFixed(1) + '%',
  int: v => v == null ? '—' : Number(v).toLocaleString(),
};

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function plotLayout(extra = {}) {
  const dark = isDark();
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(0,0,0,0)',
    font: { family: 'Inter, Segoe UI, sans-serif', size: 11, color: dark ? '#e6edf3' : '#1a1d23' },
    margin: { t: 20, r: 16, b: 60, l: 70 },
    legend: { bgcolor: 'rgba(0,0,0,0)', borderwidth: 0, font: { size: 10 } },
    xaxis: {
      gridcolor: dark ? '#30363d' : '#e9ecef',
      linecolor: dark ? '#30363d' : '#dee2e6',
      zerolinecolor: dark ? '#30363d' : '#dee2e6',
    },
    yaxis: {
      gridcolor: dark ? '#30363d' : '#e9ecef',
      linecolor: dark ? '#30363d' : '#dee2e6',
      zerolinecolor: dark ? '#30363d' : '#dee2e6',
    },
    hoverlabel: {
      bgcolor: dark ? '#161b22' : '#fff',
      bordercolor: dark ? '#30363d' : '#dee2e6',
      font: { size: 12, color: dark ? '#e6edf3' : '#1a1d23' },
    },
    ...extra,
  };
}

const plotConfig = {
  displayModeBar: true,
  modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
  displaylogo: false,
  responsive: true,
};

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.remove();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function toggleTheme() {
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  document.getElementById('theme-btn').childNodes[2].textContent = dark ? ' Dark Mode' : ' Light Mode';
  localStorage.setItem('theme', dark ? 'light' : 'dark');
  refreshAllCharts();
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.childNodes[2].textContent = saved === 'dark' ? ' Light Mode' : ' Dark Mode';
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function updateRangeDisplay(key) {
  const lo = parseFloat(document.getElementById(key + '-slider-lo').value);
  const hi = parseFloat(document.getElementById(key + '-slider-hi').value);
  if (key === 'mw') {
    document.getElementById('mw-lo-val').textContent = lo.toFixed(0);
    document.getElementById('mw-hi-val').textContent = hi.toFixed(0);
  } else if (key === 'cost') {
    document.getElementById('cost-lo-val').textContent = '$' + lo.toFixed(0) + 'MM';
    document.getElementById('cost-hi-val').textContent = '$' + hi.toFixed(0) + 'MM';
  } else if (key === 'cpkw') {
    document.getElementById('cpkw-lo-val').textContent = '$' + lo.toFixed(0);
    document.getElementById('cpkw-hi-val').textContent = '$' + hi.toFixed(0);
  }
}

function buildFilterParams() {
  const params = new URLSearchParams();
  document.querySelectorAll('#filter-states input:checked').forEach(cb => params.append('state', cb.value));
  document.querySelectorAll('#filter-fuels input:checked').forEach(cb => params.append('fuel', cb.value));
  document.querySelectorAll('#filter-groups input:checked').forEach(cb => params.append('study_group', cb.value));
  params.set('mw_min',   document.getElementById('mw-slider-lo').value);
  params.set('mw_max',   document.getElementById('mw-slider-hi').value);
  params.set('cost_min', document.getElementById('cost-slider-lo').value);
  params.set('cost_max', document.getElementById('cost-slider-hi').value);
  params.set('cpkw_min', document.getElementById('cpkw-slider-lo').value);
  params.set('cpkw_max', document.getElementById('cpkw-slider-hi').value);
  return params;
}

function resetFilters() {
  document.querySelectorAll('#filter-states input, #filter-fuels input, #filter-groups input')
    .forEach(cb => { cb.checked = false; });
  const m = _filterMeta;
  if (m.mw_range)   { setSliderRange('mw',   m.mw_range[0],   m.mw_range[1]); }
  if (m.cost_range) { setSliderRange('cost', m.cost_range[0], m.cost_range[1]); }
  if (m.cpkw_range) { setSliderRange('cpkw', m.cpkw_range[0], m.cpkw_range[1]); }
  ['mw', 'cost', 'cpkw'].forEach(updateRangeDisplay);
  renderAll(_allProjects);
}

function setSliderRange(key, lo, hi) {
  const loEl = document.getElementById(key + '-slider-lo');
  const hiEl = document.getElementById(key + '-slider-hi');
  loEl.min = lo; loEl.max = hi; loEl.value = lo;
  hiEl.min = lo; hiEl.max = hi; hiEl.value = hi;
}

function applyFilters() {
  const params = buildFilterParams();
  const filtered = clientFilter(_allProjects, params);
  renderAll(filtered);
}

// ── Client-side filtering ─────────────────────────────────────────────────────

function clientFilter(data, params) {
  let result = data.slice();

  const states = params.getAll('state');
  const fuels  = params.getAll('fuel');
  const groups = params.getAll('study_group');

  if (states.length) result = result.filter(d => states.includes(d.state));
  if (fuels.length)  result = result.filter(d => fuels.includes(d.fuel));
  if (groups.length) result = result.filter(d => groups.includes(d.study_group));

  const mwMin   = parseFloat(params.get('mw_min'))   || 0;
  const mwMax   = parseFloat(params.get('mw_max'))   || Infinity;
  const costMin = parseFloat(params.get('cost_min')) || 0;
  const costMax = parseFloat(params.get('cost_max')) || Infinity;
  const cpkwMin = parseFloat(params.get('cpkw_min')) || 0;
  const cpkwMax = parseFloat(params.get('cpkw_max')) || Infinity;

  result = result.filter(d =>
    (d.summer_mw   || 0) >= mwMin   && (d.summer_mw   || 0) <= mwMax   &&
    (d.total_cost  || 0) >= costMin && (d.total_cost  || 0) <= costMax &&
    (d.total_per_kw|| 0) >= cpkwMin && (d.total_per_kw|| 0) <= cpkwMax
  );

  return result;
}

// ── Client-side computations ──────────────────────────────────────────────────

function avg(arr, key) {
  const vals = arr.map(d => d[key] || 0).filter(v => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function computeSummary(data) {
  if (data.length === 0) {
    return { total_projects:0, total_mw:0, total_upgrade_cost:0, avg_total_per_kw:0,
             highest_cost_project:null, lowest_cost_project:null, eris_projects:0, nris_projects:0 };
  }
  const nzCost = data.filter(d => (d.total_cost || 0) > 0);
  const nzKw   = data.filter(d => (d.total_per_kw || 0) > 0);

  const highest = nzCost.length ? nzCost.reduce((m, d) => d.total_cost > m.total_cost ? d : m) : null;
  const lowest  = nzCost.length ? nzCost.reduce((m, d) => d.total_cost < m.total_cost ? d : m) : null;

  function projCard(p) {
    return { id: p.project_id, name: p.name || '', cost: p.total_cost, state: p.state || '', fuel: p.fuel || '' };
  }

  return {
    total_projects:       data.length,
    total_mw:             data.reduce((s, d) => s + (d.summer_mw || 0), 0),
    total_upgrade_cost:   data.reduce((s, d) => s + (d.total_cost || 0), 0),
    avg_total_per_kw:     nzKw.length ? nzKw.reduce((s, d) => s + d.total_per_kw, 0) / nzKw.length : 0,
    highest_cost_project: highest ? projCard(highest) : null,
    lowest_cost_project:  lowest  ? projCard(lowest)  : null,
    eris_projects:        data.filter(d => (d.eris_cost || 0) > 0).length,
    nris_projects:        data.filter(d => (d.nris_cost || 0) > 0).length,
  };
}

function computeTopProjects(data) {
  function top(key, n) {
    return data.filter(d => (d[key] || 0) > 0)
               .sort((a, b) => (b[key] || 0) - (a[key] || 0))
               .slice(0, n || 10);
  }
  return {
    by_total_cost: top('total_cost'),
    by_per_kw:     top('total_per_kw'),
    by_eris:       top('eris_cost'),
    by_nris:       top('nris_cost'),
  };
}

function computeInsights(data) {
  const out = [];
  if (data.length === 0) return out;

  function add(type, title, value, detail, icon, severity) {
    out.push({ type, title, value, detail, icon, severity });
  }

  const nz = data.filter(d => (d.total_cost || 0) > 0);
  if (nz.length) {
    const high = nz.reduce((m, d) => d.total_cost > m.total_cost ? d : m);
    add('highest_cost', 'Highest Total Cost', '$' + high.total_cost.toFixed(1) + 'MM',
      'Project ' + high.project_id + ' · ' + (high.state || '') + ' · ' + (high.fuel || ''), 'arrow-up-circle', 'danger');
    const low = nz.reduce((m, d) => d.total_cost < m.total_cost ? d : m);
    add('lowest_cost', 'Lowest Total Cost', '$' + low.total_cost.toFixed(2) + 'MM',
      'Project ' + low.project_id + ' · ' + (low.state || '') + ' · ' + (low.fuel || ''), 'arrow-down-circle', 'success');
  }

  const nzKw = data.filter(d => (d.total_per_kw || 0) > 0);
  if (nzKw.length) {
    const hKw = nzKw.reduce((m, d) => d.total_per_kw > m.total_per_kw ? d : m);
    add('highest_kw', 'Highest Cost per kW', '$' + hKw.total_per_kw.toLocaleString(undefined, {maximumFractionDigits:0}) + '/kW',
      'Project ' + hKw.project_id + ' · ' + (hKw.summer_mw || 0).toFixed(0) + ' MW · ' + (hKw.fuel || ''), 'lightning-charge', 'warning');
    const lKw = nzKw.reduce((m, d) => d.total_per_kw < m.total_per_kw ? d : m);
    add('lowest_kw', 'Lowest Cost per kW', '$' + lKw.total_per_kw.toLocaleString(undefined, {maximumFractionDigits:0}) + '/kW',
      'Project ' + lKw.project_id + ' · ' + (lKw.summer_mw || 0).toFixed(0) + ' MW · ' + (lKw.fuel || ''), 'lightning', 'success');
  }

  const byState = {};
  data.forEach(d => { const s = d.state || 'Unknown'; if (!byState[s]) byState[s] = []; byState[s].push(d); });
  const stateAvgs = Object.entries(byState).map(([s, arr]) => [s, avg(arr, 'total_cost')]).filter(e => e[1] > 0);
  if (stateAvgs.length) {
    const hSt = stateAvgs.reduce((m, e) => e[1] > m[1] ? e : m);
    add('state_high', 'Highest Avg Cost State', hSt[0], 'Avg $' + hSt[1].toFixed(1) + 'MM per project', 'geo-alt-fill', 'warning');
    const lSt = stateAvgs.reduce((m, e) => e[1] < m[1] ? e : m);
    add('state_low', 'Lowest Avg Cost State', lSt[0], 'Avg $' + lSt[1].toFixed(1) + 'MM per project', 'geo-alt', 'success');
  }

  const byFuel = {};
  data.forEach(d => { const f = d.fuel || 'Other'; if (!byFuel[f]) byFuel[f] = []; byFuel[f].push(d); });
  const fuelAvgs = Object.entries(byFuel).map(([f, arr]) => [f, avg(arr, 'total_cost')]).filter(e => e[1] > 0);
  if (fuelAvgs.length) {
    const hF = fuelAvgs.reduce((m, e) => e[1] > m[1] ? e : m);
    add('fuel_high', 'Most Expensive Fuel Type', hF[0], 'Avg $' + hF[1].toFixed(1) + 'MM per project', 'fuel-pump', 'info');
  }

  for (const [col, label] of [['eris_cost', 'ERIS'], ['nris_cost', 'NRIS'], ['interconnection_cost', 'Interconnection']]) {
    const maxItem = data.filter(d => (d[col] || 0) > 0).reduce((m, d) => (d[col] > (m ? m[col] : 0)) ? d : m, null);
    if (maxItem) {
      add('top_' + col, 'Largest ' + label + ' Contributor', '$' + maxItem[col].toFixed(1) + 'MM',
        'Project ' + maxItem.project_id + ' · ' + (maxItem.state || '') + ' · ' + (maxItem.fuel || ''), 'bar-chart-fill', 'info');
    }
  }

  if (nzKw.length > 4) {
    const vals = nzKw.map(d => d.total_per_kw);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std  = Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / vals.length);
    const threshold = mean + 2 * std;
    const outliers  = nzKw.filter(d => d.total_per_kw > threshold);
    if (outliers.length) {
      add('outliers', 'High-Cost Outliers (>2σ)', outliers.length + ' Projects',
        'Threshold: $' + threshold.toFixed(0) + '/kW · Mean: $' + mean.toFixed(0) + '/kW', 'exclamation-triangle-fill', 'danger');
    }
  }

  return out;
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadAllData() {
  const [projects, filters] = await Promise.all([
    fetch('/cost-data/projects.json').then(r => { if (!r.ok) throw new Error('projects.json not found'); return r.json(); }),
    fetch('/cost-data/filters.json').then(r => { if (!r.ok) throw new Error('filters.json not found'); return r.json(); }),
  ]);
  _allProjects = projects;
  _filterMeta  = filters;
}

// ── Render all ────────────────────────────────────────────────────────────────

function renderAll(data) {
  _allData = data;

  const summary     = computeSummary(data);
  const topProjects = computeTopProjects(data);
  const insights    = computeInsights(data);

  renderSummary(summary);
  renderBarChart(data);
  renderStateAnalysis(data);
  renderComposition(data);
  renderScatter(data);
  renderTopProjects(topProjects);
  renderHeatmap(data);
  renderHistogram(data);
  renderBoxPlot(data);
  renderPareto(data);
  renderDataTable(data);
  renderInsights(insights);

  const badge = document.getElementById('summary-badge');
  if (badge) badge.textContent = data.length + ' projects in view';
}

// ── Filter UI init ────────────────────────────────────────────────────────────

function initFiltersUI(meta) {
  const stateContainer = document.getElementById('filter-states');
  stateContainer.innerHTML = (meta.states || []).map(s => `
    <label class="check-item">
      <input type="checkbox" value="${escHtml(s)}">
      <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${stateColor(s)};"></span>
      ${escHtml(s)}
    </label>
  `).join('');

  const fuelContainer = document.getElementById('filter-fuels');
  fuelContainer.innerHTML = (meta.fuels || []).map(f => `
    <label class="check-item">
      <input type="checkbox" value="${escHtml(f)}">
      <span class="fuel-dot" style="background:${fuelColor(f)};"></span>
      ${escHtml(f)}
    </label>
  `).join('');

  const groupContainer = document.getElementById('filter-groups');
  groupContainer.innerHTML = (meta.study_groups || []).map(g => `
    <label class="check-item">
      <input type="checkbox" value="${escHtml(g)}">
      ${escHtml(g)}
    </label>
  `).join('');

  if (meta.mw_range)   setSliderRange('mw',   meta.mw_range[0],   meta.mw_range[1]);
  if (meta.cost_range) setSliderRange('cost', meta.cost_range[0], meta.cost_range[1]);
  if (meta.cpkw_range) setSliderRange('cpkw', meta.cpkw_range[0], meta.cpkw_range[1]);
  ['mw', 'cost', 'cpkw'].forEach(updateRangeDisplay);
}

// ── Section 1: Executive Summary ─────────────────────────────────────────────

function renderSummary(s) {
  setText('kpi-total-projects', fmt.int(s.total_projects));
  setText('kpi-total-mw',      fmt.mw(s.total_mw));
  setText('kpi-total-cost',    fmt.mm(s.total_upgrade_cost));
  setText('kpi-avg-kw',        fmt.kw(s.avg_total_per_kw));
  setText('kpi-eris',          fmt.int(s.eris_projects));
  setText('kpi-nris',          fmt.int(s.nris_projects));

  if (s.highest_cost_project) {
    setText('kpi-high-proj',     fmt.mm(s.highest_cost_project.cost));
    setText('kpi-high-proj-sub', s.highest_cost_project.id + ' · ' + (s.highest_cost_project.state || ''));
  }
  if (s.lowest_cost_project) {
    setText('kpi-low-proj',     fmt.mm(s.lowest_cost_project.cost));
    setText('kpi-low-proj-sub', s.lowest_cost_project.id + ' · ' + (s.lowest_cost_project.state || ''));
  }

  const status = document.getElementById('data-status');
  if (status) status.textContent = s.total_projects + ' Projects Loaded';
}

// ── Section 2: Stacked Bar Chart ─────────────────────────────────────────────

let _barData = [];

function renderBarChart(data) {
  _barData = data;
  drawBarChart();
}

function sortBar(mode) {
  _barSortMode = mode;
  document.querySelectorAll('.ctrl-btn').forEach(b => {
    if (['Sort by ID', '↑ Cost', '↓ Cost'].includes(b.textContent)) b.classList.remove('active');
  });
  const label = mode === 'id' ? 'Sort by ID' : mode === 'asc' ? '↑ Cost' : '↓ Cost';
  document.querySelectorAll('.ctrl-btn').forEach(b => {
    if (b.textContent === label) b.classList.add('active');
  });
  drawBarChart();
}

function filterBarChart(val) {
  _barSearch = val.toLowerCase();
  drawBarChart();
}

function drawBarChart() {
  let data = _barData.slice();
  if (_barSearch) {
    data = data.filter(d =>
      String(d.project_id || '').toLowerCase().includes(_barSearch) ||
      String(d.name || '').toLowerCase().includes(_barSearch)
    );
  }
  if (_barSortMode === 'asc')  data.sort((a, b) => (a.total_cost || 0) - (b.total_cost || 0));
  else if (_barSortMode === 'desc') data.sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));
  else data.sort((a, b) => String(a.project_id || '').localeCompare(String(b.project_id || '')));

  const ids = data.map(d => String(d.project_id));
  const customdata = data.map(d => [d.name || '', d.state || '', d.fuel || '', d.summer_mw || 0, d.total_per_kw || 0]);

  const traces = [
    { name: 'ERIS Upgrades',          type: 'bar', x: ids, y: data.map(d => d.eris_cost || 0),            marker: { color: COST_COLORS.eris },            customdata, hovertemplate: '<b>%{x}</b><br>%{customdata[0]}<br>State: %{customdata[1]} | Fuel: %{customdata[2]}<br>ERIS: <b>$%{y:.2f}MM</b><extra></extra>' },
    { name: 'NRIS Upgrades',          type: 'bar', x: ids, y: data.map(d => d.nris_cost || 0),            marker: { color: COST_COLORS.nris },            customdata, hovertemplate: '<b>%{x}</b><br>NRIS: <b>$%{y:.2f}MM</b><extra></extra>' },
    { name: 'Interconnection Facility',type: 'bar', x: ids, y: data.map(d => d.interconnection_cost || 0), marker: { color: COST_COLORS.interconnection }, customdata, hovertemplate: '<b>%{x}</b><br>Interconnection: <b>$%{y:.2f}MM</b><extra></extra>' },
  ];

  const layout = plotLayout({
    barmode: 'stack',
    xaxis: { title: 'Project ID', tickangle: -45, tickfont: { size: 9 } },
    yaxis: { title: 'Cost ($MM)' },
    margin: { t: 20, r: 16, b: 100, l: 70 },
  });

  Plotly.react('bar-chart', traces, layout, plotConfig);

  document.getElementById('bar-chart').on('plotly_click', e => {
    if (e && e.points && e.points.length > 0) openDetail(e.points[0].x);
  });
}

// ── Section 3: State Analysis ─────────────────────────────────────────────────

function renderStateAnalysis(data) {
  const byState = {};
  data.forEach(d => { const s = d.state || 'Unknown'; if (!byState[s]) byState[s] = []; byState[s].push(d); });

  const states  = Object.keys(byState).sort();
  const avgKw   = states.map(s => avg(byState[s], 'total_per_kw'));
  const avgCost = states.map(s => avg(byState[s], 'total_cost'));

  const traces = [
    { name: 'Avg $/kW', type: 'bar', x: states, y: avgKw, marker: { color: states.map(s => stateColor(s)) }, yaxis: 'y1', hovertemplate: '%{x}<br>Avg $/kW: <b>$%{y:,.0f}</b><extra></extra>' },
    { name: 'Avg Cost ($MM)', type: 'scatter', mode: 'lines+markers', x: states, y: avgCost, yaxis: 'y2', line: { color: '#EE7733', width: 2 }, marker: { size: 8 }, hovertemplate: '%{x}<br>Avg Cost: <b>$%{y:.1f}MM</b><extra></extra>' },
  ];

  Plotly.react('state-bar', traces, plotLayout({
    barmode: 'group',
    yaxis:  { title: 'Avg $/kW' },
    yaxis2: { title: 'Avg Cost ($MM)', overlaying: 'y', side: 'right' },
    margin: { t: 20, r: 60, b: 50, l: 70 },
    showlegend: true,
  }), plotConfig);

  const ranked = states
    .map(s => ({ state: s, avgKw: avg(byState[s], 'total_per_kw'), count: byState[s].length, avgCost: avg(byState[s], 'total_cost') }))
    .sort((a, b) => b.avgKw - a.avgKw);

  document.getElementById('state-rankings').innerHTML = ranked.map((r, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:8px;
                background:var(--surface2);border-radius:7px;border:1px solid var(--border);">
      <div style="font-size:1.2rem;font-weight:800;color:${stateColor(r.state)};width:30px;">${i + 1}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:.9rem;">${r.state}</div>
        <div style="font-size:.72rem;color:var(--text-muted);">${r.count} projects</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;font-size:.85rem;">${fmt.kw(r.avgKw)}</div>
        <div style="font-size:.7rem;color:var(--text-muted);">avg ${fmt.mm(r.avgCost)}</div>
      </div>
    </div>
  `).join('');
}

// ── Section 4: Composition ────────────────────────────────────────────────────

function renderComposition(data) {
  const byState = {};
  data.forEach(d => { const s = d.state || 'Unknown'; if (!byState[s]) byState[s] = []; byState[s].push(d); });
  const states = Object.keys(byState).sort();

  function stateAvgPct(s, key) {
    const total = byState[s].reduce((a, d) => a + (d.total_cost || 0), 0);
    const part  = byState[s].reduce((a, d) => a + (d[key]       || 0), 0);
    return total > 0 ? (part / total) * 100 : 0;
  }

  const traces = [
    { name: 'ERIS %',           type: 'bar', x: states, y: states.map(s => stateAvgPct(s, 'eris_cost')),            marker: { color: COST_COLORS.eris },            hovertemplate: '%{x}<br>ERIS: <b>%{y:.1f}%</b><extra></extra>' },
    { name: 'NRIS %',           type: 'bar', x: states, y: states.map(s => stateAvgPct(s, 'nris_cost')),            marker: { color: COST_COLORS.nris },            hovertemplate: '%{x}<br>NRIS: <b>%{y:.1f}%</b><extra></extra>' },
    { name: 'Interconnection %', type: 'bar', x: states, y: states.map(s => stateAvgPct(s, 'interconnection_cost')), marker: { color: COST_COLORS.interconnection }, hovertemplate: '%{x}<br>Interconnection: <b>%{y:.1f}%</b><extra></extra>' },
  ];

  Plotly.react('composition-chart', traces, plotLayout({
    barmode: 'stack',
    barnorm: 'percent',
    yaxis: { title: '% of Total Cost', ticksuffix: '%' },
    margin: { t: 20, r: 16, b: 50, l: 70 },
  }), plotConfig);
}

// ── Section 5: Scatter ────────────────────────────────────────────────────────

function renderScatter(data) {
  const fuels   = [...new Set(data.map(d => d.fuel || 'Other'))].sort();
  const maxCost = Math.max(...data.map(d => d.total_cost || 0), 1);

  const traces = fuels.map(fuel => {
    const pts = data.filter(d => (d.fuel || 'Other') === fuel && (d.summer_mw || 0) > 0 && (d.total_per_kw || 0) > 0);
    return {
      name: fuel, type: 'scatter', mode: 'markers',
      x: pts.map(d => d.summer_mw),
      y: pts.map(d => d.total_per_kw),
      text: pts.map(d => String(d.project_id)),
      customdata: pts.map(d => [d.name || '', d.state || '', d.total_cost || 0]),
      marker: {
        color: fuelColor(fuel),
        size: pts.map(d => 8 + ((d.total_cost || 0) / maxCost) * 30),
        opacity: 0.75,
        line: { color: 'rgba(0,0,0,0.2)', width: 1 },
      },
      hovertemplate: '<b>Project %{text}</b><br>%{customdata[0]}<br>State: %{customdata[1]}<br>MW: <b>%{x:,.0f}</b> | $/kW: <b>$%{y:,.0f}</b><br>Total: <b>$%{customdata[2]:.1f}MM</b><extra></extra>',
    };
  });

  const kws = data.map(d => d.total_per_kw || 0).filter(v => v > 0);
  if (kws.length > 2) {
    const mean = kws.reduce((a, b) => a + b, 0) / kws.length;
    const std  = Math.sqrt(kws.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / kws.length);
    traces.push({
      name: 'Outlier Threshold (2σ)', type: 'scatter', mode: 'lines',
      x: [0, Math.max(...data.map(d => d.summer_mw || 0)) * 1.1],
      y: [mean + 2 * std, mean + 2 * std],
      line: { dash: 'dash', color: '#EE3377', width: 1.5 },
      hoverinfo: 'skip',
    });
  }

  Plotly.react('scatter-chart', traces, plotLayout({
    xaxis: { title: 'Summer MW', type: 'log' },
    yaxis: { title: 'Total $/kW' },
    margin: { t: 20, r: 16, b: 60, l: 80 },
  }), plotConfig);

  document.getElementById('scatter-chart').on('plotly_click', e => {
    if (e && e.points && e.points[0] && e.points[0].text) openDetail(e.points[0].text);
  });
}

// ── Section 6: Top Projects ───────────────────────────────────────────────────

function renderTopProjects(top) {
  renderTopList('list-total', top.by_total_cost, 'total_cost', fmt.mm);
  renderTopList('list-kw',    top.by_per_kw,     'total_per_kw', fmt.kw);
  renderTopList('list-eris',  top.by_eris,       'eris_cost',    fmt.mm);
  renderTopList('list-nris',  top.by_nris,       'nris_cost',    fmt.mm);
}

function renderTopList(id, items, valKey, fmtFn) {
  const ul = document.getElementById(id);
  if (!ul) return;
  if (!items || items.length === 0) { ul.innerHTML = '<div class="no-data">No data</div>'; return; }
  const rankClass = i => i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
  ul.innerHTML = items.map((p, i) => `
    <li class="top-item" onclick="openDetail('${escHtml(String(p.project_id))}')">
      <div class="top-rank ${rankClass(i)}">${i + 1}</div>
      <div class="top-info">
        <div class="top-id">${escHtml(String(p.project_id))}</div>
        <div class="top-meta">${escHtml(p.state || '')} · ${escHtml(p.fuel || '')} · ${fmt.mw(p.summer_mw)}</div>
      </div>
      <div class="top-val">
        <div class="top-cost">${fmtFn(p[valKey])}</div>
        <div class="top-kw">${fmt.kw(p.total_per_kw)}</div>
      </div>
    </li>
  `).join('');
}

function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const labels = { 'top-total': 'Total Cost', 'top-kw': '$/kW', 'top-eris': 'ERIS Cost', 'top-nris': 'NRIS Cost' };
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.textContent === labels[id]) b.classList.add('active');
  });
}

// ── Section 7: Heatmap ────────────────────────────────────────────────────────

function renderHeatmap(data) {
  const states = [...new Set(data.map(d => d.state || 'Unknown'))].sort();
  const fuels  = [...new Set(data.map(d => d.fuel  || 'Other'))].sort();

  const z = states.map(s =>
    fuels.map(f => {
      const pts = data.filter(d => d.state === s && d.fuel === f && (d.total_per_kw || 0) > 0);
      return pts.length ? pts.reduce((sum, d) => sum + (d.total_per_kw || 0), 0) / pts.length : null;
    })
  );

  Plotly.react('heatmap-chart', [{
    type: 'heatmap', x: fuels, y: states, z,
    colorscale: 'RdYlGn', reversescale: true,
    colorbar: { title: '$/kW', thickness: 14 },
    hovertemplate: 'State: <b>%{y}</b><br>Fuel: <b>%{x}</b><br>Avg $/kW: <b>$%{z:,.0f}</b><extra></extra>',
    zsmooth: false,
  }], plotLayout({ margin: { t: 20, r: 80, b: 80, l: 60 }, xaxis: { tickangle: -30 } }), plotConfig);
}

// ── Section 8: Histogram & Box ────────────────────────────────────────────────

function renderHistogram(data) {
  const vals = data.map(d => d.total_per_kw || 0).filter(v => v > 0);
  if (vals.length === 0) return;

  const sorted = [...vals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean   = vals.reduce((a, b) => a + b, 0) / vals.length;
  const p90    = sorted[Math.floor(sorted.length * 0.9)];

  Plotly.react('hist-chart', [{
    type: 'histogram', x: vals, nbinsx: 30,
    marker: { color: COST_COLORS.eris, opacity: 0.75 },
    hovertemplate: '$/kW range: <b>%{x}</b><br>Count: <b>%{y}</b><extra></extra>',
    name: 'Projects',
  }], plotLayout({
    xaxis: { title: 'Total $/kW' },
    yaxis: { title: 'Number of Projects' },
    margin: { t: 20, r: 16, b: 60, l: 70 },
    shapes: [
      { type: 'line', x0: median, x1: median, y0: 0, y1: 1, yref: 'paper', line: { color: '#228833', dash: 'dash', width: 2 } },
      { type: 'line', x0: mean,   x1: mean,   y0: 0, y1: 1, yref: 'paper', line: { color: '#EE7733', dash: 'dash', width: 2 } },
      { type: 'line', x0: p90,    x1: p90,    y0: 0, y1: 1, yref: 'paper', line: { color: '#EE3377', dash: 'dot',  width: 2 } },
    ],
    annotations: [
      { x: median, y: 1,  yref: 'paper', text: 'Median $' + median.toFixed(0), showarrow: false, font: { color: '#228833', size: 10 }, xanchor: 'left' },
      { x: mean,   y: .9, yref: 'paper', text: 'Mean $'   + mean.toFixed(0),   showarrow: false, font: { color: '#EE7733', size: 10 }, xanchor: 'left' },
      { x: p90,    y: .8, yref: 'paper', text: 'P90 $'    + p90.toFixed(0),    showarrow: false, font: { color: '#EE3377', size: 10 }, xanchor: 'left' },
    ],
  }), plotConfig);
}

function renderBoxPlot(data) {
  const fuels = [...new Set(data.map(d => d.fuel || 'Other'))].sort();
  const traces = fuels.map(f => ({
    type: 'box', name: f,
    y: data.filter(d => (d.fuel || 'Other') === f).map(d => d.summer_mw || 0).filter(v => v > 0),
    marker: { color: fuelColor(f) },
    boxmean: true,
    hovertemplate: f + '<br>MW: <b>%{y:,.0f}</b><extra></extra>',
  }));

  Plotly.react('box-chart', traces, plotLayout({
    yaxis: { title: 'Summer MW' },
    margin: { t: 20, r: 16, b: 60, l: 70 },
    showlegend: false,
  }), plotConfig);
}

// ── Section 9: Pareto ─────────────────────────────────────────────────────────

function renderPareto(data) {
  const sorted = data.filter(d => (d.total_cost || 0) > 0)
    .sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));

  if (sorted.length === 0) return;

  const total = sorted.reduce((s, d) => s + (d.total_cost || 0), 0);
  let cumSum = 0;
  const cumPct = sorted.map(d => { cumSum += d.total_cost || 0; return (cumSum / total) * 100; });
  const ids = sorted.map(d => String(d.project_id));

  Plotly.react('pareto-chart', [
    { type: 'bar', x: ids, y: sorted.map(d => d.total_cost), name: 'Total Cost ($MM)', marker: { color: sorted.map(d => stateColor(d.state || '')) }, hovertemplate: '<b>%{x}</b><br>Total: <b>$%{y:.2f}MM</b><extra></extra>' },
    { type: 'scatter', mode: 'lines', x: ids, y: cumPct, name: 'Cumulative %', yaxis: 'y2', line: { color: '#EE3377', width: 2 }, hovertemplate: '<b>%{x}</b><br>Cumulative: <b>%{y:.1f}%</b><extra></extra>' },
  ], plotLayout({
    xaxis:  { title: 'Project (sorted by cost)', tickangle: -60, tickfont: { size: 8 } },
    yaxis:  { title: 'Total Cost ($MM)' },
    yaxis2: { title: 'Cumulative %', overlaying: 'y', side: 'right', range: [0, 100], ticksuffix: '%' },
    margin: { t: 20, r: 70, b: 100, l: 70 },
    shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 80, y1: 80, yref: 'y2', line: { dash: 'dot', color: '#888', width: 1 } }],
  }), plotConfig);

  document.getElementById('pareto-chart').on('plotly_click', e => {
    if (e && e.points && e.points[0]) openDetail(e.points[0].x);
  });
}

// ── Section 10: DataTable ─────────────────────────────────────────────────────

function renderDataTable(data) {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  if (_dt) { _dt.clear(); _dt.destroy(); _dt = null; }

  tbody.innerHTML = data.map(d => `
    <tr onclick="openDetail('${escHtml(String(d.project_id))}')">
      <td>${escHtml(String(d.project_id))}</td>
      <td>${escHtml(d.name || '')}</td>
      <td>${escHtml(d.state || '')}</td>
      <td>${escHtml(d.fuel || '')}</td>
      <td>${escHtml(d.study_group || '')}</td>
      <td>${fmtCell(d.summer_mw, 1)}</td>
      <td>${fmtCell(d.winter_mw, 1)}</td>
      <td>${fmtCell(d.eris_cost, 2)}</td>
      <td>${fmtCell(d.nris_cost, 2)}</td>
      <td>${fmtCell(d.interconnection_cost, 2)}</td>
      <td>${fmtCell(d.total_cost, 2)}</td>
      <td>${d.total_per_kw ? '$' + Number(d.total_per_kw).toLocaleString(undefined, {maximumFractionDigits:0}) : '—'}</td>
      <td>${d.overall_rank || '—'}</td>
    </tr>
  `).join('');

  _dt = $('#projects-table').DataTable({
    pageLength: 25,
    order: [[10, 'desc']],
    dom: 'lfrtip',
    columnDefs: [{ targets: [5, 6, 7, 8, 9, 10, 12], className: 'dt-right' }],
  });
}

function fmtCell(v, d) {
  if (v == null || v === 0) return '—';
  return Number(v).toFixed(d || 1);
}

// ── Section 11: Insights ──────────────────────────────────────────────────────

const INSIGHT_ICONS = {
  'arrow-up-circle':           `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 0 0 8a8 8 0 0 0 16 0zm-7.5 3.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707V11.5z"/></svg>`,
  'arrow-down-circle':         `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 0 0 8a8 8 0 0 0 16 0zM8.5 4.5a.5.5 0 0 0-1 0v5.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V4.5z"/></svg>`,
  'lightning-charge':          `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09z"/></svg>`,
  'lightning':                 `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .368.837L9.164 2H11a.5.5 0 0 1 .354.854l-5 5a.5.5 0 0 1-.761-.638l1.328-2.658H5.5a.5.5 0 0 1-.42-.763L5.52.36z"/></svg>`,
  'geo-alt-fill':              `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>`,
  'geo-alt':                   `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A31.493 31.493 0 0 1 8 14.58a31.481 31.481 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94zM8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10z"/><path d="M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`,
  'fuel-pump':                 `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M3 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-5z"/><path d="M1 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1 2 2v.5a.5.5 0 0 0 1 0V8h-.5a.5.5 0 0 1-.5-.5V4.375a.5.5 0 0 1 .5-.5h1.495c-.011-.476-.053-.894-.201-1.222a.97.97 0 0 0-.394-.458c-.184-.11-.464-.195-.9-.195a.5.5 0 0 1 0-1c.564 0 1.034.11 1.412.336.383.228.633.551.756.919.244.716.243 1.68.243 2.43v5.544c0 .533-.555 1.275-1.27 1.275-.714 0-1.23-.742-1.23-1.275V12a1 1 0 0 0-1-1v2h.5a.5.5 0 0 1 0 1H1.5a.5.5 0 0 1 0-1H2V2zm9 0a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v13h8V2z"/></svg>`,
  'bar-chart-fill':            `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2z"/></svg>`,
  'exclamation-triangle-fill': `<svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>`,
};

function renderInsights(insights) {
  const grid = document.getElementById('insights-grid');
  if (!grid) return;
  if (!insights || insights.length === 0) { grid.innerHTML = '<div class="no-data">No insights available</div>'; return; }
  grid.innerHTML = insights.map(ins => `
    <div class="insight-card">
      <div class="insight-icon ${ins.severity}">${INSIGHT_ICONS[ins.icon] || '●'}</div>
      <div class="insight-body">
        <div class="insight-title">${escHtml(ins.title)}</div>
        <div class="insight-value">${escHtml(ins.value)}</div>
        <div class="insight-detail">${escHtml(ins.detail)}</div>
      </div>
    </div>
  `).join('');
}

// ── Project Detail Panel ──────────────────────────────────────────────────────

function openDetail(projectId) {
  const p = _allProjects.find(d => String(d.project_id) === String(projectId));
  if (!p) return;

  const stateRows   = _allProjects.filter(d => d.state === p.state);
  const stateNzKw   = stateRows.filter(d => (d.total_per_kw || 0) > 0);
  const allNzKw     = _allProjects.filter(d => (d.total_per_kw || 0) > 0);
  const stateAvgKw  = stateNzKw.length ? stateNzKw.reduce((s, d) => s + d.total_per_kw, 0) / stateNzKw.length : 0;
  const overallAvgKw= allNzKw.length   ? allNzKw.reduce((s, d) => s + d.total_per_kw, 0)   / allNzKw.length   : 0;

  document.getElementById('detail-title').textContent = 'Project ' + (p.project_id || '');
  const body = document.getElementById('detail-body');

  body.innerHTML = `
    <div class="detail-meta-grid">
      <div class="meta-item"><div class="meta-lbl">Project ID</div><div class="meta-val">${escHtml(String(p.project_id || ''))}</div></div>
      <div class="meta-item"><div class="meta-lbl">State</div><div class="meta-val" style="color:${stateColor(p.state)}">${escHtml(p.state || '—')}</div></div>
      <div class="meta-item"><div class="meta-lbl">Fuel</div><div class="meta-val">${escHtml(p.fuel || '—')}</div></div>
      <div class="meta-item"><div class="meta-lbl">Study Group</div><div class="meta-val">${escHtml(p.study_group || '—')}</div></div>
      <div class="meta-item"><div class="meta-lbl">Summer MW</div><div class="meta-val">${fmt.mw(p.summer_mw)}</div></div>
      <div class="meta-item"><div class="meta-lbl">Winter MW</div><div class="meta-val">${fmt.mw(p.winter_mw)}</div></div>
      <div class="meta-item" style="grid-column:1/-1"><div class="meta-lbl">Project Name</div><div class="meta-val" style="font-size:.82rem;">${escHtml(p.name || '—')}</div></div>
    </div>

    <div id="detail-pie" style="height:220px;margin-bottom:8px;"></div>
    <div id="detail-bar" style="height:200px;margin-bottom:16px;"></div>

    <table class="detail-fin-table">
      <thead><tr><th>Component</th><th>Cost ($MM)</th><th>$/kW</th><th>% of Total</th></tr></thead>
      <tbody>
        <tr>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COST_COLORS.eris};margin-right:6px;"></span>ERIS Upgrades</td>
          <td>${fmt.mm(p.eris_cost)}</td><td>${fmt.kw(p.eris_per_kw)}</td><td>${fmt.pct(p.eris_pct)}</td>
        </tr>
        <tr>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COST_COLORS.nris};margin-right:6px;"></span>NRIS Upgrades</td>
          <td>${fmt.mm(p.nris_cost)}</td><td>${fmt.kw(p.nris_per_kw)}</td><td>${fmt.pct(p.nris_pct)}</td>
        </tr>
        <tr>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COST_COLORS.interconnection};margin-right:6px;"></span>Interconnection</td>
          <td>${fmt.mm(p.interconnection_cost)}</td><td>${fmt.kw(p.interconnection_per_kw)}</td><td>${fmt.pct(p.interconnection_pct)}</td>
        </tr>
        <tr><td><b>Total</b></td><td><b>${fmt.mm(p.total_cost)}</b></td><td><b>${fmt.kw(p.total_per_kw)}</b></td><td><b>100%</b></td></tr>
      </tbody>
    </table>
  `;

  Plotly.newPlot('detail-pie', [{
    type: 'pie',
    labels: ['ERIS', 'NRIS', 'Interconnection'],
    values: [p.eris_cost || 0, p.nris_cost || 0, p.interconnection_cost || 0],
    marker: { colors: [COST_COLORS.eris, COST_COLORS.nris, COST_COLORS.interconnection] },
    hole: 0.45, textinfo: 'label+percent',
    hovertemplate: '<b>%{label}</b><br>$%{value:.2f}MM<br>%{percent}<extra></extra>',
  }], plotLayout({ margin: { t: 10, r: 10, b: 10, l: 10 }, showlegend: false }), { ...plotConfig, staticPlot: false });

  Plotly.newPlot('detail-bar', [{
    type: 'bar',
    x: ['This Project', (p.state || 'State') + ' Avg', 'Overall Avg'],
    y: [p.total_per_kw || 0, stateAvgKw, overallAvgKw],
    marker: { color: ['#429644', stateColor(p.state), '#888888'] },
    hovertemplate: '<b>%{x}</b><br>$/kW: <b>$%{y:,.0f}</b><extra></extra>',
  }], plotLayout({ yaxis: { title: '$/kW' }, margin: { t: 10, r: 10, b: 50, l: 65 } }), { ...plotConfig, staticPlot: false });

  document.getElementById('detail-panel').classList.add('open');
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportCSV() {
  const data = _allData.length ? _allData : _allProjects;
  const headers = ['project_id', 'name', 'state', 'fuel', 'study_group', 'summer_mw', 'winter_mw',
                   'eris_cost', 'nris_cost', 'interconnection_cost', 'total_cost', 'total_per_kw', 'overall_rank'];
  const rows = [
    headers.join(','),
    ...data.map(d => headers.map(h => {
      const v = d[h] == null ? '' : String(d[h]);
      return v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(','))
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'projects_export.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Chart download ────────────────────────────────────────────────────────────

function downloadChart(divId, filename) {
  Plotly.downloadImage(document.getElementById(divId), { format: 'png', width: 1400, height: 700, filename: filename || divId });
}

function downloadDashboard() {
  showToast('Dashboard snapshot: use browser Print → Save as PDF for a full-page snapshot.', 'info');
  setTimeout(() => window.print(), 600);
}

// ── Refresh all charts (theme change) ────────────────────────────────────────

function refreshAllCharts() {
  if (_allData.length === 0) return;
  drawBarChart();
  renderStateAnalysis(_allData);
  renderComposition(_allData);
  renderScatter(_allData);
  renderHeatmap(_allData);
  renderHistogram(_allData);
  renderBoxPlot(_allData);
  renderPareto(_allData);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  try {
    await loadAllData();
    initFiltersUI(_filterMeta);
    renderAll(_allProjects);
  } catch (e) {
    showToast('Error loading data: ' + e.message, 'error');
    console.error(e);
  } finally {
    hideLoading();
  }

  document.addEventListener('click', e => {
    const panel = document.getElementById('detail-panel');
    if (panel.classList.contains('open') && !panel.contains(e.target)) {
      const isClickable = e.target.closest('[onclick*="openDetail"], .top-item, #scatter-chart, #bar-chart, #pareto-chart, table tr');
      if (!isClickable) closeDetail();
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
});
