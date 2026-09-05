// Thin client matching api_spec.md exactly. Talks to /api/* which vite.config.js
// proxies to the mock server (Phase 4) or the real backend (post Phase 5) —
// nothing in this file needs to change when that swap happens.

const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  scan: (repoPath) =>
    request("/scan", {
      method: "POST",
      body: JSON.stringify({ repo_path: repoPath }),
    }),

  getGraph: () => request("/graph"),

  ask: (question) =>
    request("/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),

  getImpact: (nodeId) => request(`/impact/${encodeURIComponent(nodeId)}`),

  runTestgen: (nodeId) =>
    request(`/testgen/${encodeURIComponent(nodeId)}`, { method: "POST" }),

  getHealth: () => request("/health"),
};
