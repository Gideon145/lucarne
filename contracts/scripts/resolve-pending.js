/**
 * resolve-pending.js
 *
 * One-shot helper to close the signal loop for the 4 matches that were signal-
 * attested but never resolved on-chain (so /track-record shows the true
 * scoreline instead of 1/1).
 *
 * Reads gameId directly from each signal tx's calldata — no slug guessing.
 *
 * Usage:
 *   node scripts/resolve-pending.js          # resolve all pending
 *   node scripts/resolve-pending.js dry      # show what would be resolved
 *
 * Requires PRIVATE_KEY of the MatchResultAttestor owner in ../.env
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve as resolvePath } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Load .env
try {
  for (const line of readFileSync(resolvePath(__dirname, "../.env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch { /* optional */ }

const deployments = JSON.parse(
  readFileSync(resolvePath(__dirname, "../deployments.json"), "utf8")
);
const MATCH_RESULT_ATTESTOR =
  deployments.MatchResultAttestor?.address ?? deployments.MatchResultAttestor;
if (!MATCH_RESULT_ATTESTOR) throw new Error("MatchResultAttestor not in deployments.json");

const ABI = [
  "function resolve(bytes32 gameId, uint8 actualOutcome) external",
  "function isResolved(bytes32 gameId) view returns (bool)",
  "function getResult(bytes32 gameId) view returns (tuple(uint8 actualOutcome, uint8 signalCall, bool signalCorrect, uint40 resolvedAt, address resolver))",
  "function accuracy() view returns (uint256 correct, uint256 total)",
];

// outcome: 0 = HOME · 1 = DRAW · 2 = AWAY
const PENDING = [
  {
    label:   "Eredivisie PO — Ajax vs Groningen",
    gameId:  "0xe055f62b2b266bf46db7c04a4cb083e1cd169e103c8c8dff960d34e05420c4a4",
    outcome: 0, // Ajax win
    note:    "Ajax won — signal called HOME (correct)",
  },
  {
    label:   "Serie A — Fiorentina vs Atalanta",
    gameId:  "0x24ba1da38dccf3520be37c13283e854e5d1f2605a1f01f983193f41d58372e89",
    outcome: 1, // 0-0 draw
    note:    "0-0 draw — signal called AWAY (wrong, agent stake forfeited)",
  },
  {
    label:   "DFB Pokal Final — Bayern Munich vs Stuttgart",
    gameId:  "0x844d508ea2b7fa3dae588dfed6d809995b04f5729d7595a20f011fd3b841d528",
    outcome: 0, // Bayern 3-0
    note:    "Bayern 3-0 — signal called HOME (correct)",
  },
  {
    label:   "La Liga — Real Madrid vs Athletic Club",
    gameId:  "0x2411ce7f1f9d924781472689184677c1a3c57703b61f51c55752f713d997a0c0",
    outcome: 0, // Real Madrid 4-2
    note:    "Real Madrid 4-2 — signal called HOME (correct)",
  },
];

const OUTCOME_LABEL = ["HOME", "DRAW", "AWAY"];

async function main() {
  const dryRun = process.argv[2] === "dry";

  const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");

  let wallet, contract;
  if (!dryRun) {
    const privKey = process.env.PRIVATE_KEY;
    if (!privKey) throw new Error("PRIVATE_KEY not in .env");
    wallet   = new ethers.Wallet(privKey.startsWith("0x") ? privKey : "0x" + privKey, provider);
    contract = new ethers.Contract(MATCH_RESULT_ATTESTOR, ABI, wallet);
  } else {
    contract = new ethers.Contract(MATCH_RESULT_ATTESTOR, ABI, provider);
  }

  for (const m of PENDING) {
    console.log(`\n── ${m.label} ──`);
    console.log(`   gameId : ${m.gameId}`);
    console.log(`   actual : ${OUTCOME_LABEL[m.outcome]}`);
    console.log(`   note   : ${m.note}`);

    const done = await contract.isResolved(m.gameId);
    if (done) {
      console.log(`   status : ⚠ already resolved — skipping`);
      continue;
    }

    if (dryRun) {
      console.log(`   status : would resolve (dry-run, no tx sent)`);
      continue;
    }

    const nonce = await provider.getTransactionCount(wallet.address, "pending");
    const tx = await contract.resolve(m.gameId, m.outcome, { nonce });
    console.log(`   tx     : ${tx.hash}`);
    const rcpt = await tx.wait(1);
    const r = await contract.getResult(m.gameId);
    console.log(`   block  : ${rcpt.blockNumber}`);
    console.log(`   signal : ${OUTCOME_LABEL[r.signalCall]} vs actual ${OUTCOME_LABEL[r.actualOutcome]} → ${r.signalCorrect ? "✓ HIT" : "✗ MISS"}`);
  }

  const [correct, total] = await contract.accuracy();
  const pct = total > 0n ? Number((correct * 100n) / total) : 0;
  console.log(`\n📊 Final accuracy: ${correct}/${total} (${pct}%)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
