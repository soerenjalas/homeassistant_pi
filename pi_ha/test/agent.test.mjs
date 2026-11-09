import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Chat } from "../agent.mjs";

test("SDK codemode reaches HA MCP; writes require approval and shell is blocked", { timeout: 40000 }, async () => {
  const calls = [];
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") { res.writeHead(405).end(); return; }
    let raw = ""; for await (const chunk of req) raw += chunk;
    const rpc = JSON.parse(raw);
    if (!rpc.id) { res.writeHead(202).end(); return; }
    let result;
    if (rpc.method === "initialize") result = { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "mock-ha", version: "1" } };
    else if (rpc.method === "tools/list") result = { tools: [
      { name: "get_status", description: "Read home state", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } },
      { name: "set_light", description: "Change light", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: false } },
    ] };
    else if (rpc.method === "tools/call") { calls.push(rpc.params.name); result = { content: [{ type: "text", text: "ok" }] }; }
    else if (rpc.method === "ping") result = {};
    else { res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, error: { code: -32601, message: "Unsupported" } })); return; }
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const dir = await mkdtemp(join(tmpdir(), "pi-ha-test-")); let chat;
  try {
    // Dummy credentials enable SDK initialization only; this test never calls OpenAI.
    await writeFile(join(dir, "auth.json"), JSON.stringify({ "openai-codex": {
      type: "oauth", access: "test", refresh: "test", expires: Date.now() + 86400000, accountId: "test",
    } }));
    chat = await new Chat(dir, { model: "gpt-6.1-sol", mcpUrl: `http://127.0.0.1:${server.address().port}/mcp`, haToken: "test" }).init();
    const session = await chat.getSession();
    assert.equal(session.model.id, "gpt-6.1-sol");
    assert.deepEqual(session.getActiveToolNames(), ["codemode"]);
    for (let i = 0; i < 200 && !session.getAllTools().some((tool) => tool.name.startsWith("mcp__")); i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(session.getAllTools().filter((tool) => tool.name.startsWith("mcp__")).length, 2);
    const codemode = session.agent.state.tools.find((tool) => tool.name === "codemode");
    const execute = (code) => {
      session.sessionManager.appendMessage({
        role: "assistant", content: [{ type: "toolCall", id: "test", name: "codemode", arguments: { code } }],
        api: session.model.api, provider: "openai-codex", model: session.model.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "toolUse", timestamp: Date.now(),
      });
      session.refreshContext();
      return codemode.execute("test", { code }, AbortSignal.timeout(15000));
    };
    const read = await execute('text(await tools.mcp__homeassistant__get_status({}));');
    assert.match(JSON.stringify(read.content), /Script completed/);
    assert.deepEqual(calls, ["get_status"]);
    const write = execute('text(await tools.mcp__homeassistant__set_light({}));');
    for (let i = 0; i < 100 && !chat.approvals.list().length; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(chat.approvals.list().length, 1);
    assert.deepEqual(calls, ["get_status"], "write must not execute while waiting");
    chat.approvals.answer(chat.approvals.list()[0].id, true);
    await write;
    assert.deepEqual(calls, ["get_status", "set_light"]);
    const denied = execute('text(await tools.mcp__homeassistant__set_light({}));');
    for (let i = 0; i < 100 && !chat.approvals.list().length; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(chat.approvals.list().length, 1);
    chat.approvals.cancel(); await denied;
    assert.deepEqual(calls, ["get_status", "set_light"]);
    const shell = await execute('text(await tools.bash({command: "echo unsafe"}));');
    assert.doesNotMatch(JSON.stringify(shell.content), /"output":"unsafe/);
    assert.match(JSON.stringify(shell.content), /not permitted|not a function|Unknown|not callable|not available|does not exist/i);
    const nextModel = chat.listModels().find((model) => model.id !== session.model.id);
    assert.ok(nextModel);
    const messagesBefore = session.messages.length;
    await chat.selectModel(nextModel.id);
    assert.equal(chat.session, session, "model switching must preserve the conversation");
    assert.equal(session.model.id, nextModel.id);
    assert.equal(session.messages.length, messagesBefore);
    await assert.rejects(chat.selectModel("not-a-real-model"), /Unknown/);
    chat.busy = true;
    await assert.rejects(chat.selectModel(nextModel.id), /Stop the current/);
    chat.busy = false;
    const restored = await new Chat(dir, chat.config).init();
    assert.equal(restored.selectedModel, nextModel.id);
  } finally {
    chat?.session?.dispose();
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
