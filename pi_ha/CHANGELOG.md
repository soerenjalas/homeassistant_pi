# Changelog

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
