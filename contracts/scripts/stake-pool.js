/**
 * stake-pool.js
 *
 * Opens a SignalPool for a club match by having the agent stake native token
 * on the same outcome its signal predicted.
 *
 * Must be run BEFORE kickoff and AFTER:
 *   1. The signal has been attested (attest-match-signal.js)
 *   2. SignalPool has been deployed (deploySignalPool.ts)
 *
 * Usage:
 *   node scripts/stake-pool.js <slug>
 *   node scripts/stake-pool.js uecl-cpa-ray-2026-05-27
 *
 * Add new matches to MATCHES below (copy from attest-match-signal.js).
 * stakeAmount is in OKB (native token on X Layer).
 */

import { ethers } from "ethers";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Load .env
const envPath = resolve(__dirname, "../.env");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch { /* .env optional */ }

// ── Addresses ─────────────────────────────────────────────────────────────────

const deploymentsPath = resolve(__dirname, "../deployments.json");
const deployments     = JSON.parse(readFileSync(deploymentsPath, "utf8"));

const SIGNAL_POOL_ADDR = deployments.SignalPool?.address;
if (!SIGNAL_POOL_ADDR) throw new Error("SignalPool not in deployments.json — deploy it first");

// ── ABI (only what we need) ───────────────────────────────────────────────────

const POOL_ABI = [
  "function agentStake(bytes32 gameId, uint8 outcome, uint256 kickoffTimestamp) external payable",
  "function getPool(bytes32 gameId) view returns (uint256, uint256, uint256, uint256, uint8, bool, bool, uint8)",
  "function isAcceptingBets(bytes32 gameId) view returns (bool)",
  "function deadlines(bytes32 gameId) view returns (uint256)",
];

// ── Match registry ────────────────────────────────────────────────────────────
//
// signalCall must match what was attested in attest-match-signal.js
// stakeAmount: how much OKB the agent stakes (in ether units, e.g. "0.05")
// kickoff: ISO 8601 UTC — used to compute the on-chain deadline

const MATCHES = {
  // ── EREDIVISIE PLAYOFF — Ajax vs Groningen — May 21 2026 ──────────────────
  "ned-ere-ajx-grn-2026-05-21": {
    label:       "Eredivisie PO — Ajax vs Groningen",
    kickoff:     "2026-05-21T19:30:00Z",
    signalCall:  0,     // HOME (Ajax)
    stakeAmount: "0.05",
  },

  // ── SERIE A — Fiorentina vs Atalanta — May 22 2026 ────────────────────────
  "sea-fio-ata-2026-05-24": {
    label:       "Serie A — Fiorentina vs Atalanta",
    kickoff:     "2026-05-22T18:45:00Z",
    signalCall:  2,     // AWAY (Atalanta)
    stakeAmount: "0.05",
  },

  // ── SERIE A — Inter Milan vs Bologna — May 23 2026 ──────────────────────
  "sea-int-bol-2026-05-23": {
    label:       "Serie A — Inter Milan vs Bologna",
    kickoff:     "2026-05-23T18:45:00Z",
    signalCall:  0,     // HOME (Inter)
    stakeAmount: "0.05",
  },

  // ── LA LIGA — Barcelona vs Valencia — May 23 2026 ─────────────────────────
  "lla-bar-val-2026-05-23": {
    label:       "La Liga — Barcelona vs Valencia",
    kickoff:     "2026-05-23T19:00:00Z",
    signalCall:  0,     // HOME (Barcelona)
    stakeAmount: "0.05",
  },

  // ── UEFA Conference League Final — Crystal Palace vs Rayo Vallecano — May 27 2026
  "uecl-cpa-ray-2026-05-27": {
    label:       "UECL Final — Crystal Palace vs Rayo Vallecano",
    kickoff:     "2026-05-27T19:00:00Z",  // 20:00 UK = 19:00 UTC
    signalCall:  0,    // HOME (Crystal Palace) — to be confirmed after odds research
    stakeAmount: "0.05",                  // 0.05 OKB staked by agent
  },

  // ── Add future matches here as signals are attested ──────────────────────
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeGameId(slug) {
  return ethers.keccak256(ethers.toUtf8Bytes(slug));
}

// ── Main ──────────────────────────────────────────────────────────────────────

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/stake-pool.js <slug>");
  console.error("Available slugs:", Object.keys(MATCHES).join(", "));
  process.exit(1);
}

