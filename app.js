import { METRIC_DEFINITIONS } from "./metrics.mjs";

const CONFIG = {
  HISTORY_URL: "./data/history.json",
  LATEST_URL: "./data/latest.json",
};

const state = {
  history: null,
  latest: null,
  activeRange: "30d",
  charts: new Map(),
};

const $ = (selector) => document.querySelector(selector);

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(0)}%`;
}

function formatDelta(delta, percent) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const absDelta = formatNumber(Math.abs(delta));
  const pct = formatPercent(percent);
  return pct ? `${sign}${absDelta} (${pct})` : `${sign}${absDelta}`;
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function setStatus(kind, message) {
  const colorClasses = {
    idle: "text-white/50",
    ok: "text-emerald-300/80",
    warn: "text-amber-300/80",
    error: "text-rose-300/80",
  };

  const el = $("#dataStatus");
  el.className = `mt-4 text-xs ${colorClasses[kind] || colorClasses.idle}`;
  el.textContent = message;
}

function getSnapshots() {
  const snapshots = Array.isArray(state.history?.snapshots) ? state.history.snapshots.slice() : [];
  snapshots.sort((left, right) => left.date.localeCompare(right.date));
  return snapshots;
}

function resolveRange(rangeKey, snapshots) {
  if (!snapshots.length) {
    return {
      rangeKey,
      label: "No stored history yet",
      start: null,
      end: null,
      snapshots: [],
    };
  }

  const end = new Date(snapshots[snapshots.length - 1].date);
  let start = new Date(end);
  let label = "";

  if (rangeKey === "7d") {
    start.setDate(start.getDate() - 6);
    label = "Last 7 days";
  } else if (rangeKey === "30d") {
    start.setDate(start.getDate() - 29);
    label = "Last 30 days";
  } else if (rangeKey === "90d") {
    start.setDate(start.getDate() - 89);
    label = "Last 90 days";
  } else if (rangeKey === "ytd") {
    start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
    label = "Year to date";
  } else if (rangeKey === "custom") {
    const customStart = $("#customStart").value;
    const customEnd = $("#customEnd").value;
    const parsedStart = customStart ? new Date(customStart) : new Date(snapshots[0].date);
    const parsedEnd = customEnd ? new Date(customEnd) : new Date(snapshots[snapshots.length - 1].date);

    start = Number.isNaN(parsedStart.getTime()) ? new Date(snapshots[0].date) : parsedStart;
    const finalEnd = Number.isNaN(parsedEnd.getTime()) ? new Date(snapshots[snapshots.length - 1].date) : parsedEnd;
    label = `${formatShortDate(start)} → ${formatShortDate(finalEnd)}`;

    const filtered = snapshots.filter((snapshot) => {
      const date = new Date(snapshot.date);
      return date >= start && date <= finalEnd;
    });

    return {
      rangeKey,
      label,
      start,
      end: finalEnd,
      snapshots: filtered,
    };
  } else {
    start = new Date(snapshots[0].date);
    label = "All time";
  }

  const filtered = snapshots.filter((snapshot) => {
    const date = new Date(snapshot.date);
    return date >= start && date <= end;
  });

  return {
    rangeKey,
    label,
    start,
    end,
    snapshots: filtered,
  };
}

function getSeries(metricKey, snapshots) {
  return snapshots
    .map((snapshot) => {
      const value = snapshot.metrics?.[metricKey];
      return {
        date: snapshot.date,
        value: typeof value === "number" ? value : null,
      };
    })
    .filter((point) => point.value !== null);
}

function getMetricSummary(metric, snapshots) {
  const series = getSeries(metric.key, snapshots);
  if (!series.length) {
    return {
      current: null,
      baseline: null,
      delta: null,
      percent: null,
      points: series,
      trend: "flat",
    };
  }

  const baseline = series[0].value;
  const current = series[series.length - 1].value;
  const delta = current - baseline;
  const percent = baseline > 0 ? (delta / baseline) * 100 : null;
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return { current, baseline, delta, percent, points: series, trend };
}

function getTrendClasses(trend) {
  if (trend === "up") {
    return {
      border: "border-emerald-400/25",
      badge: "bg-emerald-500/15 text-emerald-200",
    };
  }

  if (trend === "down") {
    return {
      border: "border-rose-400/25",
      badge: "bg-rose-500/15 text-rose-200",
    };
  }

  return {
    border: "border-white/10",
    badge: "bg-white/10 text-white/70",
  };
}

function renderSummaryPills(filteredRange, allSnapshots) {
  const latest = state.latest;
  const coverageStart = allSnapshots[0]?.date ? formatShortDate(allSnapshots[0].date) : "—";
  const coverageEnd = allSnapshots[allSnapshots.length - 1]?.date ? formatShortDate(allSnapshots[allSnapshots.length - 1].date) : "—";
  const topCities = latest?.topCities?.length ? latest.topCities.join(", ") : "Waiting for city data";

  $("#summaryPills").innerHTML = `
    <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div class="text-[11px] uppercase tracking-[0.22em] text-white/45">Last Sync</div>
      <div class="mt-1 text-sm font-medium text-white/90">${formatDateTime(state.history?.updatedAt)}</div>
    </div>
    <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div class="text-[11px] uppercase tracking-[0.22em] text-white/45">Coverage</div>
      <div class="mt-1 text-sm font-medium text-white/90">${coverageStart} → ${coverageEnd}</div>
    </div>
    <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div class="text-[11px] uppercase tracking-[0.22em] text-white/45">Spotify Top Cities</div>
      <div class="mt-1 text-sm font-medium text-white/90">${topCities}</div>
    </div>
  `;

  $("#rangeSummary").textContent = `${filteredRange.label} • ${filteredRange.snapshots.length || 0} snapshot${filteredRange.snapshots.length === 1 ? "" : "s"}`;
  $("#chartSummary").textContent = `Comparing ${METRIC_DEFINITIONS.length} tracked metrics`;
}

function renderMetricCards(filteredRange) {
  const grid = $("#metricsGrid");
  grid.innerHTML = "";

  for (const metric of METRIC_DEFINITIONS) {
    const summary = getMetricSummary(metric, filteredRange.snapshots);
    const trendClasses = getTrendClasses(summary.trend);
    const card = document.createElement(metric.href ? "a" : "div");

    if (metric.href) {
      card.href = metric.href;
      card.target = "_blank";
      card.rel = "noreferrer";
    }

    card.className = `group rounded-3xl border ${trendClasses.border} bg-white/5 p-5 shadow-glow transition hover:bg-white/[0.065]`;
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="text-[11px] uppercase tracking-[0.24em] text-white/45">${metric.category}</div>
          <h3 class="mt-2 text-lg font-semibold tracking-tight text-white">${metric.title}</h3>
          <div class="mt-1 text-sm text-white/55">${metric.label}</div>
        </div>
        <span class="rounded-full px-3 py-1 text-xs font-medium ${trendClasses.badge}">
          ${summary.trend === "up" ? "Growing" : summary.trend === "down" ? "Shrinking" : "Flat"}
        </span>
      </div>

      <div class="mt-7 flex items-end justify-between gap-4">
        <div>
          <div class="text-4xl font-semibold tracking-tight text-white">${formatNumber(summary.current)}</div>
          <div class="mt-2 text-sm ${summary.trend === "up" ? "text-emerald-200" : summary.trend === "down" ? "text-rose-200" : "text-white/65"}">
            ${formatDelta(summary.delta, summary.percent)}
          </div>
        </div>
        <div class="text-right text-xs text-white/45">
          <div>Baseline</div>
          <div class="mt-1 text-sm text-white/75">${formatNumber(summary.baseline)}</div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  }
}

function destroyCharts() {
  for (const chart of state.charts.values()) {
    chart.destroy();
  }
  state.charts.clear();
}

function renderCharts(filteredRange) {
  const grid = $("#chartsGrid");
  destroyCharts();
  grid.innerHTML = "";

  for (const metric of METRIC_DEFINITIONS) {
    const points = getSeries(metric.key, filteredRange.snapshots);
    const summary = getMetricSummary(metric, filteredRange.snapshots);

    const card = document.createElement("div");
    card.className = "rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glow";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold tracking-tight text-white">${metric.title}</h3>
          <div class="mt-1 text-sm text-white/55">${metric.label}</div>
        </div>
        <div class="text-right">
          <div class="text-sm text-white/80">${formatNumber(summary.current)}</div>
          <div class="mt-1 text-xs ${summary.trend === "up" ? "text-emerald-200" : summary.trend === "down" ? "text-rose-200" : "text-white/50"}">${formatDelta(summary.delta, summary.percent)}</div>
        </div>
      </div>
      <div class="chart-wrap mt-4">
        <canvas id="chart-${metric.key}"></canvas>
      </div>
    `;
    grid.appendChild(card);

    const ctx = card.querySelector("canvas");
    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: points.map((point) => formatShortDate(point.date)),
        datasets: [
          {
            label: metric.title,
            data: points.map((point) => point.value),
            borderColor: metric.color,
            backgroundColor: `${metric.color}33`,
            fill: true,
            tension: 0.35,
            pointRadius: points.length > 1 ? 2 : 4,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              label(context) {
                return `${metric.title}: ${formatNumber(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "rgba(255,255,255,0.55)", maxRotation: 0, autoSkip: true },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: "rgba(255,255,255,0.55)",
              callback(value) {
                return formatNumber(value);
              },
            },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
        },
      },
    });

    state.charts.set(metric.key, chart);
  }
}

function updateRangeControls() {
  const buttons = document.querySelectorAll(".range-button");
  for (const button of buttons) {
    const active = button.dataset.range === state.activeRange;
    button.className = active
      ? "range-button rounded-full border border-alyris-teal/60 bg-alyris-teal text-alyris-night px-4 py-2 text-sm font-semibold"
      : "range-button rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm text-white/80 transition hover:bg-white/5";
  }

  $("#customRangeInputs").classList.toggle("hidden", state.activeRange !== "custom");
}

function render() {
  const snapshots = getSnapshots();
  const filteredRange = resolveRange(state.activeRange, snapshots);

  renderSummaryPills(filteredRange, snapshots);
  renderMetricCards(filteredRange);
  renderCharts(filteredRange);
  updateRangeControls();

  if (!snapshots.length) {
    setStatus("warn", "No analytics history has been stored yet. Run the sync script or workflow to create the first snapshot.");
    return;
  }

  const latestSnapshot = snapshots[snapshots.length - 1];
  setStatus(
    "ok",
    `Showing ${filteredRange.label.toLowerCase()} using repository snapshots through ${formatShortDate(latestSnapshot.date)}.`
  );
}

async function loadData() {
  setStatus("idle", "Loading analytics history…");

  try {
    const [historyResponse, latestResponse] = await Promise.all([
      fetch(CONFIG.HISTORY_URL, { cache: "no-store" }),
      fetch(CONFIG.LATEST_URL, { cache: "no-store" }),
    ]);

    if (!historyResponse.ok) throw new Error(`History HTTP ${historyResponse.status}`);
    if (!latestResponse.ok) throw new Error(`Latest HTTP ${latestResponse.status}`);

    state.history = await historyResponse.json();
    state.latest = await latestResponse.json();

    const snapshots = getSnapshots();
    if (snapshots.length) {
      $("#customStart").value = snapshots[0].date;
      $("#customEnd").value = snapshots[snapshots.length - 1].date;
    }

    render();
  } catch (error) {
    console.error(error);
    setStatus("error", "Could not load repository analytics history. Make sure data/history.json exists and is being served.");
  }
}

function wireEvents() {
  document.querySelectorAll(".range-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeRange = button.dataset.range;
      render();
    });
  });

  $("#applyCustomRange").addEventListener("click", () => {
    state.activeRange = "custom";
    render();
  });
}

function init() {
  wireEvents();
  loadData();
}

document.addEventListener("DOMContentLoaded", init);
