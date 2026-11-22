# Changelog

## 0.1.9

- Replace the charts stdio MCP subprocess with a codemode-exposed `make_chart` tool; no spawned server can block session setup anymore. Charts still render from `chart` blocks and need no approval.

## 0.1.8

- 20 s client-side API timeout, so the UI always shows an error instead of hanging on “Verbinde …”.
- 15 s server-side limit for per-user app initialization.

## 0.1.7

- 15 s timeout per MCP server and a hard init timeout with a visible German error, so an unreachable HA-MCP URL can no longer freeze the UI.
- Stage logging in the app log for session/MCP binding.

## 0.1.6

- Optional Mistral API key adds a Mistral model group beside the OpenAI subscription. Key is runtime-only, password-masked, never returned by the API, and redacted from displayed text.
- Model choices persist as provider/model per HA user and keep the current conversation.
- Surface connection errors in the UI status line and app log.

## 0.1.5

- Local `charts` MCP server (line, scatter, bar) with strict data validation; codemode can call it without approval.
- Chat renders validated `chart` Markdown blocks with vendored uPlot, including time and category axes and dark-mode colors.

## 0.1.4

- Move the model picker into the fixed composer toolbar, keeping it accessible while scrolling.
- Replace the header's New Chat button with a floating, labelled “+ Neu” control.

## 0.1.3

- OpenAI subscription model selector in the chat header; choices persist per HA user without clearing the conversation.
- Animated working indicator beside the composer, with a separate approval-wait state and reduced-motion support.

## 0.1.2

- Optional secret HA-MCP connection URL; empty keeps the original built-in MCP backend.
- Custom servers never receive the Supervisor token. No silent fallback or write replay.
- Show active backend, preserve write approvals, and redact connection secrets from displayed text.

## 0.1.1

- Render assistant replies as sanitized Markdown, including tables and code blocks.
- Enter sends a message; Shift+Enter inserts a newline. IME composition is preserved.

## 0.1.0

- Initial experimental ingress app using Pi SDK 1.5.0.
- OpenAI subscription device login, gpt-6.1-sol, HA MCP via codemode.
- Per-user history and enforced one-shot approvals for writes.
