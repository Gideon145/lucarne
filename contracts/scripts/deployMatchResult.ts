import hre from "hardhat";
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

async function main() {
  const connection = await hre.network.getOrCreate();
  const ethers = (connection as any).ethers;
  if (!ethers) throw new Error("ethers not on network connection");

  const [deployer] = await ethers.getSigners();
  const chainId = (connection.networkConfig as any).chainId;

  console.log(`\nDeploying MatchResultAttestor`);
  console.log(`Network : ${connection.networkName} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} OKB\n`);

  const deploymentsPath = resolve(__dirname, "../deployments.json");
  const deployments: Record<string, any> = JSON.parse(readFileSync(deploymentsPath, "utf8"));

  const matchSignalAttestorAddr = deployments.MatchSignalAttestor?.address ?? deployments.MatchSignalAttestor;
  if (!matchSignalAttestorAddr) throw new Error("MatchSignalAttestor not in deployments.json — deploy it first");
  console.log(`MatchSignalAttestor : ${matchSignalAttestorAddr}`);

  const ownerAddr = process.env.AGENT_WALLET || deployer.address;
  console.log(`Owner              : ${ownerAddr}`);

  const Factory  = await ethers.getContractFactory("MatchResultAttestor");
  const contract = await Factory.deploy(ownerAddr, matchSignalAttestorAddr);
  await contract.waitForDeployment();
  const addr     = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log(`\n✅ MatchResultAttestor deployed`);
  console.log(`   Address : ${addr}`);
  console.log(`   Tx hash : ${deployTx?.hash ?? "unknown"}`);

  deployments.MatchResultAttestor = {
    address:    addr,
    deployTx:   deployTx?.hash ?? null,
    deployedAt: new Date().toISOString(),
    network:    connection.networkName,
    chainId,
    owner:      ownerAddr,
    signalAttestor: matchSignalAttestorAddr,
  };
  writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\n📄 Saved to deployments.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
