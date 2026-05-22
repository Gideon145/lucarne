import hre from "hardhat";
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const connection = await hre.network.getOrCreate();
  const ethers = (connection as any).ethers;
  if (!ethers) throw new Error("ethers not on network connection");

  const [deployer] = await ethers.getSigners();
  const chainId = (connection.networkConfig as any).chainId;

  console.log(`\nDeploying MatchSignalAttestor`);
  console.log(`Network : ${connection.networkName} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} OKB\n`);

  if (chainId !== 196) {
    console.warn("⚠  Not on X Layer mainnet. Proceeding for dry-run.");
  }

  // Owner = the agent wallet (or deployer if not set)
  const ownerAddr = process.env.AGENT_WALLET || deployer.address;
  console.log(`Attester wallet: ${ownerAddr}`);

  const Factory = await ethers.getContractFactory("MatchSignalAttestor");
  const contract = await Factory.deploy(ownerAddr);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log(`\n✅ MatchSignalAttestor deployed`);
  console.log(`   Address : ${addr}`);
  console.log(`   Tx hash : ${deployTx?.hash ?? "unknown"}`);

  // Persist in deployments.json
  const deploymentsPath = resolve(__dirname, "../deployments.json");
  let deployments: Record<string, any> = {};
  try { deployments = JSON.parse(readFileSync(deploymentsPath, "utf8")); } catch { /* new file */ }
  deployments.MatchSignalAttestor = {
    address: addr,
    deployTx: deployTx?.hash ?? null,
    deployedAt: new Date().toISOString(),
    network: connection.networkName,
    chainId,
    owner: ownerAddr,
  };
  writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\n📄 Saved to deployments.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
