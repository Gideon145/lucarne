# Lucarne

**Real-time on-chain intelligence terminal for the 2026 FIFA World Cup.**

> *"Every signal staked. Every call attested. The ledger doesn't lie."*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-frontend--sigma--two--60.vercel.app-cyan)](https://frontend-sigma-two-60.vercel.app)
[![Agent Wallet](https://img.shields.io/badge/Agent%20Wallet-0xC8D9...47C3-green)](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3)
[![X Layer Mainnet](https://img.shields.io/badge/Chain-X%20Layer%20Mainnet%20196-brightgreen)](https://www.oklink.com/xlayer)
[![Loop Interval](https://img.shields.io/badge/Loop-60s-orange)](#what-the-agent-actually-does-every-60-seconds)
[![Nations Scored](https://img.shields.io/badge/Nations-32%20World%20Cup%202026-blue)](#)

---

## What Is Lucarne?

Lucarne is an autonomous AI agent that scores all **32 World Cup 2026 nations 0–100 every 60 seconds** and writes each score as a cryptographic attestation directly to **X Layer Mainnet (Chain ID 196)** — immutable, timestamped, verifiable by anyone with a block explorer.

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
| **Frontend (Live HUD)** | https://frontend-sigma-two-60.vercel.app | Live |
| **Agent Wallet (all tx)** | https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3 | 14,000+ tx |
| **SignalAttestor (32 nations)** | https://www.oklink.com/xlayer/address/0x2Dcbd50173bB570BB5257223bfDb6b92520FAe81 | Mainnet |
| **MatchSignalAttestor** | https://www.oklink.com/xlayer/address/0x9693d19C09d9dE08F4acaD288f7608552D018482 | Mainnet |
| **MatchResultAttestor** | https://www.oklink.com/xlayer/address/0x81AF1dfF7D92ac333a785a1486822159855377bF | Mainnet |
| **SignalPool v2** | https://www.oklink.com/xlayer/address/0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67 | Mainnet |
| **ICalledItNFT v2** | https://www.oklink.com/xlayer/address/0xBC2200d99980661fef938eE72001BAaE496F0adf | Mainnet |
| **LucarnePredictions** | https://www.oklink.com/xlayer/address/0x178565919FFebC4b57ca04112d0FFFaD946Df6E7 | Mainnet |

The agent wallet has **over 14,000 confirmed transactions** on X Layer Mainnet — every one of them either a country score attestation, a match signal, a pool stake, or a settlement call. That is the proof. It cannot be faked.

---

## Signal Track Record (Live, On-Chain)

Every signal below is a transaction on X Layer Mainnet. Click any tx hash to verify on OKLink. Signal locked **before kickoff** in every case.

| Game | Date | Signal Call | Signal Tx | Result | Result Tx |
|---|---|---|---|---|---|
| **UEL Final** — SC Freiburg vs Aston Villa | May 20 | HOME (Aston Villa) | [`0x4e98f3c0...`](https://www.oklink.com/xlayer/tx/0x4e98f3c011ad8c512acc61805550658208370674dd82b8d3820706384aa33f65) | Aston Villa win — CORRECT | [`0x48de5700...`](https://www.oklink.com/xlayer/tx/0x48de570075c862184c854d2ad0ca4c8ea2666808fb05e1e55310368968cd9467) |
| **Eredivisie PO** — Ajax vs Groningen | May 21 | HOME (Ajax) @ 99.8% | [`0x38e3c6cd...`](https://www.oklink.com/xlayer/tx/0x38e3c6cd2e8abe7833839b0840c1ab8bda5afb33ea52879483288fb9dfd62daa) | Ajax win — pending resolve | — |
| **Serie A** — Fiorentina vs Atalanta | May 22 | AWAY (Atalanta) | [`0x6983a191...`](https://www.oklink.com/xlayer/tx/0x6983a19169803ad0a03355586d289c1b644d31802ae0ae7f297eff8b50f504d5) | 0-0 draw — WRONG | pending resolve |
| **Serie A** — Inter Milan vs Bologna | May 23 | HOME (Inter) @ 65% | [`0x81ad7e71...`](https://www.oklink.com/xlayer/tx/0x81ad7e719a192354a2f76d460b83d95110607031c1571ca72692d106cbfeb0d7) | pending FT | — |
| **La Liga** — Barcelona vs Valencia | May 23 | HOME (Barcelona) @ 68% | [`0xeec67755...`](https://www.oklink.com/xlayer/tx/0xeec67755b145f961c35bfbf93c80a5b52232abcea71716e4ed1eb1f3555c29e5) | pending FT | — |

**Current record: 1 correct · 1 wrong · 3 pending.** The wrong call cost Lucarne 0.05 OKB — locked in the SignalPool, gone. That is the system working as designed.

---

## On-Chain Pool & Settlement Activity (Verifiable)

| Action | Tx Hash | Detail |
|---|---|---|
| **Agent stake** — Fiorentina/Atalanta pool opened (AWAY · 0.05 OKB) | [`0x291c672c...`](https://www.oklink.com/xlayer/tx/0x291c672c3e3af5ee96ccf4e1ef5fa43258399f1876ef2a805b05e2b256b0b002) | First SignalPool stake |
| **First user bet** — 0.01 OKB on AWAY (Fiorentina/Atalanta) | [`0x9176860e...`](https://www.oklink.com/xlayer/tx/0x9176860e7fe9c53142ef399f316fa7a988e8b8219c3c58dcd2658060c2e3da81) | Pool received its first counterparty bet |
| **Agent stake** — Inter/Bologna pool (HOME · 0.05 OKB) | [`0xe2bd4b93...`](https://www.oklink.com/xlayer/tx/0xe2bd4b93051056ba9638048e776d8b54336e5816a4733edddf7ed53bee860f7f) | Pool live for users |
| **Agent stake** — Barcelona/Valencia pool (HOME · 0.05 OKB) | [`0x54e2e03f...`](https://www.oklink.com/xlayer/tx/0x54e2e03f4e8196424c17df2a4aa56a680089ff3484dda4fc1fdb658b559f4b40) | Pool live for users |
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
|  | 32 Nation Grid |  |  | SignalEngine   |  |                                   |
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
// Step 1: For each of 32 World Cup nations
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
The 32-nation scoreboard. The agent writes here every 60 seconds when a country's score moves >3 points or 4 hours pass without a write.

```solidity
function attest(bytes3 country, uint8 score, uint8 regime, bytes32 signalHash) external
function totalAttestations() external view returns (uint256)
```

### MatchSignalAttestor.sol — `0x9693d19C...018482`
Pre-kickoff match signal lock. Records `homeProb`, `drawProb`, `awayProb` (basis points), `signalScore` (0–100 confidence), `signalCall` (HOME/DRAW/AWAY), and `dataHash` (provenance of input data). Called by the agent before the whistle blows.

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
| **Gas Token** | OKB native — cheap enough to attest 32 nations every 60s |
| **Signal Data** | Polymarket probabilities (the live odds source for every football market) |
| **AI Briefs** | Claude (Anthropic) via **x402 HTTP micropayment protocol** on **OKX Onchain OS** |
| **Wallet** | OKX Wallet + MetaMask (injected provider, EIP-1193) |
| **Explorer** | OKLink (`oklink.com/xlayer`) — every tx hash in this README resolves there |

OKB as native gas is what makes the 60-second loop economically viable. Attesting 32 country scores every minute on Ethereum L1 would cost thousands of dollars per day. On X Layer it costs cents. That's why Lucarne can exist.

---

## Repository Structure

```
lucarne/
├── agent/                   Autonomous scoring agent (Node.js / TypeScript)
│   └── src/
│       ├── index.ts         60s loop: score 32 nations, write to chain
│       └── lib/
│           ├── signal.ts    Polymarket + form -> 0..100 score + regime
│           ├── outcome.ts   Resolves matches, writes outcomes on-chain
│           └── logger.ts
│
├── contracts/               Solidity 0.8.24 · Hardhat v3 · TypeScript ESM
│   ├── contracts/
│   │   ├── SignalAttestor.sol           # 32-nation scoreboard
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

## Why This Wins

**1. The agent is running right now.** Not in a demo container. Not behind a "click here to start." On X Layer Mainnet, every 60 seconds, 32 countries, 14,000+ confirmed transactions in the agent wallet. Click the link, see the tx count.

**2. Every claim is on-chain verifiable.** This README has 12+ tx hash links above. Every single one resolves on OKLink. Open OKX Wallet, switch to X Layer, paste any address — it's all there.

**3. Skin in the game.** The agent doesn't just predict — it stakes OKB on every match call before kickoff. When it gets one wrong (Fiorentina/Atalanta), that OKB is gone. Real money, real consequences, real signal quality discipline.

**4. World Cup timing.** Built specifically for the 2026 FIFA World Cup. 32 nations already wired into the agent loop. As group-stage matches begin, the infrastructure is already in production — no migration, no scramble.

**5. Full OKX stack usage.** X Layer Mainnet for every contract. OKB for gas + stakes. Polymarket for data. OKX Onchain OS + x402 for paid AI briefs. OKLink for proof. This is what an OKX-native dApp looks like.

**6. Composable primitives.** `MatchSignalAttestor` is independent of `SignalPool` is independent of `ICalledItNFT`. Any of them can be reused by other dApps. We aren't building a closed silo — we're shipping public goods.

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
