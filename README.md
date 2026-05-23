# Lucarne

**Stake-bonded on-chain football signal intelligence.**

Lucarne is an AI agent that stakes OKB on its own football predictions before every kickoff. Every signal is attested immutably on X Layer mainnet before the whistle blows — then settled trustlessly from on-chain results after full time. Users can bet against the agent or alongside it. The agent's confidence is bonded by real value it stands to lose.

> Built for the X Layer X Cup Hackathon · May 19–28 2026 · 14,000 USDT prize pool

**Live:** https://frontend-sigma-two-60.vercel.app  
**Chain:** X Layer Mainnet (chainId 196)

---

## How It Works

```
1. Signal computed   →  homeProb · drawProb · awayProb · signalScore · signalCall
2. Attested on-chain →  MatchSignalAttestor.attest(gameId, ...) — immutable before kickoff
3. Agent stakes OKB  →  SignalPool.agentStake(gameId, outcome, kickoffTimestamp)
4. Pool opens        →  Users bet against or with the agent until kickoff
5. Result resolved   →  MatchResultAttestor.resolve(gameId, actualOutcome) after FT
6. Pool settles      →  settle(gameId) distributes pot to winning bucket proportionally
7. Winners claim     →  claim(gameId) — or reclaimNoWinner() if no one bet on the outcome
8. NFT minted        →  ICalledItNFT.mint(gameId) — soulbound proof for winning bettors
```

**Key property:** The agent is a participant, not a house. If Lucarne's signal is wrong, its OKB stake flows to the bettors who got it right. Every signal is economically bonded.

---

## Deployed Contracts (X Layer Mainnet · chainId 196)

| Contract | Address | Purpose |
|---|---|---|
| `MatchSignalAttestor` | `0x9693d19C09d9dE08F4acaD288f7608552D018482` | Records pre-kickoff signal: probabilities, confidence score, directional call |
| `MatchResultAttestor` | `0x81AF1dfF7D92ac333a785a1486822159855377bF` | Records FT result on-chain; computes whether signal call was correct |
| `SignalPool` (v2) | `0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67` | Parimutuel pool — agent stakes, users bet, settled from result |
| `ICalledItNFT` (v2) | `0xBC2200d99980661fef938eE72001BAaE496F0adf` | Soulbound ERC721 — minted by bettors who called the outcome correctly |

Agent wallet: `0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3`  
Explorer: https://www.oklink.com/xlayer

---

## Signal Track Record (Hackathon Window)

| Game | Date | Signal | Result | Verdict |
|---|---|---|---|---|
| Chelsea vs Atletico (UEL Final) | May 20 | HOME (Chelsea) | Chelsea win | ✓ CORRECT |
| Ajax vs Groningen (Eredivisie PO) | May 21 | HOME (Ajax) | — | pending |
| Fiorentina vs Atalanta (Serie A) | May 22 | AWAY (Atalanta win) | 0-0 draw | ✗ WRONG |
| Inter Milan vs Bologna (Serie A) | May 23 | HOME (Inter) | — | pending |
| Barcelona vs Valencia (La Liga) | May 23 | HOME (Barcelona) | — | pending |

Every signal is locked on-chain before kickoff with a transaction hash. Bad calls are not buried — the ledger is permanent.

---

## Contract Design

### MatchSignalAttestor
Stores per-game signals keyed by `keccak256(slug)`:
```
homeWinProb  · drawProb  · awayWinProb   (basis points, sum ~10000)
signalScore                               (0–100 confidence)
signalCall                                (0=HOME · 1=DRAW · 2=AWAY)
dataHash                                  (keccak of raw input data, provenance)
```
Called by the agent wallet before kickoff. Immutable after attestation.

### MatchResultAttestor
Called after full time. Records `actualOutcome` and computes `signalCorrect` by comparing against the stored `signalCall` in MatchSignalAttestor.

### SignalPool
Parimutuel pool with three buckets: HOME, DRAW, AWAY.

