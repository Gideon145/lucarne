# Lucarne — Judge Guide

> Independent verification path for the X Layer X Cup Hackathon. **No wallet required.** Every step in this document either runs in a browser, in a single curl command, or on the public OKLink explorer. Allow ~5 minutes for the full walkthrough.

---

## 0. Open the Judge Surface

[https://frontend-sigma-two-60.vercel.app/judge](https://frontend-sigma-two-60.vercel.app/judge)

One page. Live lifetime nonce read directly from `eth_getTransactionCount` on X Layer Mainnet. Every contract address and every proof tx hash links straight to OKLink.

If the page renders a number (currently 14,000+), the agent is live and we have already passed the most important verification.

---

## 1. Confirm the Agent Is Actually Running (30 seconds)

```bash
curl -X POST https://rpc.xlayer.tech \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionCount","params":["0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3","latest"]}'
```

The returned hex is the **lifetime confirmed transaction count** for the agent wallet. Convert to decimal — you should see a number above 14,000.

This single check defeats every "AI agent" submission that runs in a demo container. Lucarne writes to mainnet every meaningful cycle, and the chain remembers.

---

## 2. Watch a Brand-New Transaction Land (60 seconds)

Open the agent wallet on OKLink:

[https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3](https://www.oklink.com/xlayer/address/0xC8D92Bfd397A7ccaaf6B44466F2951070A3947C3)

Refresh after ~60 seconds. A new `attest()` transaction (`SignalAttestor.attest(bytes3 country, uint8 score, uint8 regime, bytes32 signalHash)`) will appear. Click it — the decoded input shows the live country signal that was just written.

---

## 3. Verify the Pipeline End-to-End on a Real Match

The full lifecycle (signal → on-chain attestation → community vote → agent-bonded pool → user bet → settlement → soulbound NFT) was exercised on five real club matches between May 20 and May 23, 2026. Pick any row from the Pipeline Validation table in [README.md](./README.md#pipeline-validation-live-club-football-stress-test-may-2023-2026) and follow the hash.

The most instructive single example is the **UEL Final** (Freiburg vs Aston Villa, May 20):

| Stage | Tx Hash |
|---|---|
| Pre-kickoff signal lock (HOME · Villa) | [`0x4e98f3c0…`](https://www.oklink.com/xlayer/tx/0x4e98f3c011ad8c512acc61805550658208370674dd82b8d3820706384aa33f65) |
| Full-time result resolution (Villa win) | [`0x48de5700…`](https://www.oklink.com/xlayer/tx/0x48de570075c862184c854d2ad0ca4c8ea2666808fb05e1e55310368968cd9467) |

Click the resolve hash → decoded input shows `actualOutcome = 0` (HOME) and the `MatchResultAttestor` contract automatically computed `signalCorrect = true` against the prior signal lock. This is the entire "did we call it?" question, settled on-chain, by code.

---

## 4. Verify the Honest Loss

We do not hide losses. The Fiorentina vs Atalanta pool was an **agent loss** — Lucarne staked 0.05 OKB on AWAY (Atalanta), the match drew 0-0, the stake is gone.

| Stage | Tx Hash |
|---|---|
| Pre-kickoff signal (AWAY · Atalanta) | [`0x6983a191…`](https://www.oklink.com/xlayer/tx/0x6983a19169803ad0a03355586d289c1b644d31802ae0ae7f297eff8b50f504d5) |
| Agent stake (0.05 OKB on AWAY) | [`0x291c672c…`](https://www.oklink.com/xlayer/tx/0x291c672c3e3af5ee96ccf4e1ef5fa43258399f1876ef2a805b05e2b256b0b002) |
| First user counterparty bet (0.01 OKB) | [`0x9176860e…`](https://www.oklink.com/xlayer/tx/0x9176860e7fe9c53142ef399f316fa7a988e8b8219c3c58dcd2658060c2e3da81) |

The pool/settlement code works in adversarial conditions — that is the most important property of a betting protocol, and the only way to prove it is to lose money on chain.

---

## 5. Inspect the Smart Contracts (X Layer Mainnet, Chain 196)

| Contract | Address | Purpose |
|---|---|---|
| `SignalAttestor` | [`0x2Dcbd501…0FAe81`](https://www.oklink.com/xlayer/address/0x2Dcbd50173bB570BB5257223bfDb6b92520FAe81) | 32-nation scoreboard; every 60s agent write |
| `MatchSignalAttestor` | [`0x9693d19C…018482`](https://www.oklink.com/xlayer/address/0x9693d19C09d9dE08F4acaD288f7608552D018482) | Pre-kickoff match signal lock |
| `MatchResultAttestor` | [`0x81AF1dfF…855377bF`](https://www.oklink.com/xlayer/address/0x81AF1dfF7D92ac333a785a1486822159855377bF) | FT outcome + on-chain `signalCorrect` verdict |
| `SignalPool v2` | [`0xEe15Dc83…12ccEa67`](https://www.oklink.com/xlayer/address/0xEe15Dc83cD4AcD16D8698831d468B1FE12ccEa67) | Parimutuel pool with `reclaimNoWinner` |
| `ICalledItNFT v2` | [`0xBC2200d9…96F0adf`](https://www.oklink.com/xlayer/address/0xBC2200d99980661fef938eE72001BAaE496F0adf) | Soulbound proof NFT |
| `LucarnePredictions` | [`0x17856591…6Df6E7`](https://www.oklink.com/xlayer/address/0x178565919FFebC4b57ca04112d0FFFaD946Df6E7) | Community-vote prediction market |

Source code lives in [`contracts/contracts/`](./contracts/contracts).

---

## 6. Verify the OKX OnchainOS Skill Integrations

| Skill | Where to look |
|---|---|
| **`okx-agent-payments-protocol`** (x402) | [`polybot/server.py`](./polybot/server.py) — search for `X402_NETWORK = "xlayer-mainnet"`, `make_402_payload`, `verify_x402_payment`. Paid AI briefs return HTTP 402 with the x402 challenge, then 200 once payment is presented |
| **`okx-dapp-discovery`** (Polymarket plugin) | [`polybot/server.py`](./polybot/server.py) — `POLYMARKET_IDS` (all 32 nations) + `WC_FIXTURES` (group-stage fixture schedule) |
| **`okx-onchain-gateway`** | [`agent/src/lib/signal.ts`](./agent/src/lib/signal.ts) — every contract write goes through `https://rpc.xlayer.tech` with pending-nonce refetch on each tx |
| **`okx-agentic-wallet`** (pattern) | Agent wallet `0xC8D9…47C3` operates autonomously on a 60-second cadence with no human-in-the-loop — 14k+ tx, signal-driven write gate |

---

## 7. Confirm Frontend Live State

| Page | URL |
|---|---|
| Live HUD | [https://frontend-sigma-two-60.vercel.app](https://frontend-sigma-two-60.vercel.app) |
| Judge surface | [https://frontend-sigma-two-60.vercel.app/judge](https://frontend-sigma-two-60.vercel.app/judge) |
| Leaderboard | [https://frontend-sigma-two-60.vercel.app/leaderboard](https://frontend-sigma-two-60.vercel.app/leaderboard) |
| Per-match HUD | [https://frontend-sigma-two-60.vercel.app/match/sea-int-bol-2026-05-23](https://frontend-sigma-two-60.vercel.app/match/sea-int-bol-2026-05-23) |

Click any nation card on the HUD to open the Intel Drawer and trigger the x402-gated paid AI brief flow.

---

## 8. Scoring Crosswalk

Hackathon brief asks judges to score on **Innovation · Market Potential · Completion · On-chain data · Code quality**. The corresponding evidence in Lucarne:

| Criterion | Strongest single proof |
|---|---|
| Innovation | Agent that **stakes OKB on its own match calls** before kickoff, plus a soulbound proof NFT for users who call the outcome correctly — none of the standard agent submissions ship economic bonding |
| Market Potential | World Cup 2026 (5B viewers); 32 nations already wired into the agent loop on mainnet; share-to-X buttons + public leaderboard close the social-virality gap |
| Completion | 14,000+ confirmed mainnet tx; 5-game pipeline stress test in 4 days; `/judge` + `/leaderboard` + `JUDGE_GUIDE.md` shipped before submission |
| On-chain data | 7 contracts, 6 on the live `/judge` panel, every proof hash linked, OKLink-verifiable in one click |
| Code quality | Solidity 0.8.24, TypeScript ESM, Hardhat v3, Next.js 14 App Router, single `contracts/deployments.json` source of truth for every address consumed by both agent and frontend |

---

## 9. Anything Unclear?

Open an issue on [GitHub](https://github.com/Gideon145/lucarne) or ping [@lucarne_xyz](https://x.com/lucarne_xyz). Every transaction in this document is permanent — if any link breaks, the chain hasn't moved, our README has.
