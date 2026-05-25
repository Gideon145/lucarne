# Lucarne

**Real-time on-chain intelligence terminal for the 2026 FIFA World Cup.**

> *"Every signal staked. Every call attested. The ledger doesn't lie."*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-lucarne--xyz.vercel.app-cyan)](https://lucarne-xyz.vercel.app)
[![Demo Video](https://img.shields.io/badge/Demo%20Video-YouTube-red)](https://youtu.be/ADD_VIDEO_ID_HERE)
[![Judge Mode](https://img.shields.io/badge/Judge%20Mode-%2Fjudge-magenta)](https://lucarne-xyz.vercel.app/judge)
[![Judge Guide](https://img.shields.io/badge/Judge%20Guide-JUDGE__GUIDE.md-magenta)](./JUDGE_GUIDE.md)
[![Leaderboard](https://img.shields.io/badge/Leaderboard-%2Fleaderboard-gold)](https://lucarne-xyz.vercel.app/leaderboard)
[![Track Record](https://img.shields.io/badge/Track%20Record-4--1--0-brightgreen)](https://lucarne-xyz.vercel.app/track-record)
[![MCP Server](https://img.shields.io/badge/MCP-lucarne--mcp-purple)](https://lucarne-mcp-production.up.railway.app)
[![GameFi](https://img.shields.io/badge/Track-GameFi-brightgreen)](https://lucarne-xyz.vercel.app/survivor)
[![Follow on X](https://img.shields.io/badge/X-%40lucarne__xyz-black)](https://x.com/lucarne_xyz)
[![Agent Wallet](https://img.shields.io/badge/Agent%20Wallet-0xC8D9...47C3-green)](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3)
[![X Layer Mainnet](https://img.shields.io/badge/Chain-X%20Layer%20Mainnet%20196-brightgreen)](https://www.oklink.com/xlayer)

### Judges — open [`/judge`](https://lucarne-xyz.vercel.app/judge) for a wallet-free, one-page verification surface (live lifetime nonce, contract status, on-chain proofs). Build progress is broadcast in real time at [x.com/lucarne_xyz](https://x.com/lucarne_xyz).

---

## What Is Lucarne?

Lucarne is an autonomous AI agent that scores all **48 World Cup 2026 nations 0—100 every 60 seconds** and writes each score as a cryptographic attestation directly to **X Layer Mainnet (Chain ID 196)** — immutable, timestamped, verifiable by anyone with a block explorer.

When real matches happen, Lucarne goes further than passive scoring. The agent **stakes OKB on its own match predictions** before kickoff, **opens parimutuel pools** for users to bet against or with it, and **settles them trustlessly** from on-chain match results. Bettors who call the outcome correctly can **mint a soulbound "I Called It" NFT** as on-chain proof.

Click any nation in the terminal to unlock a **paid AI brief** — generated live by Claude, gated via **x402 micropayment on the OKX Onchain OS**.

**This is not a paper agent.** It runs in production, computes signals on a 60-second loop, and writes to mainnet every cycle that produces a meaningful score change. Every prediction is economically bonded by real OKB the agent stands to lose.

---

## The Problem Lucarne Solves

The 2026 FIFA World Cup will be the most-watched event in history. Billions of people will form opinions about which nations are dangerous, which are overrated, which are quietly peaking — and they will be reading **opinions, not signals**. Twitter accounts pivot. Sportsbook odds move silently. Pundits hedge after the fact.

**No one is forced to stand behind their call before the whistle blows.**

Lucarne fixes this with a single primitive: **on-chain attestation with economic bonding**. Every signal is computed, hashed, and written to X Layer before kickoff. Every match prediction comes with the agent's own OKB stake. There is no editing the record after the fact. Bad calls aren't buried — they're permanent.

---

## Live Verification — Click Every Link

| Service | URL | Status |
|---|---|---|
| **Frontend (Live HUD)** | https://lucarne-xyz.vercel.app | Live |
| **Judge Mode** (wallet-free review) | https://lucarne-xyz.vercel.app/judge | Live |
| **Track Record** | https://lucarne-xyz.vercel.app/track-record | Live |
| **MCP Server** (Claude/Cursor + SSE feed) | https://lucarne-mcp-production.up.railway.app | Live |
| **Polybot** (FastAPI + x402 paywall) | https://lucarne-polybot-production.up.railway.app | Live |
| **Agent Wallet (all tx)** | https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3 | 27,500+ tx |
| **SignalAttestor (48 nations)** | https://www.oklink.com/xlayer/address/0x2Dcbd50173bB570BB5257223bfDb6b92520FAe81 | Mainnet |
| **MatchSignalAttestor** | https://www.oklink.com/xlayer/address/0x9693d19C09d9dE08F4acaD288f7608552D018482 | Mainnet |
| **MatchResultAttestor** | https://www.oklink.com/xlayer/address/0x81AF1dfF7D92ac333a785a1486822159855377bF | Mainnet |
| **SignalPool v2** | https://www.oklink.com/xlayer/address/0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67 | Mainnet |
| **ICalledItNFT v2** | https://www.oklink.com/xlayer/address/0xBC2200d99980661fef938eE72001BAaE496F0adf | Mainnet |
| **LucarnePredictions** | https://www.oklink.com/xlayer/address/0x178565919FFebC4b57ca04112d0FFFaD946Df6E7 | Mainnet |

The agent wallet has **over 27,500 confirmed transactions** on X Layer Mainnet — every one of them either a country score attestation, a match signal, a pool stake, or a settlement call. That is the proof. It cannot be faked.

---

## Pipeline Validation (Live Club-Football Stress Test, May 20—23 2026)

Before betting Lucarne's reputation on the 2026 World Cup, we ran the **entire pipeline end-to-end on real club matches** — signal generation → on-chain signal lock → community vote → agent-bonded pool → bet → settlement → soulbound NFT mint. Every game below served two purposes: a real public signal call, **and** the moment we shipped the next layer of the stack.

| # | Game | Date | Signal Call | Signal Tx | Result | Layer Shipped |
|---|---|---|---|---|---|---|
| 1 | **UEL Final** — SC Freiburg vs Aston Villa | May 20 | HOME (Aston Villa) | [`0x4e98f3c0...`](https://www.oklink.com/xlayer/tx/0x4e98f3c011ad8c512acc61805550658208370674dd82b8d3820706384aa33f65) | **Aston Villa win — CORRECT** · resolve [`0x48de5700...`](https://www.oklink.com/xlayer/tx/0x48de570075c862184c854d2ad0ca4c8ea2666808fb05e1e55310368968cd9467) | Full pipeline e2e: signal generation + on-chain attestation + result resolution |
| 2 | **Eredivisie PO** — Ajax vs Groningen | May 21 | HOME (Ajax) @ 99.8% | [`0x38e3c6cd...`](https://www.oklink.com/xlayer/tx/0x38e3c6cd2e8abe7833839b0840c1ab8bda5afb33ea52879483288fb9dfd62daa) | **Ajax win — CORRECT** · pending resolve | **Community voting shipped** — [LucarnePredictions](https://www.oklink.com/xlayer/address/0x178565919FFebC4b57ca04112d0FFFaD946Df6E7) contract, fans now vote on-chain alongside the agent |
| 3 | **Serie A** — Fiorentina vs Atalanta | May 22 | AWAY (Atalanta) | [`0x6983a191...`](https://www.oklink.com/xlayer/tx/0x6983a19169803ad0a03355586d289c1b644d31802ae0ae7f297eff8b50f504d5) | 0-0 draw — **WRONG, agent stake forfeited** | **Agent-bonded betting shipped** — SignalPool live; agent stake [`0x291c672c...`](https://www.oklink.com/xlayer/tx/0x291c672c3e3af5ee96ccf4e1ef5fa43258399f1876ef2a805b05e2b256b0b002), first user bet [`0x9176860e...`](https://www.oklink.com/xlayer/tx/0x9176860e7fe9c53142ef399f316fa7a988e8b8219c3c58dcd2658060c2e3da81) |
| 4 | **DFB Pokal Final** — Bayern Munich vs Stuttgart | May 23 | HOME (Bayern) @ 65% | [`0x81ad7e71...`](https://www.oklink.com/xlayer/tx/0x81ad7e719a192354a2f76d460b83d95110607031c1571ca72692d106cbfeb0d7) | **Bayern win 3–0 — CORRECT** | **"I Called It" NFT shipped** — first soulbound mint [`0x01ec8778...`](https://www.oklink.com/xlayer/tx/0x01ec8778625381ff40025a73ed1534c3a2c2c27fb76eee3be35b7587fd97e2de) |
| 5 | **La Liga** — Real Madrid vs Athletic Club | May 23 | HOME (Real Madrid) @ 68% | [`0xeec67755...`](https://www.oklink.com/xlayer/tx/0xeec67755b145f961c35bfbf93c80a5b52232abcea71716e4ed1eb1f3555c29e5) | **Real Madrid win 4–2 — CORRECT** | NFT mint flow battle-tested · second mint [`0xdc7120d5...`](https://www.oklink.com/xlayer/tx/0xdc7120d57a82670e9773f09404df5f0ef0c95aedeba5083de25f566175158321) |

**Stress-test scoreline: 4 correct · 1 wrong · 0 pending.** Every layer of the stack has been exercised in production with real OKB on the line — including a **real loss** (Fiorentina/Atalanta) that proves the pool/settlement path works in adversarial conditions. Real Madrid won 4–2 and Bayern won 3–0, both called correctly before kickoff. The entire build process is broadcast live on **[x.com/lucarne_xyz](https://x.com/lucarne_xyz)** — see the per-game commits and demo clips as they shipped.

---

## Architecture

```
+---------------------------------------------------------------------------------+
|                           LUCARNE PROTOCOL STACK                                |
+----------------------+----------------------+------------------------------------+
|   FRONTEND           |   AGENT (Node.js)    |   INFRASTRUCTURE                  |
|   Next.js 14         |   Railway            |                                   |
|   Vercel             |   60s loop           |   Railway (Agent, Polybot)        |
|                      |                      |   Vercel (Frontend)               |
|  +----------------+  |  +----------------+  |   X Layer Mainnet (Chain 196)     |
|  | 48 Nation Grid |  |  | SignalEngine   |  |                                   |
|  | Live scores    |<-+--| Polymarket +   |  |  +--------------------------+     |
|  | Live match HUD |  |  | form + market  |  |  | SignalAttestor.sol       |     |
|  | BetPanel       |  |  | -> 0..100 score|  |  | attest(country, score..) |     |
|  | NFT mint UI    |  |  +----------------+  |  | 27,500+ on-chain writes  |     |
|  | x402 AI brief  |  |  | Write Gate     |  |  +--------------------------+     |
|  +----------------+  |  | |dScore|>3     |  |  | MatchSignalAttestor.sol  |     |
|                      |  | regime change  |  |  | pre-kickoff signal lock  |     |
|   POLYBOT            |  | 4h heartbeat   |  |  +--------------------------+     |
|   FastAPI            |  | 6k/day cap     |  |  | MatchResultAttestor.sol  |     |
|   Polymarket fetch   |  +----------------+  |  | FT outcome + verdict     |     |
|   Form data          |  | TxExecutor     |  |  +--------------------------+     |
|                      |  | ethers v6      |  |  | SignalPool.sol (v2)      |     |
|   AI BRIEFS (Claude) |  | nonce-managed  |  |  | agentStake, bet, settle, |     |
|   x402-gated         |  | OKB gas        |  |  | claim, reclaimNoWinner   |     |
|   Pay-per-brief      |  +----------------+  |  +--------------------------+     |
|                      |  | OutcomeWatcher |  |  | ICalledItNFT.sol (v2)    |     |
+----------------------+  | resolves games |  |  | ERC721, soulbound        |     |
                          | mints verdicts |  |  | 1 per wallet per game    |     |
                          +----------------+  |  +--------------------------+     |
                                              +------------------------------------+
```

---

## What The Agent Actually Does (Every 60 Seconds)

```typescript
// Step 1: For each of 48 World Cup nations
for (const country of COUNTRIES) {

  // Step 2: Compute live signal from Polymarket + form data
  const { score, regime, signalHash } = await computeSignal(country);

  // Step 3: Write-gate (avoid spamming chain)
  //   Write if: first attestation, |dScore| > 3, regime changed, OR 4h heartbeat
  if (!shouldWrite(country, score, regime)) continue;

  // Step 4: Daily cap check (max 6,000 tx/day)
  if (txToday >= MAX_TX_PER_DAY) break;

  // Step 5: Attest on-chain via SignalAttestor.attest(country, score, regime, signalHash)
  const tx = await contract.attest(country, score, regime, signalHash);
  await tx.wait();

  // Step 6: Track + update state
  txToday++; totalTxCount++;
  countryState.set(country, { lastScore: score, lastRegime: regime, lastWrittenAt: now });
}

// Step 7: Check resolved matches via Polymarket, write outcomes on-chain
await checkAndRecordOutcomes(provider, outcomeContract);

// Step 8: Sleep 60s, repeat forever
```

That's it. 60 seconds. Forever. Every meaningful score change becomes a permanent X Layer transaction.

---

## Smart Contracts (X Layer Mainnet, Chain ID 196)

### SignalAttestor.sol — `0x2Dcbd501...0FAe81`
The 48-nation scoreboard. The agent writes here every 60 seconds when a country's score moves >3 points or 4 hours pass without a write.

```solidity
function attest(bytes3 country, uint8 score, uint8 regime, bytes32 signalHash) external
function totalAttestations() external view returns (uint256)
```

### MatchSignalAttestor.sol — `0x9693d19C...018482`
Pre-kickoff match signal lock. Records `homeProb`, `drawProb`, `awayProb` (basis points), `signalScore` (0—100 confidence), `signalCall` (HOME/DRAW/AWAY), and `dataHash` (provenance of input data). Called by the agent before the whistle blows.

### MatchResultAttestor.sol — `0x81AF1dfF...855377bF`
After full time, anyone can call `resolve(gameId, actualOutcome)`. The contract reads the prior `signalCall` from `MatchSignalAttestor` and computes `signalCorrect` on-chain — the verdict is permanent.

### SignalPool.sol (v2) — `0xEe15Dc83...12ccEa67`
Parimutuel pool: three buckets (HOME / DRAW / AWAY).

| Function | Description |
|---|---|
| `agentStake(gameId, outcome, kickoffTimestamp)` | Agent opens pool with its OKB stake |
| `bet(gameId, outcome)` | Users stake OKB on any outcome until kickoff |
| `settle(gameId)` | Anyone can call after `MatchResultAttestor` resolves |
| `claim(gameId)` | Winners claim proportional share: `payout = (stake × pot) / winningBucket` |
| `reclaimNoWinner(gameId, outcome)` | If the winning bucket is empty (no counterparty), stakers reclaim their own stake — prevents permanent fund lock when niche outcomes hit |

### ICalledItNFT.sol (v2) — `0xBC2200d9...96F0adf`
Soulbound ERC-721. One mint per wallet per game. Bettors who staked on the winning outcome can mint a permanent on-chain proof: *"I called this game."*

---

## OKX & X Layer Integration

| Component | Stack |
|---|---|
| **Chain** | X Layer Mainnet (Chain ID 196) — every contract, every tx |
| **Gas Token** | OKB native — cheap enough to attest 48 nations every 60s |
| **Signal Data** | Polymarket probabilities (the live odds source for every football market) |
| **AI Briefs** | Claude (Anthropic) via **x402 HTTP micropayment protocol** on **OKX Onchain OS** |
| **Wallet** | OKX Wallet + MetaMask (injected provider, EIP-1193) |
| **Explorer** | OKLink (`oklink.com/xlayer`) — every tx hash in this README resolves there |

OKB as native gas is what makes the 60-second loop economically viable. Attesting 48 country scores every minute on Ethereum L1 would cost thousands of dollars per day. On X Layer it costs cents. That's why Lucarne can exist.

---

## Repository Structure

```
lucarne/
├── agent/          # Autonomous 60s scoring loop (Node + TypeScript)
├── contracts/     # 7 Solidity contracts on X Layer Mainnet (Hardhat v3)
├── frontend/      # Next.js 14 dashboard + /judge + /track-record (Vercel)
├── polybot/       # FastAPI sidecar — Polymarket data + Claude AI briefs + x402 EIP-3009 paywall
└── mcp-server/    # Model Context Protocol server (stdio + SSE) — plugs Lucarne into Claude/Cursor + trading bots
```

---

## What Makes Lucarne Different

**1. The agent is running right now** — On X Layer Mainnet, every 60 seconds, 48 countries, 27,500+ confirmed transactions in the agent wallet. Click the link, see the tx count.

**2. Every claim is on-chain verifiable.** This README has 12+ tx hash links. Every one resolves on OKLink. Open OKX Wallet, switch to X Layer, paste any address — it's all there.

**3. Skin in the game.** The agent stakes OKB on every match call before kickoff — but only when signal confidence clears a meaningful threshold (a Kelly-style edge filter baked into the write gate). When it gets one wrong (Fiorentina/Atalanta), that OKB is gone. Real money, real consequences, real signal discipline.

**4. Full OKX stack.** X Layer Mainnet for every contract, OKB for gas + stakes, Polymarket for data, OKX Onchain OS + **real x402 EIP-3009 USDC settlement** for paid AI briefs, OKLink for proof. This is what an OKX-native dApp looks like.

**5. Composable + plug-and-play.** `MatchSignalAttestor`, `SignalPool`, `ICalledItNFT` are independent primitives reusable by any dApp. And the [MCP server](https://lucarne-mcp-production.up.railway.app) makes the entire signal stream consumable by Claude, Cursor, or any HTTP bot — zero integration code.

**6. World Cup timing.** 48 nations already wired into the agent loop for the 2026 FIFA World Cup. The infrastructure is in production now — no migration, no scramble.

**7. Lucarne's signal is not a Polymarket reformatter.** Polymarket provides live consensus odds — the crowd's view. Lucarne's edge is three filters stacked on top: (1) a **form-data overlay** (recent results, H2H, tournament-phase momentum) that market liquidity prices with a lag; (2) a **write gate** that only attests when the signal moves >3 points or the volatility regime flips — suppressing noise and keeping every on-chain write intentional; (3) a **Kelly-style confidence threshold** that only opens a real OKB stake when the composite score clears a meaningful bar. A pure reformatter wouldn't stake its own OKB on the output — and lose it when wrong.

---

## Track Coverage — X Layer X Cup

**Primary submission: AI Agent. Secondary: Prediction Markets.**

Lucarne isn't a single-track entry — it's a complete OKX-stack ecosystem built around an autonomous agent. The five surfaces below aren't prize hedges; they're proof the agent has a real product around it. If you're judging **AI Agent**, here's what the agent ships into. If you're judging another track, every component below is independently functional and on-chain verifiable.

Every track has shipped code and verifiable on-chain proof:

| Track | Status | On-Chain Proof |
|---|---|---|
| **Prediction Markets** | ✅ Shipped | [`LucarnePredictions`](https://www.oklink.com/xlayer/address/0x178565919FFebC4b57ca04112d0FFFaD946Df6E7) community-vote contract + Polymarket as the live signal data source for all 48 nations |
| **Trading** | ✅ Shipped | [`SignalPool v2`](https://www.oklink.com/xlayer/address/0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67) parimutuel pool — real OKB stakes, real user bets, real settlement; agent bonds every match call |
| **NFT** | ✅ Shipped | [`ICalledItNFT v2`](https://www.oklink.com/xlayer/address/0xBC2200d99980661fef938eE72001BAaE496F0adf) soulbound ERC-721 — real mints [`0x01ec8778…`](https://www.oklink.com/xlayer/tx/0x01ec8778625381ff40025a73ed1534c3a2c2c27fb76eee3be35b7587fd97e2de), [`0xdc7120d5…`](https://www.oklink.com/xlayer/tx/0xdc7120d57a82670e9773f09404df5f0ef0c95aedeba5083de25f566175158321) |
| **AI Agent** | ✅ Shipped | Autonomous 60s loop on agent wallet [`0xC8D9…47C3`](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3) (27,500+ mainnet tx). Claude-powered AI briefs gated by **real x402 EIP-3009 USDC settlement** on X Layer. **MCP server** ([lucarne-mcp-production.up.railway.app](https://lucarne-mcp-production.up.railway.app)) exposes the agent to Claude Desktop / Cursor + a plain SSE feed for trading bots |
| **Social** | ✅ Shipped | Live build broadcast on [x.com/lucarne_xyz](https://x.com/lucarne_xyz); share-to-X button fires on every NFT-mint confirmation (pre-filled tweet with match link); [`/leaderboard`](https://lucarne-xyz.vercel.app/leaderboard) ranks wallets by on-chain proven call count |
| **GameFi** | ✅ Shipped | [`SurvivorPool`](https://www.oklink.com/xlayer/address/0x7250E9480A025bF59EedD271DFB88C5BC2f8c12F) — pick a nation each round, survive on momentum score ≥ 30, last survivor(s) split the pot (0.001 OKB entry). Live at [`/survivor`](https://lucarne-xyz.vercel.app/survivor) |

---

## MCP Server — Lucarne Plugged Into Any LLM

Lucarne ships a live [Model Context Protocol](https://modelcontextprotocol.io) server so any LLM client (Claude Desktop, Cursor, Continue, Cline) and any HTTP bot can read the agent's on-chain football intelligence in real time.

**Endpoint:** https://lucarne-mcp-production.up.railway.app

| Tool | Purpose |
|---|---|
| `getSignal(iso3)` | Latest on-chain attested AI signal for a nation |
| `getOdds(iso3)` | Current market odds (Polymarket-aggregated) |
| `getBrief(iso3)` | Full analyst brief — x402 paywalled, judge token forwarded automatically |
| `getMatch(team1, team2)` | Head-to-head fixture brief — x402 paywalled |

**Plug into Claude Desktop:**

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "lucarne": {
      "command": "npx",
      "args": ["-y", "lucarne-mcp"]
    }
  }
}
```

**Subscribe from any HTTP client (no MCP needed):**

```bash
curl -N https://lucarne-mcp-production.up.railway.app/subscribe/ARG?interval=15
# streams {"signal":…, "odds":…} every 15s
```

Designed for trading bots, on-chain agents, and LLM frameworks that don't speak MCP yet. Source: [`mcp-server/`](./mcp-server).

---

## OKX OnchainOS Skills Used

Lucarne is built around the [`okx/onchainos-skills`](https://github.com/okx/onchainos-skills) stack (`npx skills add okx/onchainos-skills`). The integrations that ship today, and how each maps into the protocol:

| Skill | Where It Lives in Lucarne |
|---|---|
| **`okx-agent-payments-protocol`** (x402) | `polybot/server.py` — paid Claude AI briefs are gated by an x402 micropayment (`xlayer-mainnet`, USDC `0x74b7f1…6d22`, `pay-to` = agent wallet). Replay-protection via per-nonce set. Hit `GET /brief/{iso3}` → 402 → pay → 200 |
| **`okx-dapp-discovery`** (Polymarket plugin) | Polymarket gamma-api drives the per-nation probability signal for all 48 World Cup nations and every live match (`polybot/server.py` → `POLYMARKET_IDS`, `WC_FIXTURES`) |
| **`okx-onchain-gateway`** | X Layer Mainnet RPC (`https://rpc.xlayer.tech`) is the gateway for every `attest()`, `agentStake()`, `bet()`, `settle()`, `mintForGame()`, and `resolve()` transaction. The agent persists nonce across restarts and refetches pending-nonce explicitly to survive X Layer RPC quirks |
| **`okx-agentic-wallet`** (pattern) | Agent wallet [`0xC8D9…47C3`](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3) operates as a self-driven agentic wallet on X Layer — 27,500+ mainnet tx, signal-driven write gate, no human intervention in the scoring loop |

**Why this matters for judging:** every claim in this section is grep-able. Open `polybot/server.py` and search for `x402`, `X402_NETWORK`, `xlayer-mainnet`, `LUCARNE_WALLET` — the wiring is real, not aspirational.

---

## Traction (as of May 25, 2026)

> Every number below is independently verifiable on X Layer Mainnet or in the live dashboard — no marketing, just on-chain facts.

- **27,500+ confirmed mainnet transactions** on agent wallet [`0xC8D9...47C3`](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3) — lifetime nonce, growing in real time. Live count:
  ```bash
  curl -X POST https://rpc.xlayer.tech -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3","latest"]}'
  ```
- **Autonomous since launch** — 60-second cadence, persistent nonce across Railway restarts, signal-driven write gate (`|ΔScore|>3`, regime change, or 4h heartbeat) keeps gas burn minimal while preserving every meaningful regime transition. The agent only opens a pool when signal confidence clears a meaningful threshold — a Kelly-style edge filter that keeps every stake intentional and every on-chain write justified.
- **7 contracts deployed on X Layer Mainnet** — SignalAttestor, MatchSignalAttestor, MatchResultAttestor, SignalPool v2 (with `reclaimNoWinner`), ICalledItNFT v2 (soulbound ERC-721), LucarnePredictions (community vote), plus legacy v1 of pool + NFT preserved for reference.
- **Full pipeline exercised on 5 real club matches** in 4 days (May 20—23) — signal generation, attestation, community voting, agent-bonded pools, real user bets, soulbound NFT mints — **4 correct calls, 1 real OKB loss, 0 pending. 80% hit rate on a 5-game sample** (treat the 27,500+ TX chain history as the real trust anchor — sample size is intentionally small and early; accuracy claims will grow with World Cup group-stage volume). (See Pipeline Validation table above.)
- **First user bet landed:** [`0x9176860e...`](https://www.oklink.com/xlayer/tx/0x9176860e7fe9c53142ef399f316fa7a988e8b8219c3c58dcd2658060c2e3da81) · **First soulbound NFT minted:** [`0x01ec8778...`](https://www.oklink.com/xlayer/tx/0x01ec8778625381ff40025a73ed1534c3a2c2c27fb76eee3be35b7587fd97e2de).
- **Real x402 settlement on X Layer.** Paid AI briefs (`/intel/{iso3}`, `/match/{t1}/{t2}`) are gated by an EIP-3009 USDC paywall on X Layer mainnet — user signs `TransferWithAuthorization` via `eth_signTypedData_v4`, the polybot relayer submits on-chain to USDC [`0x74b7f1…6d22`](https://www.oklink.com/xlayer/address/0x74b7f16337b8972027f6196a17a631ac6de26d22). Real tx hashes appear on every unlocked brief. No mocks.

---

## For Judges — 60-Second Verification

> Everything you need is one click away. No setup, no wallet.

1. **Open [lucarne-xyz.vercel.app/judge](https://lucarne-xyz.vercel.app/judge)** — single page, live nonce read from X Layer RPC, every contract + every proof tx hash linked to OKLink. Paid x402 briefs unlock free for judges (token embedded).
2. **Confirm tx count** with one curl:
   ```bash
   curl -X POST https://rpc.xlayer.tech -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3","latest"]}'
   ```
   Hex-decode the result — 27,500+ lifetime confirmed writes.
3. **Watch a fresh TX land** — refresh [the agent wallet on OKLink](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3); a new `attest()` appears within ~60 seconds.
4. **Verify a wrong call** — Fiorentina/Atalanta signal [`0x6983a191…`](https://www.oklink.com/xlayer/tx/0x6983a19169803ad0a03355586d289c1b644d31802ae0ae7f297eff8b50f504d5) staked 0.05 OKB on Atalanta. Match drew 0–0. OKB is gone. We don't hide losses.

Full walkthrough: [`JUDGE_GUIDE.md`](./JUDGE_GUIDE.md).

---

## Known Limitations (Honest Framing)

- **v1 vs v2 pools.** The four pool/NFT activity hashes above (Fio/Ata stake + user bet, Inter stake, Barca stake, both NFT mints) hit the **v1** SignalPool/NFT contracts (`0xd6E29fFc…` and the v1 NFT) because they predate the v2 redeploy that added `reclaimNoWinner`. All *new* pools from this point forward open on [`SignalPool v2`](https://www.oklink.com/xlayer/address/0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67). We kept v1 deployed and visible for full transparency — every loss, every locked stake, every recovery path is on record.
- **x402 paid AI briefs run for real on X Layer Mainnet.** The polybot accepts an EIP-3009 `TransferWithAuthorization` envelope, recovers the signer via EIP-712, and submits the USDC transfer on-chain through a relayer wallet — the real tx hash is returned on every unlocked brief. If the upstream USDC RPC stalls, the request fails closed (HTTP 402); no "premium brief" is ever served without a valid on-chain signature.

---

## Local Development

> Full prod stack is already live (Vercel + Railway + X Layer Mainnet). The steps below are only needed if you want to fork & redeploy.

```bash
# 1. Contracts (Hardhat v3, X Layer Mainnet, chain 196)
cd contracts && npm install && cp .env.example .env   # PRIVATE_KEY
npx hardhat run scripts/deploySignalPool.ts --network xlayer

# 2. Agent (60s scoring loop)
cd ../agent && npm install && cp .env.example .env
npm run start

# 3. Frontend
cd ../frontend && npm install && npm run dev   # http://localhost:3000

# 4. Polybot (x402 paywall + AI briefs) — FastAPI, requires X402_FACILITATOR_KEY
cd ../polybot && pip install -r requirements.txt && uvicorn server:app --reload

# 5. MCP server (stdio for Claude Desktop, or SSE for HTTP clients)
cd ../mcp-server && npm install && npm run build && npm run start:stdio
```

`gameId` is always `keccak256(slug)` — consistent across all contracts.

---

## License

MIT

---

> **Disclaimer:** Experimental software. Not financial advice. OKB staked in SignalPools can be lost. Self-custodial — Lucarne never holds your keys. 18+ only. Not affiliated with OKX, FIFA, Polymarket, or Anthropic.
