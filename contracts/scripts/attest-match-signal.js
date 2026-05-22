/**
 * attest-match-signal.js
 *
 * Writes one immutable pre-kickoff signal to MatchSignalAttestor for a club match.
 *
 * Usage:
 *   node scripts/attest-match-signal.js <slug>
 *
 * Signal formula:  score = odds×0.55 + gate×0.30 + form×0.15
 * dataHash:        keccak256(abi.encode(slug, homeProb, drawProb, awayProb,
 *                              homeFormScore, awayFormScore))
 *
 * Add new matches to MATCHES below before kickoff.
 */

import { ethers } from "ethers";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Load .env manually (dotenv ESM workaround)
const envPath = resolve(__dirname, "../.env");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch { /* .env optional */ }

// ── Contract ─────────────────────────────────────────────────────────────────

const MATCH_SIGNAL_ATTESTOR = "0x9693d19C09d9dE08F4acaD288f7608552D018482";

const ABI = [
  "function attest(bytes32 gameId, uint8 homeProb, uint8 drawProb, uint8 awayProb, uint8 signalScore, uint8 signalCall, bytes32 dataHash) external",
  "function hasSignal(bytes32 gameId) view returns (bool)",
  "function getSignal(bytes32 gameId) view returns (tuple(uint8 homeProb, uint8 drawProb, uint8 awayProb, uint8 signalScore, uint8 signalCall, bytes32 dataHash, uint40 attestedAt, address attester))",
];

// ── Match registry ────────────────────────────────────────────────────────────
//
// signalScore and signalCall are derived from the formula — pre-computed here
// so the script is purely a write operation (no live data fetches).
//
// signalCall: 0 = HOME · 1 = DRAW · 2 = AWAY
//
// dataHash pre-image (for independent verification):
//   keccak256(abi.encode(slug, homeProb, drawProb, awayProb, homeFormScore, awayFormScore))
//
// Form scores used:
//   Fiorentina: 40  (W3 D1 L1 last 5, 5th place run-in pressure)
//   Atalanta:   33  (W2 D2 L1 last 5, 7th place Europa/Conf fight)
//
// Signal formula outputs:
//   HOME (Fiorentina): 33×0.55 + 38×0.30 + 40×0.15 = 18.15+11.40+6.00 = 35.55 → 35
//   DRAW:              25×0.55 + 25×0.30 + 25×0.15 = 13.75+7.50+3.75  = 25.00 → 25
//   AWAY (Atalanta):   42×0.55 + 37×0.30 + 33×0.15 = 23.10+11.10+4.95 = 39.15 → 39
//
// ────────────────────────────────────────────────────────────────────────────
const MATCHES = {
  // ── UEL FINAL — Villarreal vs Freiburg — May 20 2026 ─────────────────────
  "uel-scf-ast-2026-05-20": {
    label:         "UEL Final — Villarreal vs Freiburg",
    kickoff:       "2026-05-20T20:00:00Z",
    homeProb:      17,   // Villarreal market %
    drawProb:      24,   // Draw market %
    awayProb:      59,   // Freiburg market % (favourites)
    homeFormScore: 45,   // Villarreal: good UEL run
    awayFormScore: 52,   // Freiburg: dominant form
    // AWAY favoured: 59×0.55 + 55×0.30 + 52×0.15 = 32.45+16.50+7.80 = 56.75 → 57
    signalScore:   57,
    signalCall:    2,    // AWAY (Freiburg)
  },

  // ── EREDIVISIE PLAYOFF — Ajax vs Groningen — May 21 2026 ─────────────────
  "ned-ere-ajx-grn-2026-05-21": {
    label:         "Eredivisie PO — Ajax vs Groningen",
    kickoff:       "2026-05-21T19:30:00Z",
    homeProb:      51,
    drawProb:      24,
    awayProb:      25,
    homeFormScore: 44,
    awayFormScore: 30,
    // HOME favoured: 51×0.55 + 47×0.30 + 44×0.15 = 28.05+14.10+6.60 = 48.75 → 49
    signalScore:   49,
    signalCall:    0,    // HOME (Ajax)
  },

  // ── SERIE A — Fiorentina vs Atalanta — May 22 2026 ────────────────────────
  "sea-fio-ata-2026-05-24": {
    label:         "Serie A — Fiorentina vs Atalanta",
    kickoff:       "2026-05-22T18:45:00Z",
    homeProb:      33,
    drawProb:      25,
    awayProb:      42,
    homeFormScore: 40,
    awayFormScore: 33,
    signalScore:   39,
    signalCall:    2,    // AWAY (Atalanta)
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDataHash(slug, homeProb, drawProb, awayProb, homeFormScore, awayFormScore) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint8", "uint8", "uint8", "uint8", "uint8"],
      [slug, homeProb, drawProb, awayProb, homeFormScore, awayFormScore]
    )
  );
}

function encodeGameId(slug) {
  return ethers.keccak256(ethers.toUtf8Bytes(slug));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node scripts/attest-match-signal.js <slug>");
    console.error("Known slugs:", Object.keys(MATCHES).join(", "));
    process.exit(1);
  }

  const match = MATCHES[slug];
  if (!match) {
    console.error(`Unknown slug: ${slug}`);
    console.error("Known slugs:", Object.keys(MATCHES).join(", "));
    process.exit(1);
  }

  const privKey = process.env.PRIVATE_KEY;
  if (!privKey) throw new Error("PRIVATE_KEY not in .env");

  const provider = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
  const wallet   = new ethers.Wallet(privKey.startsWith("0x") ? privKey : "0x" + privKey, provider);
  const contract = new ethers.Contract(MATCH_SIGNAL_ATTESTOR, ABI, wallet);

  const gameId = encodeGameId(slug);
  console.log(`\n📡 Attesting signal`);
  console.log(`   Match   : ${match.label}`);
  console.log(`   Slug    : ${slug}`);
  console.log(`   gameId  : ${gameId}`);
  console.log(`   Probs   : HOME ${match.homeProb}% · DRAW ${match.drawProb}% · AWAY ${match.awayProb}%`);
  console.log(`   Signal  : score=${match.signalScore} call=${["HOME","DRAW","AWAY"][match.signalCall]}`);

  // Check if already attested
  const alreadyDone = await contract.hasSignal(gameId);
  if (alreadyDone) {
    const sig = await contract.getSignal(gameId);
    console.log(`\n⚠  Already attested at block ts ${sig.attestedAt}`);
    console.log(`   homeProb=${sig.homeProb} drawProb=${sig.drawProb} awayProb=${sig.awayProb}`);
    console.log(`   signalScore=${sig.signalScore} signalCall=${["HOME","DRAW","AWAY"][sig.signalCall]}`);
    return;
  }

  const dataHash = buildDataHash(
    slug,
    match.homeProb,
    match.drawProb,
    match.awayProb,
    match.homeFormScore,
    match.awayFormScore
  );
  console.log(`   dataHash: ${dataHash}`);

  const nonce = await provider.getTransactionCount(wallet.address, "pending");
  const tx = await contract.attest(
    gameId,
    match.homeProb,
    match.drawProb,
    match.awayProb,
    match.signalScore,
    match.signalCall,
    dataHash,
    { nonce }
  );

  console.log(`\n⏳ Tx submitted: ${tx.hash}`);
  const receipt = await tx.wait(1);
  console.log(`\n✅ Signal attested!`);
  console.log(`   Tx hash : ${tx.hash}`);
  console.log(`   Block   : ${receipt.blockNumber}`);
  console.log(`   OKLink  : https://www.oklink.com/xlayer/tx/${tx.hash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
