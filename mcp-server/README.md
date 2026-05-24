# lucarne-mcp

Model Context Protocol server exposing Lucarne's live World Cup 2026 football intelligence (on-chain attested AI signals + market odds + analyst briefs) to LLMs and bots.

Tools: `getSignal(iso3)`, `getOdds(iso3)`, `getBrief(iso3)`, `getMatch(team1, team2)`.

## Use locally (Claude Desktop / Cursor / Continue)

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "lucarne": {
      "command": "npx",
      "args": ["-y", "lucarne-mcp"],
      "env": {
        "LUCARNE_JUDGE_TOKEN": "<optional; bypasses x402 paywall on getBrief/getMatch>"
      }
    }
  }
}
```

## Use remotely (any MCP client supporting SSE transport)

```
endpoint: https://<railway-url>/sse
messages: https://<railway-url>/messages
```

## Subscribe (plain SSE, no MCP client required)

```bash
curl -N https://<railway-url>/subscribe/ARG?interval=15
```

Streams JSON `{signal, odds}` events every N seconds. Designed for trading bots, on-chain agents, and LLM frameworks that don't speak MCP yet.

## Env

| Var | Default | Purpose |
|---|---|---|
| `LUCARNE_POLYBOT_URL` | `https://lucarne-polybot-production.up.railway.app` | Upstream FastAPI brain |
| `LUCARNE_JUDGE_TOKEN` | _(none)_ | Forward as `X-Lucarne-Judge` to skip x402 paywall |
| `PORT` | `8787` | HTTP listen port (Railway injects) |

## Architecture

```
LLM client (Claude/Cursor)  ─┐
                             ├─stdio─┐
Trading bot (HTTP SSE)       ─┤      │
                             │      ▼
                             │  lucarne-mcp ──HTTPS──▶ polybot (FastAPI)
                             │                              │
                             └────SSE /sse────┘              ▼
                                                      X Layer mainnet
                                                      SignalAttestor,
                                                      MatchResultAttestor,
                                                      SignalPool, etc.
```

All signals are attested on-chain on X Layer (chain 196) before exposure. Verify any signal tx hash on [OKLink](https://www.oklink.com/xlayer).
