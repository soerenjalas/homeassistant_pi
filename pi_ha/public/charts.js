import uPlot from "./vendor/uplot.js";

const PALETTE = ["#146f87", "#d8803a", "#5b8c5a", "#a0526d", "#7a6fd0", "#b8860b", "#4d7ea8", "#8a8a8a"];
const MAX_SERIES = 8, MAX_POINTS = 4000, MAX_TEXT = 120;

function fail(message) { throw new Error(message); }
function text(value, max = MAX_TEXT) {
  return typeof value === "string" && value.length <= max ? value : "";
}
function validate(spec) {
  if (!spec || spec.version !== 1 || !["line", "scatter", "bar"].includes(spec.kind)) fail("Ungültige Chart-Daten");
  if (!Array.isArray(spec.series) || spec.series.length < 1 || spec.series.length > MAX_SERIES) fail("1–8 Serien erwartet");
  const series = [];
  let total = 0;
  for (const entry of spec.series) {
    if (!entry || !Array.isArray(entry.points) || entry.points.length < 1) fail("Serie ohne Punkte");
    total += entry.points.length;
    if (total > MAX_POINTS) fail("Zu viele Datenpunkte");
    const points = [];
    for (const point of entry.points) {
      if (!Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || (point[1] !== null && !Number.isFinite(point[1]))) fail("Punkt ist nicht numerisch");
      points.push(point);
    }
    series.push({ name: text(entry.name, 80) || `Serie ${series.length + 1}`, points });
  }
  return { kind: spec.kind, title: text(spec.title), xLabel: text(spec.xLabel), yLabel: text(spec.yLabel), xType: ["number", "time", "category"].includes(spec.xType) ? spec.xType : "number", labels: Array.isArray(spec.labels) ? spec.labels.slice(0, MAX_POINTS).map((label) => String(label).slice(0, 40)) : null, series };
}

export function renderChart(container, rawJson) {
  container.classList.add("chart");
  let spec;
  try { spec = validate(JSON.parse(rawJson)); }
  catch (error) {
    const note = document.createElement("p"); note.className = "chart-error"; note.textContent = `Chart kann nicht angezeigt werden: ${error.message}`;
    container.append(note); return;
  }
  const xs = [...new Set(spec.series.flatMap((entry) => entry.points.map(([x]) => x)))].sort((a, b) => a - b);
  const isTime = spec.xType === "time";
  const data = [isTime ? xs.map((x) => x / 1000) : xs, ...spec.series.map((entry) => {
    const values = new Map(entry.points);
    // uPlot joins across undefined (another series sampled) but breaks at explicit nulls.
    return xs.map((x) => values.get(x));
  })];
  const isCategory = spec.xType === "category" && spec.labels;
  const css = getComputedStyle(document.documentElement);
  const axisColor = css.getPropertyValue("--muted").trim() || "#627184";
  const lineColor = css.getPropertyValue("--line").trim() || "#dde4ec";
  const size = () => {
    const style = getComputedStyle(container);
    const width = Math.max(1, Math.floor(container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    return { width, height: width < 480 ? 240 : 300 };
  };
  const options = {
    ...size(),
    title: spec.title || undefined,
    padding: [8, 8, 0, 0],
    cursor: { show: true },
    scales: { x: { time: isTime }, y: {} },
    axes: [
      {
        stroke: axisColor, grid: { show: false }, ticks: { stroke: lineColor }, space: 88,
        label: spec.xLabel || undefined,
        values: isCategory ? (_self, values) => values.map((value) => spec.labels[value] ?? "") : undefined,
      },
      { stroke: axisColor, grid: { stroke: lineColor, width: 1 }, ticks: { stroke: lineColor }, label: spec.yLabel || undefined, values: (self, values) => values.map((value) => Number(value).toLocaleString("de-DE")) },
    ],
    series: [
      { label: spec.xLabel || "x", value: isTime ? (self, value) => value == null ? "" : new Date(value * 1000).toLocaleString("de-DE") : (self, value) => value == null ? "" : Number(value).toLocaleString("de-DE") },
      ...spec.series.map((entry, index) => {
        const color = PALETTE[index % PALETTE.length];
        if (spec.kind === "bar") return { label: entry.name, stroke: color, fill: color + "55", paths: uPlot.paths.bars({ size: [0.6] }) };
        if (spec.kind === "scatter") return { label: entry.name, stroke: color, width: 0, points: { show: true, size: 6, stroke: color, fill: css.getPropertyValue("--card").trim() || "#fff" } };
        return { label: entry.name, stroke: color, width: 2.5, points: { show: entry.points.filter(([, y]) => y !== null).length < 3, size: 6 } };
      }),
    ],
    legend: { show: true },
  };
  if (isCategory) options.scales.x = { time: false };
  const plot = new uPlot(options, data, container);
  const ro = new ResizeObserver(() => {
    const next = size();
    if (next.width && next.width !== plot.width) plot.setSize(next);
  });
  ro.observe(container);
  container._plotCleanup = () => { ro.disconnect(); plot.destroy(); };
}
