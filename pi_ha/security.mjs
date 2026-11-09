export function requireUser(request, allowedUserIds) {
  const ip = request.socket.remoteAddress?.replace(/^::ffff:/, "");
  if (ip !== "172.30.32.2") throw Object.assign(new Error("Ingress access only"), { status: 403 });
  const id = request.headers["x-remote-user-id"];
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || !allowedUserIds.includes(id)) {
    throw Object.assign(new Error("User not allowed. Add your HA user ID to allowed_user_ids in the app configuration."), { status: 403 });
  }
  if (request.method !== "GET" && (request.headers["x-pi-request"] !== "1" || !request.headers["content-type"]?.startsWith("application/json"))) {
    throw Object.assign(new Error("Invalid request headers"), { status: 403 });
  }
  return id;
}

export function toolPolicy(name, annotations) {
  if (name === "codemode") return "allow";
  if (!name.startsWith("mcp__homeassistant__")) return "deny";
  return annotations?.readOnlyHint === true ? "allow" : "approve";
}

export class Approvals {
  pending = new Map();
  constructor(timeoutMs = 120_000) { this.timeoutMs = timeoutMs; }
  request(id, tool, input, signal) {
    if (signal?.aborted) return Promise.resolve(false);
    return new Promise((resolve) => {
      const finish = (approved) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        this.pending.delete(id);
        resolve(approved);
      };
      const abort = () => finish(false);
      const timer = setTimeout(abort, this.timeoutMs);
      this.pending.set(id, { tool, input: structuredClone(input), finish });
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  answer(id, approved) {
    const entry = this.pending.get(id);
    if (!entry) return false;
    entry.finish(approved === true);
    return true;
  }
  cancel() { for (const item of [...this.pending.values()]) item.finish(false); }
  list() { return [...this.pending].map(([id, { tool, input }]) => ({ id, tool, input })); }
}
