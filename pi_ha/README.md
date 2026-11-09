# Pi Home Assistant

An experimental Home Assistant app (add-on) with an admin-only sidebar chat.

- Pi SDK with **OpenAI ChatGPT subscription** login and **gpt-6.1-sol**.
- Home Assistant MCP tools through Pi **codemode**. No agent shell or filesystem tools.
- Reads run immediately; every other MCP tool call needs an explicit, single-use approval.
- Mobile-friendly German UI, live text updates, Stop, and New Chat.
- Separate login, persisted conversation, and approval audit log for each allowlisted HA user.
- Uses Home Assistant Ingress. No public ports or separate web password.

See [DOCS.md](DOCS.md) for installation, permissions, and limitations. Nothing here is automatically deployed to Home Assistant.
