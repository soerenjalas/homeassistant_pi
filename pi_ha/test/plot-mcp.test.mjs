import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { toolPolicy } from "../security.mjs";

function rpc(child, id, method, params) {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id === id) { child.stdout.off("data", onData); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
      }
    };
    child.stdout.on("data", onData);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

test("charts MCP validates data and emits a fenced chart block; charts need no approval", async () => {
  const child = spawn(process.execPath, ["plot-mcp.mjs"], { cwd: new URL("..", import.meta.url).pathname, stdio: ["pipe", "pipe", "inherit"] });
  try {
    await rpc(child, 1, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    const list = await rpc(child, 2, "tools/list", {});
    assert.deepEqual(list.tools.map((tool) => tool.name), ["chart"]);
    assert.equal(list.tools[0].annotations.readOnlyHint, true);
    const good = await rpc(child, 3, "tools/call", { name: "chart", arguments: { kind: "line", title: "Temperatur", xLabel: "Zeit", yLabel: "°C", series: [{ name: "Bad", points: [[1762699200000, 21.7], [1762699260000, 21.9]] }] } });
    assert.equal(good.isError, undefined);
    const block = good.content[0].text;
    assert.match(block, /^```chart\n/);
    const spec = JSON.parse(block.slice(8, -4));
    assert.equal(spec.kind, "line"); assert.equal(spec.xType, "time"); assert.equal(spec.series[0].points.length, 2);
    const category = await rpc(child, 5, "tools/call", { name: "chart", arguments: { kind: "bar", series: [{ points: [["Wohnzimmer", 3], ["Küche", 5]] }] } });
    const categorySpec = JSON.parse(category.content[0].text.slice(8, -4));
    assert.equal(categorySpec.xType, "category");
    assert.deepEqual(categorySpec.labels, ["Wohnzimmer", "Küche"]);
    const bad = await rpc(child, 4, "tools/call", { name: "chart", arguments: { kind: "pie", series: [{ points: [[1, 2]] }] } });
    assert.equal(bad.isError, true);
    assert.match(bad.content[0].text, /kind/);
    assert.equal(toolPolicy("mcp__charts__chart", { readOnlyHint: true }), "allow");
  } finally { child.kill(); }
});