- `agentStake(gameId, outcome, kickoffTimestamp)` — agent opens pool, commits stake  
- `bet(gameId, outcome)` — users stake OKB on any outcome, only before kickoff  
- `settle(gameId)` — anyone calls after result is on-chain; sets `winOutcome`  
- `claim(gameId)` — winners claim proportional share of the entire pot  
- `reclaimNoWinner(gameId, outcome)` — if the winning bucket is empty (no counterparty), stakers reclaim their own stake. Prevents funds being permanently locked when a niche outcome hits with no bettors.

Payout formula: `payout = (userStake × totalPot) / winningBucket`

### ICalledItNFT
Soulbound ERC721. One mint per wallet per game. No transfers. Minted after settlement by bettors who staked on the winning outcome — on-chain proof that you called it.

---

## Repository Structure

```
lucarne/
├── contracts/          Solidity 0.8.24 · Hardhat v3 · TypeScript ESM
│   ├── contracts/
│   │   ├── MatchSignalAttestor.sol
│   │   ├── MatchResultAttestor.sol
│   │   ├── SignalPool.sol
│   │   └── ICalledItNFT.sol
│   ├── scripts/
│   │   ├── attest-match-signal.js   # agent: computes + attests signal before kickoff
│   │   ├── stake-pool.js            # agent: opens SignalPool with OKB stake
│   │   ├── resolve-match.js         # agent: records FT result on-chain
│   │   ├── deploySignalPool.ts      # deploys SignalPool + ICalledItNFT
│   │   └── deployMatchResult.ts     # deploys MatchResultAttestor
│   └── deployments.json             # live contract addresses + tx hashes
│
├── frontend/           Next.js 14 App Router · Viem · TypeScript
│   ├── app/
│   ├── components/
│   │   ├── LiveMatchPanel.tsx       # match tabs, signal intel, expanded analysis
│   │   └── BetPanel.tsx             # pool UI — stake, claim, settle, mint NFT
│   └── lib/
│       ├── constants.ts             # contract addresses, chain config
│       └── utils.ts
│
├── agent/              Signal computation + attestation engine (Node.js)
└── polybot/            X / Telegram posting bot
```

---

## Running Scripts

All scripts are in `contracts/scripts/`. Requires `.env` with `PRIVATE_KEY`.

```bash
# Attest a pre-match signal before kickoff
node scripts/attest-match-signal.js sea-int-bol-2026-05-23

# Open the betting pool (agent stakes OKB)
node scripts/stake-pool.js sea-int-bol-2026-05-23

# Record FT result on-chain after the match
node scripts/resolve-match.js sea-int-bol-2026-05-23

# Recover funds when no one bet on the winning outcome (v2 only)
# node reclaim-no-winner.js <gameId> <outcome>
```

gameId is always `keccak256(slug)` — consistent across all contracts.

---

## Frontend

Live at: https://frontend-sigma-two-60.vercel.app

- Match tabs with signal intel, pre-match probability breakdown, WHY section
- BetPanel: live pool state from chain, bet against/with the agent, countdown to kickoff
- Post-kickoff: Settle button, Claim button, ICalledIt NFT mint
- Resolved games: full result card — CORRECT / WRONG signal verdict, on-chain proof links
- Wallet: injected (MetaMask / OKX Wallet), no backend required

---

## Tech Stack

| Layer | Tech |
|---|---|
| Chain | X Layer Mainnet · chainId 196 · OKB native token |
| Contracts | Solidity 0.8.24 · OpenZeppelin ERC721 · Hardhat v3 |
| Frontend | Next.js 14 · Viem · TypeScript · App Router |
| Signal data | Polymarket probabilities (attested via MatchSignalAttestor) |
| Deployment | Vercel (frontend) · X Layer RPC direct (contracts) |

---

## Why X Layer

OKB as native gas enables micro-stakes that are economically meaningful without being prohibitive. X Layer's EVM compatibility means all standard tooling works — Hardhat, Viem, MetaMask — while the OKX ecosystem gives direct access to a large base of users already holding OKB.

The agent's skin-in-the-game model only works on a chain where:
1. Gas is cheap enough that attesting every signal on-chain is practical
2. The staked token has real market value
3. Settlement can happen trustlessly from on-chain oracle data

X Layer checks all three.
