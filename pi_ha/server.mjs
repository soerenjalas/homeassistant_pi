import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Chat } from "./agent.mjs";
import { requireUser } from "./security.mjs";
import { mcpConfig, redactMcpText } from "./mcp-config.mjs";

process.umask(0o077);
const options = JSON.parse(await readFile(process.env.PI_HA_OPTIONS || "/data/options.json", "utf8"));
if (!Array.isArray(options.allowed_user_ids) || options.allowed_user_ids.some((id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))) {
  throw new Error("allowed_user_ids must be a list of HA user IDs");
}
if (typeof options.model !== "string" || !/^[a-zA-Z0-9._-]{1,100}$/.test(options.model)) throw new Error("Invalid model ID");
const dataDir = process.env.PI_HA_DATA || "/data/users";
await mkdir(dataDir, { recursive: true, mode: 0o700 });
const config = {
  model: options.model,
  ...mcpConfig(options),
};
const assets = new Map(await Promise.all([
  ["/", "index.html", "text/html; charset=utf-8"],
  ["/app.js", "app.js", "text/javascript; charset=utf-8"],
  ["/markdown.js", "markdown.js", "text/javascript; charset=utf-8"],
  ["/style.css", "style.css", "text/css; charset=utf-8"],
].map(async ([route, file, type]) => [route, { type, data: await readFile(new URL(`public/${file}`, import.meta.url)) }])));
for (const [route, file] of [
  ["/vendor/marked.js", "marked/lib/marked.esm.js"],
  ["/vendor/purify.js", "dompurify/dist/purify.es.mjs"],
]) assets.set(route, { type: "text/javascript; charset=utf-8", data: await readFile(new URL(`node_modules/${file}`, import.meta.url)) });
const chats = new Map();
async function getChat(user) {
  if (!chats.has(user)) {
    const promise = new Chat(join(dataDir, user), config).init().catch((error) => { chats.delete(user); throw error; });
    chats.set(user, promise);
  }
  return chats.get(user);
}
async function jsonBody(request) {
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw Object.assign(new Error("Request too large"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw Object.assign(new Error("Invalid JSON body"), { status: 400 }); }
}
function json(response, code, value) {
  response.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'");
  try {
    const user = requireUser(request, options.allowed_user_ids);
    const path = new URL(request.url, "http://localhost").pathname;
    if (request.method === "GET" && assets.has(path)) {
      const asset = assets.get(path);
      response.writeHead(200, { "Content-Type": asset.type }); response.end(asset.data); return;
    }
    if (!["GET", "POST"].includes(request.method)) { json(response, 405, { error: "Method not allowed" }); return; }
    const chat = await getChat(user);
    if (request.method === "GET" && path === "/api/models") { json(response, 200, { models: chat.listModels() }); return; }
    if (request.method === "GET" && path === "/api/status") { json(response, 200, await chat.status()); return; }
    if (request.method !== "POST") { json(response, 404, { error: "Not found" }); return; }
    const body = await jsonBody(request);
    if (path === "/api/prompt") {
      if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 20000) {
        json(response, 400, { error: "Message must contain 1–20000 characters" }); return;
      }
      if (chat.busy || chat.login.active) { json(response, 409, { error: "A request is already active" }); return; }
      void chat.run(body.message.trim());
    } else if (path === "/api/stop") {
      await chat.stop();
    } else if (path === "/api/new") {
      await chat.newConversation();
    } else if (path === "/api/login") {
      chat.startLogin();
    } else if (path === "/api/model") {
      if (typeof body.model !== "string" || body.model.length > 100) { json(response, 400, { error: "Invalid model ID" }); return; }
      await chat.selectModel(body.model);
    } else if (path === "/api/approval") {
      if (typeof body.id !== "string" || typeof body.approved !== "boolean") { json(response, 400, { error: "Invalid approval" }); return; }
      if (!chat.approvals.answer(body.id, body.approved)) { json(response, 409, { error: "Approval expired" }); return; }
    } else { json(response, 404, { error: "Not found" }); return; }
    json(response, 200, { ok: true });
  } catch (error) { json(response, error.status || 500, { error: redactMcpText(error.message, config) }); }
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(Number(process.env.PORT || 8099), "0.0.0.0", () => console.log("Pi HA: ingress UI listening"));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, async () => {
  server.close();
  await Promise.allSettled([...chats.values()].map(async (promise) => {
    const chat = await promise; await chat.stop();
    if (chat.session) {
      await chat.session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
      chat.session.dispose();
    }
  }));
  process.exit(0);
});
