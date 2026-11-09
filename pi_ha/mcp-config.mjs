export function mcpConfig(options, env = process.env) {
  const custom = options.mcp_url ?? env.PI_HA_MCP_URL ?? "";
  if (typeof custom !== "string") throw new Error("mcp_url must be a URL or empty");
  if (custom.trim()) {
    let url;
    try { url = new URL(custom.trim()); } catch { throw new Error("Invalid MCP URL"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
      throw new Error("MCP URL must use HTTP(S), without userinfo or a fragment");
    }
    // Secret-path servers authenticate through their URL, never through our Supervisor token.
    return { mcpUrl: url.href, mcpHeaders: {}, mcpBackend: "HA-MCP" };
  }
  const token = env.SUPERVISOR_TOKEN || env.PI_HA_TOKEN;
  if (!token) throw new Error("Home Assistant token is missing");
  return {
    mcpUrl: "http://supervisor/core/api/mcp",
    mcpHeaders: { Authorization: `Bearer ${token}` },
    mcpBackend: "HA integriert",
  };
}

export function redactMcpText(text, config) {
  let result = String(text ?? "");
  const secrets = [config.mcpUrl, config.mcpHeaders?.Authorization];
  if (config.mcpBackend === "HA-MCP") {
    const url = new URL(config.mcpUrl);
    if (url.pathname !== "/") secrets.push(url.pathname);
    if (url.search) secrets.push(url.search);
  }
  for (const secret of secrets) if (secret) result = result.replaceAll(secret, "[MCP credential redacted]");
  return result.replace(/private_[A-Za-z0-9_-]+/g, "[MCP secret redacted]");
}
