/**
 * deployOutcome.ts
 * Deploys the OutcomeAttestor contract to X Layer mainnet.
 * Run: npx hardhat run scripts/deployOutcome.ts --network xlayer
 *
 * The attester address defaults to AGENT_WALLET env var (same wallet that runs the agent).
 * After deploy, update deployments.json with the new OutcomeAttestor address.
 */
import hre from "hardhat";
import fs from "fs";
import path from "path";
import "dotenv/config";

async function main() {
  const connection = await hre.network.getOrCreate();
  const ethers = (connection as any).ethers;
  if (!ethers) throw new Error("ethers not on network connection — check plugin registration");

  const [deployer] = await ethers.getSigners();
  const networkName = connection.networkName;
  const chainId = (connection.networkConfig as any).chainId;

  console.log(`\nDeploying OutcomeAttestor`);
  console.log(`Network : ${networkName} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} OKB\n`);

  const attesterAddress = process.env.AGENT_WALLET || deployer.address;
  console.log(`Attester: ${attesterAddress}`);

  const OutcomeAttestor = await ethers.getContractFactory("OutcomeAttestor");
  const outcomeAttestor = await OutcomeAttestor.deploy(attesterAddress);
  await outcomeAttestor.waitForDeployment();
  const outcomeAddr = await outcomeAttestor.getAddress();

  console.log(`\n✅ OutcomeAttestor deployed: ${outcomeAddr}`);

  // Update deployments.json
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const existing = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  existing.OutcomeAttestor = outcomeAddr;
  existing.deployedAt = new Date().toISOString();
  fs.writeFileSync(deploymentsPath, JSON.stringify(existing, null, 2));
  console.log(`\n📄 deployments.json updated with OutcomeAttestor: ${outcomeAddr}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Copy OutcomeAttestor address to agent .env as OUTCOME_ATTESTOR=${outcomeAddr}`);
  console.log(`  2. Copy to frontend lib/deployments.json`);
  console.log(`  3. Redeploy agent (railway up from lucarne/polybot/../..)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
