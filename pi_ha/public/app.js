import { marked } from "./vendor/marked.js";
import DOMPurify from "./vendor/purify.js";
import { createMarkdownRenderer } from "./markdown.js";

const renderMarkdown = createMarkdownRenderer(marked, DOMPurify);
const $ = (id) => document.getElementById(id);
let messagesKey = "", approvalsKey = "", sending = false;
async function api(path, body) {
  const response = await fetch(`api/${path}`, body === undefined ? { cache: "no-store" } : {
    method: "POST", headers: { "Content-Type": "application/json", "X-Pi-Request": "1" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
async function action(path, body = {}) {
  try { await api(path, body); await update(); }
  catch (error) { $("error").textContent = error.message; }
}
function message(role, text) {
  const article = document.createElement("article"); article.className = role;
  const label = document.createElement("small"); label.textContent = role === "user" ? "Du" : "Pi";
  const content = document.createElement("div");
  if (role === "assistant") {
    content.className = "markdown";
    content.append(renderMarkdown(text));
  } else content.textContent = text;
  article.append(label, content); return article;
}
async function update() {
  const state = await api("status");
  $("status").textContent = `${state.model} · ${state.busy ? "Arbeitet …" : state.authenticated ? "Bereit" : "Nicht angemeldet"} · ${state.mcpBackend} · ${state.mcpTools} Werkzeuge`;
  $("login").hidden = state.authenticated;
  $("signin").disabled = state.login.active;
  $("login-info").textContent = state.login.error || (state.login.active ? "Code bei OpenAI eingeben. Falls nötig, Gerätecode-Anmeldung in den ChatGPT-Sicherheitseinstellungen erlauben." : "");
  $("login-url").hidden = !state.login.url;
  if (state.login.url) $("login-url").href = state.login.url;
  $("login-code").textContent = state.login.code || "";
  $("send").disabled = state.busy || !state.authenticated || sending;
  $("new").disabled = state.busy || !state.authenticated || state.login.active;
  $("stop").hidden = !state.busy && !state.login.active;
  $("error").textContent = state.error || "";
  $("activity").textContent = state.activity ? `Werkzeug: ${state.activity.replace("mcp__homeassistant__", "")}` : "";
  const nextKey = JSON.stringify([state.messages, state.draft]);
  if (nextKey !== messagesKey) {
    const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 150;
    const nodes = state.messages.map((m) => message(m.role, m.text));
    if (state.draft) nodes.push(message("assistant", state.draft));
    if (!nodes.length) nodes.push(message("assistant", "Frag mich nach dem Zustand deines Zuhauses, Verläufen oder Gerätesteuerung. Änderungen werden dir vor der Ausführung zur Bestätigung gezeigt."));
    $("messages").replaceChildren(...nodes); messagesKey = nextKey;
    if (nearBottom) window.scrollTo(0, document.documentElement.scrollHeight);
  }
  const nextApprovals = JSON.stringify(state.approvals);
  if (nextApprovals !== approvalsKey) {
    $("approvals").replaceChildren();
    for (const pending of state.approvals) {
      const card = document.createElement("article"); card.className = "approval";
      const title = document.createElement("strong"); title.textContent = "Aktion bestätigen";
      const name = document.createElement("p"); name.textContent = pending.tool.replace("mcp__homeassistant__", "");
      const args = document.createElement("pre"); args.textContent = JSON.stringify(pending.input, null, 2);
      const yes = document.createElement("button"); yes.textContent = "Einmal erlauben";
      const no = document.createElement("button"); no.textContent = "Ablehnen";
      const decide = (approved) => { yes.disabled = true; no.disabled = true; return action("approval", { id: pending.id, approved }); };
      yes.onclick = () => decide(true); no.onclick = () => decide(false);
      card.append(title, name, args, yes, no); $("approvals").append(card);
    }
    approvalsKey = nextApprovals;
  }
}
$("composer").onsubmit = async (event) => {
  event.preventDefault(); if (sending) return;
  const text = $("prompt").value.trim(); if (!text) return;
  sending = true; $("send").disabled = true;
  try { await api("prompt", { message: text }); $("prompt").value = ""; }
  catch (error) { $("error").textContent = error.message; }
  finally { sending = false; }
};
$("prompt").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    if (!$("send").disabled) $("composer").requestSubmit();
  }
});
$("new").onclick = () => { if (confirm("Neuen Chat starten? Der bisherige Chat bleibt auf dem Server gespeichert.")) action("new"); };
$("signin").onclick = () => action("login");
$("stop").onclick = () => action("stop");
async function poll() {
  try { await update(); } catch (error) { $("error").textContent = error.message; }
  setTimeout(poll, document.hidden ? 5000 : 800);
}
poll();
