/**
 * Shared Lucarne MCP server definition.
 *
 * Uses the low-level Server + setRequestHandler API to avoid the McpServer
 * helper's deep generic inference (which trips TS2589 under zod 3.25+).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const POLYBOT_URL =
  process.env.LUCARNE_POLYBOT_URL?.replace(/\/$/, "") ||
  "https://lucarne-polybot-production.up.railway.app";

const JUDGE_TOKEN = process.env.LUCARNE_JUDGE_TOKEN || "";

async function polybot(path: string, opts: { paid?: boolean } = {}) {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.paid && JUDGE_TOKEN) headers["X-Lucarne-Judge"] = JUDGE_TOKEN;

  const res = await fetch(`${POLYBOT_URL}${path}`, { headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

function normIso(v: unknown): string {
  if (typeof v !== "string") throw new Error("iso3 must be a string");
  const s = v.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) throw new Error(`Invalid ISO-3 code: ${v}`);
  return s;
}

function asText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

const TOOLS = [
  {
    name: "getSignal",
    description:
      "Get Lucarne's latest on-chain attested AI signal for a nation: implied win probability, confidence band, and the most recent SignalAttestor tx hash on X Layer mainnet (chain 196).",
    inputSchema: {
      type: "object",
      properties: {
        iso3: {
          type: "string",
          description: "ISO-3166 alpha-3 country code (e.g. ARG, BRA, FRA, ESP)",
        },
      },
      required: ["iso3"],
    },
  },
  {
    name: "getOdds",
    description:
      "Get current market odds for a nation winning the 2026 FIFA World Cup. Returns implied probability, decimal odds, and market depth.",
    inputSchema: {
      type: "object",
      properties: {
        iso3: { type: "string", description: "ISO-3 country code" },
      },
      required: ["iso3"],
    },
  },
  {
    name: "getBrief",
    description:
      "Get the full Lucarne AI analyst brief for a nation: tactical read, key players, recent form, signal vs market edge, and on-chain signal tx hash. x402-paywalled (0.01 USDC on X Layer); LUCARNE_JUDGE_TOKEN bypasses payment.",
    inputSchema: {
      type: "object",
      properties: {
        iso3: { type: "string", description: "ISO-3 country code" },
      },
      required: ["iso3"],
    },
  },
  {
    name: "getMatch",
    description:
      "Get a head-to-head AI brief for two nations meeting in a specific fixture: predicted scoreline, win probabilities, key matchup notes, and on-chain signal tx hash. x402-paywalled with judge bypass.",
    inputSchema: {
      type: "object",
      properties: {
        team1: { type: "string", description: "ISO-3 code of first team" },
        team2: { type: "string", description: "ISO-3 code of second team" },
      },
      required: ["team1", "team2"],
    },
  },
] as const;

export function buildServer() {
  const server = new Server(
    { name: "lucarne-mcp", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Lucarne MCP exposes live World Cup 2026 football intelligence sourced from X Layer mainnet contracts and an autonomous AI signal agent. Use getSignal for the agent's latest probabilistic forecast, getOdds for market-implied probabilities, getBrief for a full analyst brief, and getMatch for a head-to-head two-team analysis. ISO codes are uppercase alpha-3.",
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS as unknown as typeof TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      switch (name) {
        case "getSignal": {
          const code = normIso((args as Record<string, unknown>).iso3);
          const { status, body } = await polybot(`/signal/${code}`);
          if (status >= 400) return asText({ error: status, body });
          return asText(body);
        }
        case "getOdds": {
          const code = normIso((args as Record<string, unknown>).iso3);
          const { status, body } = await polybot(`/odds/${code}`);
          if (status >= 400) return asText({ error: status, body });
          return asText(body);
        }
        case "getBrief": {
          const code = normIso((args as Record<string, unknown>).iso3);
          const { status, body } = await polybot(`/intel/${code}`, { paid: true });
          if (status === 402) {
            return asText({
              error: "Payment required",
              hint:
                "Set LUCARNE_JUDGE_TOKEN env var on the MCP server, or pay 0.01 USDC via the x402 envelope at " +
                POLYBOT_URL +
                "/intel/" +
                code,
              x402: (body as { x402?: unknown }).x402,
            });
          }
          if (status >= 400) return asText({ error: status, body });
          return asText(body);
        }
        case "getMatch": {
          const a = args as Record<string, unknown>;
          const t1 = normIso(a.team1);
          const t2 = normIso(a.team2);
          const { status, body } = await polybot(`/match/${t1}/${t2}`, { paid: true });
          if (status === 402) {
            return asText({
              error: "Payment required",
              hint: "Set LUCARNE_JUDGE_TOKEN or pay 0.01 USDC via x402.",
              x402: (body as { x402?: unknown }).x402,
            });
          }
          if (status >= 400) return asText({ error: status, body });
          return asText(body);
        }
        default:
          return asText({ error: `Unknown tool: ${name}` });
      }
    } catch (err) {
      return asText({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return server;
}

export { POLYBOT_URL, JUDGE_TOKEN, TOOLS };
