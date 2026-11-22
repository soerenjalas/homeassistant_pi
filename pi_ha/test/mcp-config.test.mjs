import test from "node:test";
import assert from "node:assert/strict";
import { mcpConfig, redactMcpText, parseModelRef } from "../mcp-config.mjs";

test("empty MCP URL preserves built-in mode; custom URL never receives the Supervisor token", () => {
  const env = { SUPERVISOR_TOKEN: "do-not-forward" };
  const builtin = mcpConfig({}, env);
  assert.equal(builtin.mcpUrl, "http://supervisor/core/api/mcp");
  assert.equal(builtin.mcpHeaders.Authorization, "Bearer do-not-forward");
  assert.deepEqual(mcpConfig({ mcp_url: "" }, env), builtin);
  const custom = mcpConfig({ mcp_url: " http://ha-mcp:9583/private_test-secret " }, env);
  assert.equal(custom.mcpBackend, "HA-MCP");
  assert.deepEqual(custom.mcpHeaders, {});
  assert.equal(JSON.stringify(custom).includes(env.SUPERVISOR_TOKEN), false);
  assert.equal(custom.mcpUrl, "http://ha-mcp:9583/private_test-secret");
  assert.doesNotMatch(redactMcpText(`failed at ${custom.mcpUrl} and /private_test-secret`, custom), /private_test-secret/);
  assert.doesNotMatch(redactMcpText(builtin.mcpHeaders.Authorization, builtin), /do-not-forward/);
});

test("model refs parse provider/id and reject malformed values; API keys are redacted", () => {
  assert.deepEqual(parseModelRef("mistral/mistral-small-latest"), { provider: "mistral", model: "mistral-small-latest" });
  for (const value of [null, 5, "model", "/model", "provider/", "bad provider/x", "a/b c"]) assert.equal(parseModelRef(value), null);
  const config = { mcpUrl: "http://x/private_abc", mistralApiKey: "mistral-secret-key" };
  assert.doesNotMatch(redactMcpText("leak: mistral-secret-key", config), /mistral-secret-key/);
});

test("invalid custom endpoints fail rather than falling back", () => {
  for (const value of [12, "not a URL", "file:///tmp/secret", "http://user:password@ha/mcp", "https://ha/mcp#secret"]) {
    assert.throws(() => mcpConfig({ mcp_url: value }, { SUPERVISOR_TOKEN: "test" }));
  }
});
