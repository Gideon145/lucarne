import hre from "hardhat";
import { ethers as rawEthers } from "ethers";
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

  console.log(`\nDeploying SignalPool + ICalledItNFT`);
  console.log(`Network : ${connection.networkName} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} OKB\n`);

  const deploymentsPath = resolve(__dirname, "../deployments.json");
  const deployments: Record<string, any> = JSON.parse(readFileSync(deploymentsPath, "utf8"));

  const resultAttestorAddr: string =
    deployments.MatchResultAttestor?.address ?? deployments.MatchResultAttestor;
  if (!resultAttestorAddr)
    throw new Error("MatchResultAttestor not in deployments.json — deploy it first");
  console.log(`MatchResultAttestor: ${resultAttestorAddr}`);

  const ownerAddr: string = process.env.AGENT_WALLET || deployer.address;
  const agentAddr: string = process.env.AGENT_WALLET || deployer.address;
  console.log(`Owner / Agent      : ${ownerAddr}\n`);

  // Fetch pending nonce directly — X Layer RPC returns stale nonce via Hardhat provider
  const rawProvider = new rawEthers.JsonRpcProvider("https://rpc.xlayer.tech");
  let nonce = await rawProvider.getTransactionCount(deployer.address, "pending");
  console.log(`Pending nonce      : ${nonce}\n`);

  // ── 1. Deploy SignalPool ─────────────────────────────────────────────────
  const PoolFactory = await ethers.getContractFactory("SignalPool");
  const pool        = await PoolFactory.deploy(ownerAddr, agentAddr, resultAttestorAddr, { nonce: nonce++ });
  await pool.waitForDeployment();
  const poolAddr    = await pool.getAddress();
  const poolTx      = pool.deploymentTransaction();

  console.log(`✅ SignalPool deployed`);
  console.log(`   Address : ${poolAddr}`);
  console.log(`   Tx hash : ${poolTx?.hash ?? "unknown"}\n`);

  // ── 2. Deploy ICalledItNFT ───────────────────────────────────────────────
  const NftFactory = await ethers.getContractFactory("ICalledItNFT");
  const nft        = await NftFactory.deploy(ownerAddr, poolAddr, { nonce: nonce++ });
  await nft.waitForDeployment();
  const nftAddr    = await nft.getAddress();
  const nftTx      = nft.deploymentTransaction();

  console.log(`✅ ICalledItNFT deployed`);
  console.log(`   Address : ${nftAddr}`);
  console.log(`   Tx hash : ${nftTx?.hash ?? "unknown"}\n`);

  // ── 3. Save to deployments.json ──────────────────────────────────────────
  deployments.SignalPool = {
    address:        poolAddr,
    deployTx:       poolTx?.hash ?? null,
    deployedAt:     new Date().toISOString(),
    network:        connection.networkName,
    chainId,
    owner:          ownerAddr,
    agent:          agentAddr,
    resultAttestor: resultAttestorAddr,
  };
  deployments.ICalledItNFT = {
    address:    nftAddr,
    deployTx:   nftTx?.hash ?? null,
    deployedAt: new Date().toISOString(),
    network:    connection.networkName,
    chainId,
    owner:      ownerAddr,
    signalPool: poolAddr,
  };

  writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`📄 Saved to deployments.json`);
  console.log(`\nNext step: run scripts/stake-pool.js with a gameId to open the pool.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
