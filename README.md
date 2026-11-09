# Pi for Home Assistant

A Home Assistant app with a private, mobile-friendly Pi chat in the sidebar.
Uses OpenAI subscription login, `gpt-6.1-sol`, and Home Assistant MCP through Pi codemode.

## Install

1. In Home Assistant, open **Settings → Apps → App store → Repositories**.
2. Add `https://github.com/soerenjalas/homeassistant_pi`.
3. Install **Pi Home Assistant**.
4. Set `allowed_user_ids` to your HA administrator user ID, start the app, and enable **Show in sidebar**.
5. Open **Pi** and sign in with OpenAI using the device code.

See [app documentation](pi_ha/DOCS.md) for configuration and permissions.

**Experimental:** writes require explicit approval; no agent shell/filesystem tools are enabled.
Household state/history requested in chat is sent to OpenAI.
