import test from "node:test";
import assert from "node:assert/strict";
import { validateChart, chartBlock } from "../chart-spec.mjs";
import { toolPolicy } from "../security.mjs";

test("chart specs validate kinds, limits, and axis types; make_chart needs no approval", () => {
  const line = validateChart({ kind: "line", title: "Temperatur", series: [{ name: "Bad", points: [[1762699200000, 21.7], [1762699260000, 21.9]] }] });
  assert.equal(line.spec.xType, "time");
  assert.match(chartBlock(line.spec), /^```chart\n/);
  const bar = validateChart({ kind: "bar", series: [{ points: [["Wohnzimmer", 3], ["Küche", 5]] }] });
  assert.equal(bar.spec.xType, "category");
  assert.deepEqual(bar.spec.labels, ["Wohnzimmer", "Küche"]);
  assert.ok(validateChart({ kind: "pie", series: [{ points: [[1, 2]] }] }).error);
  assert.ok(validateChart({ kind: "line", series: [{ points: [[1, "x"]] }] }).error);
  assert.ok(validateChart({ kind: "line", series: [{ points: Array.from({ length: 2001 }, (_, i) => [i, i]) }] }).error);
  assert.equal(toolPolicy("make_chart", { readOnlyHint: true }), "allow");
});
