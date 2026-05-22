/**
 * seed-predictions.js
 * Generates N fresh wallets, funds each with gas money, then submits
 * community predictions for a given game slug.
 *
 * Usage:
 *   FUNDER_KEY=0x... node scripts/seed-predictions.js
 *
 * Optional env overrides:
 *   SLUG=ned-ere-ajx-grn-2026-05-21
 *   COUNT=6
 */

const { ethers } = require("../agent/node_modules/ethers");

const RPC_URL             = "https://rpc.xlayer.tech";
const CHAIN_ID            = 196;
const PREDICTIONS_ADDRESS = "0x178565919FFebC4b57ca04112d0FFFaD946Df6E7";
const SLUG                = process.env.SLUG || "ned-ere-ajx-grn-2026-05-21";
const COUNT               = parseInt(process.env.COUNT || "6");
const FUND_AMOUNT         = ethers.parseEther("0.0005"); // ~$0.04 per wallet — enough for 100+ txs

const PREDICTIONS_ABI = [
  "function submitPrediction(bytes32 gameId, uint8 outcome) external",
  "function getCounts(bytes32 gameId) external view returns (uint256 home, uint256 draw, uint256 away)",
];

// Realistic outcome spread for Ajax vs Groningen
// 0 = HOME (Ajax), 1 = DRAW, 2 = AWAY (Groningen)
const OUTCOME_SPREAD = [0, 0, 0, 1, 0, 2]; // 4x Ajax, 1x Draw, 1x Groningen

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const funderKey = process.env.FUNDER_KEY;
  if (!funderKey) {
    console.error("❌  Set FUNDER_KEY=0x... in env");
    process.exit(1);
  }

  const provider  = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const funder    = new ethers.Wallet(funderKey, provider);
  const balance   = await provider.getBalance(funder.address);

  console.log(`\n🔑  Funder : ${funder.address}`);
  console.log(`💰  Balance: ${ethers.formatEther(balance)} OKB`);
  console.log(`🎮  Slug   : ${SLUG}`);
  console.log(`👥  Wallets: ${COUNT}\n`);

  const needed = FUND_AMOUNT * BigInt(COUNT);
  if (balance < needed) {
    console.error(`❌  Need at least ${ethers.formatEther(needed)} OKB, have ${ethers.formatEther(balance)}`);
    process.exit(1);
  }

  // Compute gameId the same way the frontend does (keccak256 of UTF-8 slug bytes)
  const gameId = ethers.keccak256(ethers.toUtf8Bytes(SLUG));
  console.log(`🆔  gameId : ${gameId}\n`);

  // Generate fresh wallets and print private keys immediately
  const wallets = Array.from({ length: COUNT }, () => ethers.Wallet.createRandom().connect(provider));
  console.log("Generated wallets (keys saved in case of crash):");
  wallets.forEach((w, i) => console.log(`  [${i+1}] ${w.address}  key: ${w.privateKey}`));
  console.log();

  // Fund wallets one-at-a-time (wait for confirmation before next)
  // This avoids nonce races with any other process using the same wallet
  console.log("--- Funding wallets (sequential) ---");
  for (const w of wallets) {
    const tx = await funder.sendTransaction({ to: w.address, value: FUND_AMOUNT });
    process.stdout.write(`  Funding ${w.address} → tx ${tx.hash} ... `);
    await tx.wait(1);
    console.log("confirmed");
  }
  console.log("✅  All funded\n");

  // Submit predictions
  console.log("--- Submitting predictions ---");
  const outcomes = ["HOME (Ajax)", "DRAW", "AWAY (Groningen)"];

  for (let i = 0; i < wallets.length; i++) {
    const w       = wallets[i];
    const outcome = OUTCOME_SPREAD[i % OUTCOME_SPREAD.length];
    const contract = new ethers.Contract(PREDICTIONS_ADDRESS, PREDICTIONS_ABI, w);

    try {
      const tx = await contract.submitPrediction(gameId, outcome);
      await tx.wait(1);
      console.log(`  ✅ [${i+1}] ${w.address.slice(0,8)}…  →  ${outcomes[outcome]}  |  tx: ${tx.hash}`);
    } catch (err) {
      console.error(`  ❌ [${i+1}] ${w.address.slice(0,8)}…  failed: ${err.message?.slice(0, 80)}`);
    }

    // Small delay between txs to avoid nonce issues
    await sleep(1500);
  }

  // Final tally
  const contract = new ethers.Contract(PREDICTIONS_ADDRESS, PREDICTIONS_ABI, provider);
  const [home, draw, away] = await contract.getCounts(gameId);
  console.log(`\n📊  Final counts — Ajax: ${home}  |  Draw: ${draw}  |  Groningen: ${away}`);
  console.log("Done 🔦\n");
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
