import test from "node:test";
import assert from "node:assert/strict";
import { requireUser, toolPolicy, Approvals } from "../security.mjs";

const req = (ip = "172.30.32.2", user = "admin1", method = "GET", headers = {}) => ({
  socket: { remoteAddress: ip }, method,
  headers: { "x-remote-user-id": user, ...headers },
});
test("only allowlisted users arriving from ingress are accepted", () => {
  assert.equal(requireUser(req(), ["admin1"]), "admin1");
  assert.equal(requireUser(req("::ffff:172.30.32.2"), ["admin1"]), "admin1");
  for (const request of [req("127.0.0.1"), req("172.30.32.3"), req(undefined, "other"), req(undefined, ""), req(undefined, "../admin1")]) {
    assert.throws(() => requireUser(request, ["admin1"]));
  }
  assert.throws(() => requireUser(req(), []));
});
test("mutating HTTP requests require same-origin-only custom headers", () => {
  assert.throws(() => requireUser(req(undefined, undefined, "POST"), ["admin1"]));
  assert.equal(requireUser(req(undefined, undefined, "POST", { "x-pi-request": "1", "content-type": "application/json" }), ["admin1"]), "admin1");
});
test("only trusted HA MCP reads skip approval; all other tools fail closed", () => {
  assert.equal(toolPolicy("codemode"), "allow");
  assert.equal(toolPolicy("mcp__homeassistant__get_history", { readOnlyHint: true }), "allow");
  assert.equal(toolPolicy("mcp__homeassistant__call_action", { readOnlyHint: false }), "approve");
  assert.equal(toolPolicy("mcp__homeassistant__unknown"), "approve");
  for (const tool of ["bash", "read", "write", "edit", "mcp__other__read", "tool_search"]) assert.equal(toolPolicy(tool, { readOnlyHint: true }), "deny");
});
test("approval is one-shot, bound to its arguments and instance", async () => {
  const a = new Approvals(), b = new Approvals(); const input = { light: "bed" };
  const wait = a.request("1", "turn_on", input); input.light = "other";
  assert.equal(a.list()[0].input.light, "bed");
  assert.equal(b.answer("1", true), false);
  assert.equal(a.answer("1", true), true); assert.equal(await wait, true);
  assert.equal(a.answer("1", true), false);
});
test("denial, timeout, stop, and already-aborted requests fail closed", async () => {
  const a = new Approvals(10);
  const wait = a.request("deny", "write", {}); a.answer("deny", false); assert.equal(await wait, false);
  assert.equal(await a.request("timeout", "write", {}), false);
  const controller = new AbortController();
  const aborted = a.request("aborted", "write", {}, controller.signal); controller.abort(); assert.equal(await aborted, false);
  assert.equal(await a.request("already-aborted", "write", {}, controller.signal), false);
  const stopped = a.request("stop", "write", {}); a.cancel(); assert.equal(await stopped, false);
  assert.deepEqual(a.list(), []);
});
