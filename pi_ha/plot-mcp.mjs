#!/usr/bin/env node
// Local stdio MCP server that turns validated series data into a chart JSON block.
// It has no network, filesystem, or shell access. stdout is protocol-only.
const MAX_SERIES = 8, MAX_POINTS = 2000, MAX_TITLE = 120, MAX_NAME = 80;
const KINDS = new Set(["line", "scatter", "bar"]);

function fail(message) { return { isError: true, content: [{ type: "text", text: message }] }; }
function ok(spec) {
  const json = JSON.stringify(spec);
  return { content: [{ type: "text", text: "```chart\n" + json + "\n```" }], structuredContent: { chart: spec } };
}
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
function validate(args) {
  if (!args || typeof args !== "object") return fail("arguments must be an object");
  if (!KINDS.has(args.kind)) return fail(`kind must be one of: ${[...KINDS].join(", ")}`);
  const title = args.title === undefined ? "" : cleanString(args.title, MAX_TITLE, "title");
  const xLabel = args.xLabel === undefined ? "" : cleanString(args.xLabel, MAX_TITLE, "xLabel");
  const yLabel = args.yLabel === undefined ? "" : cleanString(args.yLabel, MAX_TITLE, "yLabel");
  if (title && xLabel && yLabel && title.isError) return fail("title validation failed");
  if (!Array.isArray(args.series) || args.series.length < 1 || args.series.length > MAX_SERIES) {
    return fail(`series must contain 1–${MAX_SERIES} entries`);
  }
  let allNumeric = true, allTime = true, labels = null;
  const series = [];
  const categoryIndex = new Map();
  for (const [index, entry] of args.series.entries()) {
    if (!entry || typeof entry !== "object") return fail(`series[${index}] must be an object`);
    const name = cleanString(entry.name ?? `Serie ${index + 1}`, MAX_NAME, `series[${index}].name`);
    if (name.isError) return name;
    if (!Array.isArray(entry.points) || entry.points.length < 1 || entry.points.length > MAX_POINTS) {
      return fail(`series[${index}] must contain 1–${MAX_POINTS} points`);
    }
    const points = [];
    for (const point of entry.points) {
      if (!Array.isArray(point) || point.length !== 2) return fail(`series[${index}] points must be [x, y] pairs`);
      const parsedX = pointX(point[0]);
      const y = typeof point[1] === "number" && Number.isFinite(point[1]) ? point[1] : null;
      if (!parsedX || y === null) return fail(`series[${index}] has a non-numeric point`);
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

const tools = [{
  name: "chart",
  description: "Create a validated line, scatter, or bar chart. Returns a ```chart JSON block to include verbatim in the assistant answer.",
  inputSchema: {
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
            points: { type: "array", minItems: 1, maxItems: MAX_POINTS, items: { type: "array", items: [{}, { type: "number" }], minItems: 2, maxItems: 2 } },
          },
        },
      },
    },
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}];

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try { message = JSON.parse(line); } catch { continue; }
    if (!message || typeof message !== "object" || message.id === undefined) continue;
    let result;
    if (message.method === "initialize") result = { protocolVersion: message.params?.protocolVersion ?? "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "pi-charts", version: "1.0.0" } };
    else if (message.method === "ping") result = {};
    else if (message.method === "tools/list") result = { tools };
    else if (message.method === "tools/call") result = message.params?.name === "chart" ? validate(message.params.arguments) : fail("Unknown tool");
    else { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Unsupported method" } }) + "\n"); continue; }
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\n");
  }
});
