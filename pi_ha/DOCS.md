# Install and use

## Requirements

- Home Assistant OS / a Supervisor installation with the app store.
- amd64 or aarch64 hardware and enough disk/memory for a Node.js app. The LLM runs at OpenAI, not on the HA machine.
- **Model Context Protocol** enabled in HA. Use the server integration, not MCP Client.
- A ChatGPT subscription with access to the requested Codex model.
- Internet access for npm/image installation and OpenAI authentication/model calls.

## Local installation

1. Copy **only the `pi_ha` folder** into HA's `/addons` directory, producing `/addons/pi_ha/config.yaml`.
   Use an existing SSH/Terminal or Samba app. Do not copy this repository's `.ha-*` credentials/backups or `node_modules`.
2. In Settings → Apps (formerly Add-ons) → App store, reload/check for updates. Open **Pi Home Assistant** under Local apps and install it.
3. In the app configuration, set:

   ```yaml
   allowed_user_ids:
     - YOUR_HOME_ASSISTANT_ADMIN_USER_ID
   model: gpt-6.1-sol
   ```

   Use the user's internal ID, not the username or `person.*` entity ID. An administrator can find it through HA's user management/API. Keep the allowlist limited to administrators: the app uses an administrator-capable Core API identity.
4. Start the app and enable **Show in sidebar**.
5. Open **Pi**, select **Bei OpenAI anmelden**, open the official OpenAI device-login link, and enter the displayed code.
   If requested, enable device-code login in your ChatGPT security settings. No localhost callback or API key is required.
6. The status line reports the model and number of connected HA tools. Try a read-only question, then a harmless light command and approve its tool call.

For installing from a Git repository instead, publish this repository without secrets; HA discovers the app's `config.yaml` in the `pi_ha` subdirectory. The repository root includes `repository.yaml`.

## Configuration

- `allowed_user_ids`: explicit HA user IDs allowed to open and use the app. Default `[]` denies everyone. Sidebar visibility alone is not treated as authorization.
- `model`: OpenAI Codex model ID. Default `gpt-6.1-sol`. If absent from Pi's model catalog, the app reports an error instead of silently using another model. Server acceptance/access still depends on your subscription.

The app connects to `http://supervisor/core/api/mcp` with its Supervisor token. It needs `homeassistant_api: true`, but does **not** request general Supervisor-management privileges, host networking, Docker access, or access to HA's configuration directory.

## Security and approval behaviour

- Only requests from the ingress proxy (`172.30.32.2`) are accepted. Supervisor-provided user headers must match the allowlist.
- All endpoints, including assets and status, enforce this check.
- POST endpoints require JSON and a custom header; the server does not allow cross-origin requests.
- OAuth credentials never go to the model or browser. Each user signs in independently.
- Only codemode and the registered HA MCP namespace can execute. Codemode's sandbox has no direct network, OS, or filesystem APIs.
- HA MCP tools explicitly annotated `readOnlyHint: true` can run without confirmation. Other tools, including ones with missing annotations, require approval.
- Every requested write is shown with exact tool name and parameters. Approval applies only to that call and user. Pending approvals expire after two minutes and are denied on Stop.
- Approved and denied tool calls are recorded in `/data/users/<user-id>/approvals.jsonl`.
- Server-side tool annotations are trusted hints, not independent proof of safety. Broad actions can restart HA, run scripts, or affect physical devices. Review every approval carefully.
- Data returned by HA and chat prompts are sent to OpenAI. This includes potentially sensitive history, device names, logs, and presence information.

## Persistence and recovery

Credentials and sessions live under `/data/users/<user-id>/`, not in the image. A restart resumes the latest chat; new chats preserve previous session files. The UI currently offers no archive browser or delete-history button. Reopening the app shows the most recent 80 text messages; Pi retains its full session/compaction history.

App backups can include these files and should be treated as secrets. To revoke subscription access, revoke the corresponding authorization through your OpenAI account; remove the user's app data when permanently retiring access. Removing a user from `allowed_user_ids` and restarting denies UI access but does not itself revoke OpenAI authorization.

Closing the UI does not stop a task. Use **Stoppen** if you want cancellation. Already executed actions are not rolled back by cancellation.

## Known limitations

- Experimental; first deployment still needs a real-device ingress/login test.
- The UI polls for incremental text/status, avoiding an extra WebSocket stack. It is not a terminal or a full Pi TUI.
- No shell, SSH, direct REST/WebSocket escape hatch, arbitrary file editing, or configuration mounts. Automation/dashboard editing is available only if HA MCP exposes suitable tools; the basic HA MCP tools may not support those operations.
- The app does not import this repository's existing chat history or automations automatically.
- No autonomous schedules, background jobs, voice interface, or multi-agent features.
- New Chat archives locally; old chats are not deleted.
- The pinned Pi version must be deliberately upgraded to receive upstream fixes/model support.

## Development

```sh
cd pi_ha
npm ci --ignore-scripts
npm test
```

Tests use dummy credentials and a local fake MCP server; they do not contact OpenAI or change your home. They exercise the actual Pi SDK/codemode pipeline, MCP discovery, read access, write approvals/denials, and shell isolation.

The server has environment overrides for developer tests: `PI_HA_OPTIONS` (options JSON path), `PI_HA_DATA` (private user data directory), `PI_HA_MCP_URL`, `PI_HA_TOKEN`, and `PORT`. These do **not** disable ingress/user validation. Do not publish a development proxy that fabricates ingress headers.

## License

The app source in this folder is MIT-licensed; see `LICENSE`. Pi and its dependencies retain their respective upstream licenses.