const match = MATCHES[slug];
if (!match) {
  console.error(`Unknown slug: "${slug}". Add it to MATCHES in this script first.`);
  process.exit(1);
}

const rpcUrl    = process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech";
const privKey   = process.env.PRIVATE_KEY;
if (!privKey) throw new Error("PRIVATE_KEY not set in .env");

const provider  = new ethers.JsonRpcProvider(rpcUrl);
const wallet    = new ethers.Wallet(privKey, provider);
const pool      = new ethers.Contract(SIGNAL_POOL_ADDR, POOL_ABI, wallet);

const gameId       = encodeGameId(slug);
const kickoffTs    = Math.floor(new Date(match.kickoff).getTime() / 1000);
const stakeWei     = ethers.parseEther(match.stakeAmount);
const outcomeNames = ["HOME", "DRAW", "AWAY"];

async function main() {
  console.log(`\n── Stake Pool: ${match.label} ──────────────────────────`);
  console.log(`Slug          : ${slug}`);
  console.log(`Game ID       : ${gameId}`);
  console.log(`SignalPool    : ${SIGNAL_POOL_ADDR}`);
  console.log(`Agent wallet  : ${wallet.address}`);
  console.log(`Kickoff       : ${match.kickoff} (ts: ${kickoffTs})`);
  console.log(`Signal call   : ${outcomeNames[match.signalCall]}`);
  console.log(`Stake amount  : ${match.stakeAmount} OKB`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet balance: ${ethers.formatEther(balance)} OKB`);

  if (balance < stakeWei) {
    console.error(`\n❌ Insufficient balance — need at least ${match.stakeAmount} OKB`);
    process.exit(1);
  }

  // Check if pool already open
  const [,,,agentStakeAmt,,isOpen] = await pool.getPool(gameId);
  if (isOpen) {
    console.log(`\n⚠️  Pool already open for this game (agentStake = ${ethers.formatEther(agentStakeAmt)} OKB)`);
    process.exit(0);
  }

  const now = Math.floor(Date.now() / 1000);
  if (kickoffTs <= now) {
    console.error(`\n❌ Kickoff timestamp is in the past — cannot open pool after kickoff`);
    process.exit(1);
  }

  // Fetch pending nonce to avoid nonce-too-low on X Layer
  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log(`\nNonce (pending): ${nonce}`);
  console.log(`Sending agentStake tx...`);

  const tx = await pool.agentStake(gameId, match.signalCall, kickoffTs, {
    value: stakeWei,
    nonce,
    gasLimit: 200_000,
  });

  console.log(`Tx hash        : ${tx.hash}`);
  console.log(`Waiting for confirmation...`);
  const receipt = await tx.wait();
  console.log(`✅ Confirmed in block ${receipt.blockNumber}`);

  // Read back pool state
  const [home, draw, away, agentStk,, open] = await pool.getPool(gameId);
  console.log(`\nPool state:`);
  console.log(`  HOME bucket : ${ethers.formatEther(home)} OKB`);
  console.log(`  DRAW bucket : ${ethers.formatEther(draw)} OKB`);
  console.log(`  AWAY bucket : ${ethers.formatEther(away)} OKB`);
  console.log(`  Agent stake : ${ethers.formatEther(agentStk)} OKB`);
  console.log(`  Open        : ${open}`);
  console.log(`\n📡 Pool is now live — users can bet at ${SIGNAL_POOL_ADDR}`);
  console.log(`   OKLink: https://www.oklink.com/xlayer/tx/${tx.hash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
