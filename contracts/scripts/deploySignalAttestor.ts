import hre from "hardhat";
import "dotenv/config";
import { writeFileSync, existsSync, readFileSync } from "fs";

async function main() {
  const connection = await hre.network.getOrCreate();
  const ethers = (connection as any).ethers;
  if (!ethers) throw new Error("ethers not on network connection");

  const [deployer] = await ethers.getSigners();
  const chainId = (connection.networkConfig as any).chainId;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\nDeploying NEW SignalAttestor (O(1) ring buffer)`);
  console.log(`Network  : X Layer Mainnet (chainId ${chainId})`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} OKB\n`);

  const agentWallet = process.env.AGENT_WALLET || deployer.address;
  console.log(`Attester : ${agentWallet}`);

  const SignalAttestor = await ethers.getContractFactory("SignalAttestor");
  const signalAttestor = await SignalAttestor.deploy(agentWallet);
  await signalAttestor.waitForDeployment();
  const addr = await signalAttestor.getAddress();

  console.log(`\n✅ SignalAttestor (v2, O(1) ring buffer) deployed: ${addr}`);
  console.log(`\nUpdate Railway env var:`);
  console.log(`  SIGNAL_ATTESTOR=${addr}`);

  // Update deployments.json
  const deploymentsPath = "./deployments.json";
  let deployments: Record<string, unknown> = {};
  if (existsSync(deploymentsPath)) {
    deployments = JSON.parse(readFileSync(deploymentsPath, "utf8"));
  }
  (deployments as any).xlayer = {
    ...((deployments as any).xlayer ?? {}),
    signalAttestorV2: addr,
    signalAttestorV2DeployedAt: new Date().toISOString(),
  };
  writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\nSaved to deployments.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
