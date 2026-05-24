/**
 * Lucarne MCP — HTTP/SSE entrypoint for Railway deploy.
 *
 * Exposes:
 *   GET  /            — health + capability summary (HTML for humans, JSON via Accept)
 *   GET  /sse         — MCP Server-Sent Events transport (for remote MCP clients)
 *   POST /messages    — MCP client → server message channel (paired with /sse)
 *   GET  /subscribe/:iso3?interval=30
 *                     — Plain SSE feed of {signal, odds} updates for a nation
 *                       (useful for non-MCP consumers: bots, dashboards, agents)
 *   GET  /tools       — JSON list of MCP tools (for inspector / docs)
 */

import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { buildServer, POLYBOT_URL, JUDGE_TOKEN } from "./server.js";

const PORT = Number(process.env.PORT || 8787);
const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS — open by design; nothing here is authenticated.
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

/* ── Landing page ─────────────────────────────────────────────────────── */
app.get("/", (req, res) => {
  if (req.headers.accept?.includes("application/json")) {
    res.json({
      name: "lucarne-mcp",
      version: "0.1.0",
      polybot: POLYBOT_URL,
      judgeBypassConfigured: Boolean(JUDGE_TOKEN),
      tools: ["getSignal", "getOdds", "getBrief", "getMatch"],
      endpoints: {
        mcpSse: "/sse",
        mcpMessages: "/messages",
        subscribe: "/subscribe/:iso3?interval=30",
        toolList: "/tools",
      },
    });
    return;
  }
  res.setHeader("content-type", "text/html");
  res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Lucarne MCP</title>
<style>body{font-family:ui-monospace,Menlo,monospace;background:#0a0e0a;color:#9fd89f;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.6}h1{color:#4ade80;letter-spacing:.1em}a{color:#4ade80}code{background:#111;padding:.1rem .4rem;border-radius:3px}pre{background:#111;padding:1rem;border-radius:4px;overflow-x:auto;border:1px solid #1f2a1f}</style>
</head><body>
<h1>LUCARNE · MCP SERVER</h1>
<p>Model Context Protocol server exposing live World Cup 2026 football intelligence sourced from <strong>X Layer mainnet (chain 196)</strong> contracts and the Lucarne AI signal agent.</p>
<h3>Tools</h3>
<ul>
  <li><code>getSignal(iso3)</code> — latest on-chain attested AI signal</li>
  <li><code>getOdds(iso3)</code> — current market odds</li>
  <li><code>getBrief(iso3)</code> — full analyst brief (x402-paid, judge bypass)</li>
  <li><code>getMatch(team1, team2)</code> — head-to-head fixture brief</li>
</ul>
<h3>Connect from Claude Desktop / Cursor</h3>
<pre>{
  "mcpServers": {
    "lucarne": {
      "command": "npx",
      "args": ["-y", "lucarne-mcp"]
    }
  }
}</pre>
<h3>Remote SSE transport</h3>
<pre>endpoint: ${publicUrl(req)}/sse
messages: ${publicUrl(req)}/messages</pre>
<h3>Subscribable feed (plain SSE — no MCP client needed)</h3>
<pre>curl -N "${publicUrl(req)}/subscribe/ARG?interval=15"</pre>
<p>Streams JSON events <code>{"signal":…, "odds":…}</code> every <em>interval</em> seconds.</p>
<p style="color:#6b7280;font-size:.85rem;margin-top:2rem">Polybot: <a href="${POLYBOT_URL}/health">${POLYBOT_URL}</a> · Judge bypass: ${JUDGE_TOKEN ? "configured" : "not configured"}</p>
</body></html>`);
});

function publicUrl(req: express.Request) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

app.get("/tools", (_req, res) => {
  res.json({
    tools: [
      { name: "getSignal", args: { iso3: "string (ISO-3)" } },
      { name: "getOdds", args: { iso3: "string (ISO-3)" } },
      { name: "getBrief", args: { iso3: "string (ISO-3)" } },
      { name: "getMatch", args: { team1: "string (ISO-3)", team2: "string (ISO-3)" } },
    ],
  });
});

/* ── MCP SSE transport ────────────────────────────────────────────────── */
// One McpServer instance per process, but a new transport per SSE connection.
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);

  res.on("close", () => {
    transports.delete(transport.sessionId);
  });

  const server = buildServer();
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = String(req.query.sessionId || "");
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(400).json({ error: "Unknown sessionId. Open /sse first." });
    return;
  }
  await transport.handlePostMessage(req, res, req.body);
});

/* ── Plain SSE subscribe feed ─────────────────────────────────────────── */
/**
 * Anyone (no MCP client required) can stream a nation's live signal + odds:
 *
 *   curl -N https://lucarne-mcp.up.railway.app/subscribe/ARG?interval=15
 *
 * Each event is a JSON line with the merged response. Useful for trading bots,
 * dashboards, or any LLM agent that doesn't speak MCP.
 */
app.get("/subscribe/:iso3", async (req, res) => {
  const iso3 = String(req.params.iso3 || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso3)) {
    res.status(400).json({ error: "iso3 must be 3 uppercase letters" });
    return;
  }
  const intervalSec = Math.max(5, Math.min(300, Number(req.query.interval) || 30));

  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("connection", "keep-alive");
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const tick = async () => {
    try {
      const [sigRes, oddsRes] = await Promise.all([
        fetch(`${POLYBOT_URL}/signal/${iso3}`).then((r) => r.json()).catch((e) => ({ error: String(e) })),
        fetch(`${POLYBOT_URL}/odds/${iso3}`).then((r) => r.json()).catch((e) => ({ error: String(e) })),
      ]);
      const payload = {
        iso3,
        ts: new Date().toISOString(),
        signal: sigRes,
        odds: oddsRes,
      };
      res.write(`event: update\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`);
    }
  };

  await tick();
  while (!closed) {
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
    if (closed) break;
    await tick();
  }
});

/* ── Health ───────────────────────────────────────────────────────────── */
app.get("/health", async (_req, res) => {
  try {
    const upstream = await fetch(`${POLYBOT_URL}/health`).then((r) => r.json());
    res.json({ ok: true, polybot: upstream });
  } catch (err) {
    res.status(503).json({ ok: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`lucarne-mcp listening on :${PORT} → polybot ${POLYBOT_URL}`);
  console.log(`judge bypass: ${JUDGE_TOKEN ? "ON" : "OFF"}`);
});
