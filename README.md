# Lucarne

**Real-time on-chain intelligence terminal for the 2026 FIFA World Cup.**

> *"Every signal staked. Every call attested. The ledger doesn't lie."*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-lucarne--xyz.vercel.app-cyan)](https://lucarne-xyz.vercel.app)
[![Judge Mode](https://img.shields.io/badge/Judge%20Mode-%2Fjudge-magenta)](https://lucarne-xyz.vercel.app/judge)
[![Judge Guide](https://img.shields.io/badge/Judge%20Guide-JUDGE__GUIDE.md-magenta)](./JUDGE_GUIDE.md)
[![Leaderboard](https://img.shields.io/badge/Leaderboard-%2Fleaderboard-gold)](https://lucarne-xyz.vercel.app/leaderboard)
[![GameFi](https://img.shields.io/badge/Track-GameFi-brightgreen)](https://lucarne-xyz.vercel.app/survivor)
[![Follow on X](https://img.shields.io/badge/X-%40lucarne__xyz-black)](https://x.com/lucarne_xyz)
[![Agent Wallet](https://img.shields.io/badge/Agent%20Wallet-0xC8D9...47C3-green)](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3)
[![X Layer Mainnet](https://img.shields.io/badge/Chain-X%20Layer%20Mainnet%20196-brightgreen)](https://www.oklink.com/xlayer)
[![Loop Interval](https://img.shields.io/badge/Loop-60s-orange)](#what-the-agent-actually-does-every-60-seconds)
[![Nations Scored](https://img.shields.io/badge/Nations-48%20World%20Cup%202026-blue)](#)

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
| **Agent Wallet (all tx)** | https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3 | 14,000+ tx |
| **SignalAttestor (48 nations)** | https://www.oklink.com/xlayer/address/0x2Dcbd50173bB570BB5257223bfDb6b92520FAe81 | Mainnet |
| **MatchSignalAttestor** | https://www.oklink.com/xlayer/address/0x9693d19C09d9dE08F4acaD288f7608552D018482 | Mainnet |
| **MatchResultAttestor** | https://www.oklink.com/xlayer/address/0x81AF1dfF7D92ac333a785a1486822159855377bF | Mainnet |
| **SignalPool v2** | https://www.oklink.com/xlayer/address/0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67 | Mainnet |
| **ICalledItNFT v2** | https://www.oklink.com/xlayer/address/0xBC2200d99980661fef938eE72001BAaE496F0adf | Mainnet |
| **LucarnePredictions** | https://www.oklink.com/xlayer/address/0x178565919FFebC4b57ca04112d0FFFaD946Df6E7 | Mainnet |

The agent wallet has **over 14,000 confirmed transactions** on X Layer Mainnet — every one of them either a country score attestation, a match signal, a pool stake, or a settlement call. That is the proof. It cannot be faked.

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

## On-Chain Pool & Settlement Activity (Verifiable)

| Action | Tx Hash | Detail |
|---|---|---|
| **Agent stake** — Fiorentina/Atalanta pool opened (AWAY · 0.05 OKB) | [`0x291c672c...`](https://www.oklink.com/xlayer/tx/0x291c672c3e3af5ee96ccf4e1ef5fa43258399f1876ef2a805b05e2b256b0b002) | First SignalPool stake |
| **First user bet** — 0.01 OKB on AWAY (Fiorentina/Atalanta) | [`0x9176860e...`](https://www.oklink.com/xlayer/tx/0x9176860e7fe9c53142ef399f316fa7a988e8b8219c3c58dcd2658060c2e3da81) | Pool received its first counterparty bet |
| **Agent stake** — Bayern/Stuttgart pool (HOME · 0.05 OKB) | [`0xe2bd4b93...`](https://www.oklink.com/xlayer/tx/0xe2bd4b93051056ba9638048e776d8b54336e5816a4733edddf7ed53bee860f7f) | Pool live for users |
| **Agent stake** — Real Madrid/Athletic Club pool (HOME · 0.05 OKB) | [`0x54e2e03f...`](https://www.oklink.com/xlayer/tx/0x54e2e03f4e8196424c17df2a4aa56a680089ff3484dda4fc1fdb658b559f4b40) | Pool live for users |
| **NFT mint** — ICalledIt soulbound proof | [`0x01ec8778...`](https://www.oklink.com/xlayer/tx/0x01ec8778625381ff40025a73ed1534c3a2c2c27fb76eee3be35b7587fd97e2de) | First "I Called It" NFT minted |
| **NFT mint** — ICalledIt soulbound proof | [`0xdc7120d5...`](https://www.oklink.com/xlayer/tx/0xdc7120d57a82670e9773f09404df5f0ef0c95aedeba5083de25f566175158321) | Second mint, different game |

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
|  | NFT mint UI    |  |  +----------------+  |  | 14,000+ on-chain writes  |     |
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
├── agent/                   Autonomous scoring agent (Node.js / TypeScript)
│   └── src/
│       ├── index.ts         60s loop: score 48 nations, write to chain
│       └── lib/
│           ├── signal.ts    Polymarket + form -> 0..100 score + regime
│           ├── outcome.ts   Resolves matches, writes outcomes on-chain
│           └── logger.ts
│
├── contracts/               Solidity 0.8.24 · Hardhat v3 · TypeScript ESM
│   ├── contracts/
│   │   ├── SignalAttestor.sol           # 48-nation scoreboard
│   │   ├── MatchSignalAttestor.sol      # pre-kickoff signal lock
│   │   ├── MatchResultAttestor.sol      # FT result + verdict
│   │   ├── SignalPool.sol               # parimutuel pool with reclaimNoWinner
│   │   └── ICalledItNFT.sol             # soulbound proof NFT
│   ├── scripts/
│   │   ├── attest-match-signal.js       # agent: lock signal before kickoff
│   │   ├── stake-pool.js                # agent: stake OKB, open pool
│   │   ├── resolve-match.js             # agent: write FT result on-chain
│   │   └── deploy*.ts                   # deployment scripts
│   └── deployments.json
│
├── frontend/                Next.js 14 App Router · Viem · TypeScript
│   ├── app/
│   ├── components/
│   │   ├── LiveMatchPanel.tsx           # 5-game tabs + signal intel + result cards
│   │   └── BetPanel.tsx                 # stake, bet, claim, settle, mint NFT
│   └── lib/
│       └── constants.ts                 # all live contract addresses
│
└── polybot/                 FastAPI sidecar — Polymarket data + AI brief router
    └── server.py
```

---

## What Makes Lucarne Different

**1. The agent is running right now.** Not in a demo container. Not behind a "click here to start." On X Layer Mainnet, every 60 seconds, 48 countries, 14,000+ confirmed transactions in the agent wallet. Click the link, see the tx count.

**2. Every claim is on-chain verifiable.** This README has 12+ tx hash links above. Every single one resolves on OKLink. Open OKX Wallet, switch to X Layer, paste any address — it's all there.

**3. Skin in the game.** The agent doesn't just predict — it stakes OKB on every match call before kickoff. When it gets one wrong (Fiorentina/Atalanta), that OKB is gone. Real money, real consequences, real signal quality discipline.

**4. World Cup timing.** Built specifically for the 2026 FIFA World Cup. 48 nations already wired into the agent loop. As group-stage matches begin, the infrastructure is already in production — no migration, no scramble.

**5. Full OKX stack usage.** X Layer Mainnet for every contract. OKB for gas + stakes. Polymarket for data. OKX Onchain OS + x402 for paid AI briefs. OKLink for proof. This is what an OKX-native dApp looks like.

**6. Composable primitives.** `MatchSignalAttestor` is independent of `SignalPool` is independent of `ICalledItNFT`. Any of them can be reused by other dApps. We aren't building a closed silo — we're shipping public goods.

---

## Track Coverage — X Layer X Cup

During the hackathon we built across six of the eligible tracks. Every track has shipped code and verifiable on-chain proof:

| Track | Status | On-Chain Proof |
|---|---|---|
| **Prediction Markets** | ✅ Shipped | [`LucarnePredictions`](https://www.oklink.com/xlayer/address/0x178565919FFebC4b57ca04112d0FFFaD946Df6E7) community-vote contract + Polymarket as the live signal data source for all 48 nations |
| **Trading** | ✅ Shipped | [`SignalPool v2`](https://www.oklink.com/xlayer/address/0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67) parimutuel pool — real OKB stakes, real user bets, real settlement; agent bonds every match call |
| **NFT** | ✅ Shipped | [`ICalledItNFT v2`](https://www.oklink.com/xlayer/address/0xBC2200d99980661fef938eE72001BAaE496F0adf) soulbound ERC-721 — real mints [`0x01ec8778…`](https://www.oklink.com/xlayer/tx/0x01ec8778625381ff40025a73ed1534c3a2c2c27fb76eee3be35b7587fd97e2de), [`0xdc7120d5…`](https://www.oklink.com/xlayer/tx/0xdc7120d57a82670e9773f09404df5f0ef0c95aedeba5083de25f566175158321) |
| **AI Agent** | ✅ Shipped | Autonomous 60s loop on agent wallet [`0xC8D9…47C3`](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3) (14,000+ mainnet tx). Claude-powered AI briefs gated by **x402** on **OKX Onchain OS** |
| **Social** | ✅ Shipped | Live build broadcast on [x.com/lucarne_xyz](https://x.com/lucarne_xyz); share-to-X button fires on every NFT-mint confirmation (pre-filled tweet with match link); [`/leaderboard`](https://lucarne-xyz.vercel.app/leaderboard) ranks wallets by on-chain proven call count |
| **GameFi** | ✅ Shipped | [`SurvivorPool`](https://www.oklink.com/xlayer/address/0x7250E9480A025bF59EedD271DFB88C5BC2f8c12F) — pick a nation each round, survive on momentum score ≥ 30, last survivor(s) split the pot (0.001 OKB entry). Live at [`/survivor`](https://lucarne-xyz.vercel.app/survivor) |

---

## OKX OnchainOS Skills Used

Lucarne is built around the [`okx/onchainos-skills`](https://github.com/okx/onchainos-skills) stack (`npx skills add okx/onchainos-skills`). The integrations that ship today, and how each maps into the protocol:

| Skill | Where It Lives in Lucarne |
|---|---|
| **`okx-agent-payments-protocol`** (x402) | `polybot/server.py` — paid Claude AI briefs are gated by an x402 micropayment (`xlayer-mainnet`, USDC `0x74b7f1…6d22`, `pay-to` = agent wallet). Replay-protection via per-nonce set. Hit `GET /brief/{iso3}` → 402 → pay → 200 |
| **`okx-dapp-discovery`** (Polymarket plugin) | Polymarket gamma-api drives the per-nation probability signal for all 48 World Cup nations and every live match (`polybot/server.py` → `POLYMARKET_IDS`, `WC_FIXTURES`) |
| **`okx-onchain-gateway`** | X Layer Mainnet RPC (`https://rpc.xlayer.tech`) is the gateway for every `attest()`, `agentStake()`, `bet()`, `settle()`, `mintForGame()`, and `resolve()` transaction. The agent persists nonce across restarts and refetches pending-nonce explicitly to survive X Layer RPC quirks |
| **`okx-agentic-wallet`** (pattern) | Agent wallet [`0xC8D9…47C3`](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3) operates as a self-driven agentic wallet on X Layer — 14,000+ mainnet tx, signal-driven write gate, no human intervention in the scoring loop |

**Why this matters for judging:** every claim in this section is grep-able. Open `polybot/server.py` and search for `x402`, `X402_NETWORK`, `xlayer-mainnet`, `LUCARNE_WALLET` — the wiring is real, not aspirational.

---

## Traction (as of May 23, 2026)

> Every number below is independently verifiable on X Layer Mainnet or in the live dashboard — no marketing, just on-chain facts.

- **14,000+ confirmed mainnet transactions** on agent wallet [`0xC8D9...47C3`](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3) — lifetime nonce, growing in real time. Live count:
  ```bash
  curl -X POST https://rpc.xlayer.tech -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3","latest"]}'
  ```
- **Autonomous since launch** — 60-second cadence, persistent nonce across Railway restarts, signal-driven write gate (|ΔScore|>3, regime change, or 4h heartbeat) keeps gas burn minimal while preserving every meaningful regime transition.
- **7 contracts deployed on X Layer Mainnet** — SignalAttestor, MatchSignalAttestor, MatchResultAttestor, SignalPool v2 (with `reclaimNoWinner`), ICalledItNFT v2 (soulbound ERC-721), LucarnePredictions (community vote), plus legacy v1 of pool + NFT preserved for reference.
- **Full pipeline exercised on 5 real club matches** in 4 days (May 20—23) — signal generation, attestation, community voting, agent-bonded pools, real user bets, soulbound NFT mints — **2 correct calls, 1 real OKB loss, 2 pending**. (See Pipeline Validation table above.)
- **First user bet landed:** [`0x9176860e...`](https://www.oklink.com/xlayer/tx/0x9176860e7fe9c53142ef399f316fa7a988e8b8219c3c58dcd2658060c2e3da81) · **First soulbound NFT minted:** [`0x01ec8778...`](https://www.oklink.com/xlayer/tx/0x01ec8778625381ff40025a73ed1534c3a2c2c27fb76eee3be35b7587fd97e2de).
- **Continuous on Railway** (production, 24/7) — frontend on Vercel, Polybot sidecar on Railway, agent autonomously writing to mainnet every cycle.
- **Live dashboard:** [lucarne-xyz.vercel.app](https://lucarne-xyz.vercel.app) — every nation, every match, every tx hash, all clickable into OKLink.
- **Public build log:** [x.com/lucarne_xyz](https://x.com/lucarne_xyz) — every shipped layer broadcast in real time with the corresponding mainnet tx.

---

## For Judges — 60-Second Verification Path

> Every claim in this README is independently verifiable on OKLink or via a single `curl`. No setup required.

**Step 1 — Open Judge Mode (10s)**

Go to [lucarne-xyz.vercel.app/judge](https://lucarne-xyz.vercel.app/judge). One page. No wallet. Live lifetime nonce read directly from X Layer RPC. All contract addresses, all proof tx hashes, all explorer links.

**Step 2 — Confirm 14k+ mainnet TXs (10s)**

```bash
curl -X POST https://rpc.xlayer.tech -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3","latest"]}'
```
The returned hex is the **lifetime confirmed transaction count** on the agent wallet. It cannot be fabricated.

**Step 3 — Watch a fresh TX land (60s)**

Open [the agent wallet on OKLink](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3) and refresh. A new `attest()` transaction will appear within ~60 seconds. Click it — decoded input shows `country`, `score`, `regime`, and `signalHash`.

**Step 4 — Verify the wrong call (15s)**

We don't hide losses. Click the Fiorentina/Atalanta signal tx [`0x6983a191...`](https://www.oklink.com/xlayer/tx/0x6983a19169803ad0a03355586d289c1b644d31802ae0ae7f297eff8b50f504d5) — the agent staked 0.05 OKB on Atalanta. The match drew 0-0. The OKB is gone. That's signal discipline.

---

## Known Limitations (Honest Framing)

Lucarne does not fake liveness. Every degraded path is surfaced rather than papered over — and the 14k+ TX trail is the proof these recovery paths work in production, not in theory.

- **v1 vs v2 pools.** The four pool/NFT activity hashes above (Fio/Ata stake + user bet, Inter stake, Barca stake, both NFT mints) hit the **v1** SignalPool/NFT contracts (`0xd6E29fFc…` and the v1 NFT) because they predate the v2 redeploy that added `reclaimNoWinner`. All *new* pools from this point forward open on [`SignalPool v2`](https://www.oklink.com/xlayer/address/0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67). We kept v1 deployed and visible for full transparency — every loss, every locked stake, every recovery path is on record.
- **If a SignalPool outcome has no winners** (e.g. niche AWAY win nobody bet on) → `reclaimNoWinner(gameId, outcome)` lets stakers withdraw their own stake — v2-only behaviour, by design.
- **If RPC drops mid-cycle** → ethers v6 fetches pending nonce explicitly to avoid `nonce-too-low` errors specific to X Layer's RPC behavior. The lifetime nonce never gets out of sequence.
- **If Polymarket data is stale** → write-gate suppresses the attestation; nothing fake is ever signed.
- **If the agent process crashes** → Railway restarts it. The agent re-reads nonce from chain and resumes — proven repeatedly across 14k+ TXs.
- **0G Compute / x402 mainnet endpoints for paid AI briefs** → wired via Polybot sidecar; falls back to free local generation when the x402 facilitator is unreachable. No fake "premium brief" is ever served.

---

## Disclaimer & Risk

> **Lucarne is experimental software. Read this before betting OKB.**

- **Not financial advice.** Country scores, match signals, and AI briefs are momentum-tracking outputs derived from public Polymarket data and football form. **Nothing in this product is a recommendation to buy, sell, hold, or stake any digital asset.** Signals are wrong all the time — we deliberately surfaced [the Fiorentina/Atalanta loss](https://www.oklink.com/xlayer/tx/0x6983a19169803ad0a03355586d289c1b644d31802ae0ae7f297eff8b50f504d5) as on-chain proof of that.
- **Digital assets are volatile.** OKB staked into a `SignalPool` can be lost in full. Pools settle from on-chain match results — once `settle()` is called, the outcome is irreversible. Stake only what you can afford to lose.
- **AI agent outputs may be inaccurate.** The 60s scoring loop, the regime classifier, and the Claude-generated AI briefs can all be wrong, stale, or biased by the underlying Polymarket liquidity. Treat them as one input, not the truth.
- **18+ only.** Lucarne is a permissionless on-chain protocol but the betting/NFT-minting flows are intended for users 18 years or older. Do not interact if your jurisdiction prohibits parimutuel pools or prediction markets.
- **Self-custodial.** Lucarne never custodies user funds. All transactions are signed by the user's own wallet (OKX Wallet, MetaMask, or any EIP-1193 provider) and broadcast directly to X Layer Mainnet.
- **No artificial volume.** Every pool stake, user bet, and NFT mint linked in this README is an organic, independent on-chain action. The agent does not wash-trade against itself, and there is no protocol-controlled bot inflating pool sizes or NFT counts.
- **No endorsement.** This project is an independent submission to the X Layer X Cup hackathon. It is not endorsed by, affiliated with, or guaranteed by OKX, X Layer, FIFA, Polymarket, or Anthropic.
- **Restricted jurisdictions.** Users are solely responsible for ensuring their use of Lucarne complies with all applicable laws in their jurisdiction.

By interacting with the live frontend or any deployed Lucarne contract you acknowledge the above and accept full responsibility for your own funds and decisions.

---

## Local Development

### Prerequisites
- Node.js 18+
- X Layer Mainnet wallet with OKB

### 1. Deploy Contracts

```bash
cd contracts
npm install
cp .env.example .env  # add PRIVATE_KEY
npx hardhat run scripts/deployMatchResult.ts --network xlayer
npx hardhat run scripts/deploySignalPool.ts  --network xlayer
```

### 2. Run the Agent

```bash
cd agent
npm install
cp .env.example .env  # PRIVATE_KEY, SIGNAL_ATTESTOR, etc.
npm run start         # 60s loop begins
```

### 3. Pre-Kickoff Signal Workflow

```bash
cd contracts

# Compute + attest signal on-chain before kickoff
node scripts/attest-match-signal.js sea-int-bol-2026-05-23

# Open the SignalPool with 0.05 OKB stake
node scripts/stake-pool.js sea-int-bol-2026-05-23

# After FT, write result
node scripts/resolve-match.js sea-int-bol-2026-05-23
```

`gameId` is always `keccak256(slug)` — consistent across all contracts.

### 4. Run the Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

---

## License

MIT
