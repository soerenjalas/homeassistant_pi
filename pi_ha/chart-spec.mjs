// Shared chart validation/formatting. Used by the make_chart codemode tool; no subprocess or network involved.
const MAX_SERIES = 8, MAX_POINTS = 2000, MAX_TITLE = 120, MAX_NAME = 80;
const KINDS = new Set(["line", "scatter", "bar"]);

function fail(message) { return { error: message }; }
function ok(spec) { return { spec }; }
function cleanString(value, max, label) {
  if (typeof value !== "string") return fail(`${label} must be a string`);
  const text = value.trim();
  if (!text) return fail(`${label} must not be empty`);
  if (text.length > max) return fail(`${label} is longer than ${max} characters`);
  return text;
}
function pointX(value) {
  if (typeof value === "number" && Number.isFinite(value)) return { x: value, numeric: true };
  if (typeof value === "string") {
    if (/^-?\d+(\.\d+)?$/.test(value)) return { x: Number(value), numeric: true };
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return { x: ms, numeric: true };
    return { x: value, numeric: false };
  }
  return null;
}
export function validateChart(args) {
  if (!args || typeof args !== "object") return fail("arguments must be an object");
  if (!KINDS.has(args.kind)) return fail(`kind must be one of: ${[...KINDS].join(", ")}`);
  const title = args.title === undefined ? "" : cleanString(args.title, MAX_TITLE, "title");
  const xLabel = args.xLabel === undefined ? "" : cleanString(args.xLabel, MAX_TITLE, "xLabel");
  const yLabel = args.yLabel === undefined ? "" : cleanString(args.yLabel, MAX_TITLE, "yLabel");
  for (const value of [title, xLabel, yLabel]) if (value && value.error) return value;
  if (!Array.isArray(args.series) || args.series.length < 1 || args.series.length > MAX_SERIES) {
    return fail(`series must contain 1–${MAX_SERIES} entries`);
  }
  let allNumeric = true, allTime = true, labels = null;
  const series = [];
  const categoryIndex = new Map();
  for (const [index, entry] of args.series.entries()) {
    if (!entry || typeof entry !== "object") return fail(`series[${index}] must be an object`);
    const name = cleanString(entry.name ?? `Serie ${index + 1}`, MAX_NAME, `series[${index}].name`);
    if (name && name.error) return name;
    if (!Array.isArray(entry.points) || entry.points.length < 1 || entry.points.length > MAX_POINTS) {
      return fail(`series[${index}] must contain 1–${MAX_POINTS} points`);
    }
    const points = [];
    for (const point of entry.points) {
      if (!Array.isArray(point) || point.length !== 2) return fail(`series[${index}] points must be [x, y] pairs`);
      const parsedX = pointX(point[0]);
      const y = point[1];
      if (!parsedX || (y !== null && !Number.isFinite(y))) return fail(`series[${index}] has an invalid point`);
      if (!parsedX.numeric) {
        allNumeric = false;
        if (!categoryIndex.has(parsedX.x)) categoryIndex.set(parsedX.x, categoryIndex.size);
        points.push([categoryIndex.get(parsedX.x), y]);
      } else {
        if (!(parsedX.x > 1e11)) allTime = false;
        points.push([parsedX.x, y]);
      }
    }
    series.push({ name, points });
  }
  let xType = "number";
  if (!allNumeric) {
    labels = [...categoryIndex.keys()];
    if (labels.length > MAX_POINTS) return fail("too many distinct category labels");
    xType = labels.length <= 1 ? "number" : "category";
  } else if (allTime) xType = "time";
  return ok({ version: 1, kind: args.kind, title: typeof title === "string" ? title : "", xLabel: typeof xLabel === "string" ? xLabel : "", yLabel: typeof yLabel === "string" ? yLabel : "", xType, labels, series });
}


export function chartBlock(spec) {
  return "```chart\n" + JSON.stringify(spec) + "\n```";
}
export const chartToolSchema = {
  type: "object",
  required: ["kind", "series"],
  properties: {
    kind: { type: "string", enum: ["line", "scatter", "bar"] },
    title: { type: "string" },
    xLabel: { type: "string" },
    yLabel: { type: "string" },
    series: {
      type: "array", minItems: 1, maxItems: MAX_SERIES,
      items: {
        type: "object", required: ["points"],
        properties: {
          name: { type: "string" },
          points: { type: "array", minItems: 1, maxItems: MAX_POINTS, items: { type: "array", items: [{}, { type: ["number", "null"] }], minItems: 2, maxItems: 2 } },
        },
      },
    },
  },
};
