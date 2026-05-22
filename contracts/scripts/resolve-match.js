/**
 * resolve-match.js
 *
 * Closes the signal loop — writes the actual match result on-chain after kickoff.
 * The MatchResultAttestor contract reads the pre-match signal from MatchSignalAttestor
 * and computes signalCorrect on-chain.
 *
 * Usage:
 *   node scripts/resolve-match.js <slug>
 *
 * Outcomes: 0 = HOME win · 1 = DRAW · 2 = AWAY win
 *
 * Add to RESULTS once the final score is confirmed.
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Load .env
const envPath = resolve(__dirname, "../.env");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch { /* optional */ }

// Load deployed addresses
const deployments = JSON.parse(
  readFileSync(resolve(__dirname, "../deployments.json"), "utf8")
);
const MATCH_RESULT_ATTESTOR = deployments.MatchResultAttestor?.address ?? deployments.MatchResultAttestor;
if (!MATCH_RESULT_ATTESTOR) throw new Error("MatchResultAttestor not in deployments.json");

const ABI = [
  "function resolve(bytes32 gameId, uint8 actualOutcome) external",
  "function isResolved(bytes32 gameId) view returns (bool)",
  "function getResult(bytes32 gameId) view returns (tuple(uint8 actualOutcome, uint8 signalCall, bool signalCorrect, uint40 resolvedAt, address resolver))",
  "function accuracy() view returns (uint256 correct, uint256 total)",
];

// ── Results registry ──────────────────────────────────────────────────────────
//
// actualOutcome: 0 = HOME win · 1 = DRAW · 2 = AWAY win
//
// Add entries here after each match ends. Confirm from reliable source
// (BBC Sport / Transfermarkt) before resolving.
//
// ─────────────────────────────────────────────────────────────────────────────
const RESULTS = {
  // ── UEL Final — SC Freiburg vs Aston Villa — May 20 2026 ─────────────────
  // Result: Aston Villa won (Polymarket settled ast-win at 99.8%)
  // Signal called: AWAY (2) = Aston Villa ✓ CORRECT
  "uel-scf-ast-2026-05-20": {
    label:         "UEL Final — SC Freiburg vs Aston Villa",
    actualOutcome: 2, // AWAY = Aston Villa
    note:          "Aston Villa won the Europa League Final",
  },

  // ── EREDIVISIE PLAYOFF — Ajax vs Groningen — May 21 2026 ─────────────────
  // Uncomment and set actualOutcome once result is confirmed
  // "ned-ere-ajx-grn-2026-05-21": {
  //   label:         "Eredivisie PO — Ajax vs Groningen",
  //   actualOutcome: 0, // HOME = Ajax (99.8% market implies Ajax won)
  //   note:          "Ajax won — confirmed",
  // },

  // ── SERIE A — Fiorentina vs Atalanta — May 22 2026 ───────────────────────
  // Resolve after May 22 19:45 UTC kickoff
  // "sea-fio-ata-2026-05-24": {
  //   label:         "Serie A — Fiorentina vs Atalanta",
  //   actualOutcome: 2, // Set after result confirmed
  //   note:          "",
  // },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeGameId(slug) {
  return ethers.keccak256(ethers.toUtf8Bytes(slug));
}

const OUTCOME_LABEL = ["HOME", "DRAW", "AWAY"];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node scripts/resolve-match.js <slug>");
    console.error("Known slugs:", Object.keys(RESULTS).join(", "));
    process.exit(1);
  }

  const result = RESULTS[slug];
  if (!result) {
    console.error(`Unknown or not-yet-added slug: ${slug}`);
    console.error("Add it to RESULTS in this script after confirming the match result.");
    process.exit(1);
  }

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY not in .env");

  const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
  const wallet   = new ethers.Wallet(privKey.startsWith("0x") ? privKey : "0x" + privKey, provider);
  const contract = new ethers.Contract(MATCH_RESULT_ATTESTOR, ABI, wallet);

  const gameId = encodeGameId(slug);
  console.log(`\n📡 Resolving match`);
  console.log(`   Match   : ${result.label}`);
  console.log(`   gameId  : ${gameId}`);
  console.log(`   Result  : ${OUTCOME_LABEL[result.actualOutcome]} (${result.actualOutcome})`);
  console.log(`   Note    : ${result.note}`);

  // Check already resolved
  const done = await contract.isResolved(gameId);
  if (done) {
    const r = await contract.getResult(gameId);
    console.log(`\n⚠  Already resolved`);
    console.log(`   Actual  : ${OUTCOME_LABEL[r.actualOutcome]}`);
    console.log(`   Signal  : ${OUTCOME_LABEL[r.signalCall]}`);
    console.log(`   Correct : ${r.signalCorrect ? "✓ YES" : "✗ NO"}`);
    const [correct, total] = await contract.accuracy();
    console.log(`   Accuracy: ${correct}/${total}`);
    return;
  }

  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = await contract.resolve(gameId, result.actualOutcome, { nonce });

  console.log(`\n⏳ Tx submitted: ${tx.hash}`);
  const receipt = await tx.wait(1);

  // Read the stored result to confirm signalCorrect
  const stored = await contract.getResult(gameId);
  const [correct, total] = await contract.accuracy();

  console.log(`\n✅ Match resolved!`);
  console.log(`   Tx hash : ${tx.hash}`);
  console.log(`   Block   : ${receipt.blockNumber}`);
  console.log(`   Signal  : ${OUTCOME_LABEL[stored.signalCall]} — Actual: ${OUTCOME_LABEL[stored.actualOutcome]}`);
  console.log(`   Verdict : ${stored.signalCorrect ? "✓ SIGNAL CORRECT" : "✗ SIGNAL WRONG"}`);
  console.log(`   Accuracy: ${correct}/${total} (${total > 0 ? Math.round(Number(correct) * 100 / Number(total)) : 0}%)`);
  console.log(`   OKLink  : https://www.oklink.com/xlayer/tx/${tx.hash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
