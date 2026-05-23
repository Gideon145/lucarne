import hre from "hardhat";
import { ethers as rawEthers } from "ethers";
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

/** Pack a 3-char ASCII nation code into a bytes3 hex string */
function toBytes3(code: string): string {
  const buf = Buffer.alloc(3, 0);
  Buffer.from(code.slice(0, 3), "ascii").copy(buf);
  return "0x" + buf.toString("hex");
}

// 16 tracked nations
const NATION_CODES = [
  "ARG", "BRA", "FRA", "ENG", "ESP", "GER",
  "POR", "NED", "ITA", "URU", "COL", "MEX",
  "USA", "JAP", "KOR", "MAR",
];

async function main() {
  const connection = await hre.network.getOrCreate();
  const ethers     = (connection as any).ethers;
  if (!ethers) throw new Error("ethers not on network connection");

  const [deployer] = await ethers.getSigners();
  const chainId    = (connection.networkConfig as any).chainId;

  console.log(`\nDeploying HotSeatPool`);
  console.log(`Network : ${connection.networkName} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} OKB\n`);

  const deploymentsPath = resolve(__dirname, "../deployments.json");
  const deployments: Record<string, any> = JSON.parse(readFileSync(deploymentsPath, "utf8"));

  const attestorAddr: string = deployments.SignalAttestor;
  if (!attestorAddr) throw new Error("SignalAttestor not found in deployments.json");
  console.log(`SignalAttestor : ${attestorAddr}`);

  // Fetch live nonce directly from RPC (Hardhat provider can return stale value)
  const rawProvider = new rawEthers.JsonRpcProvider("https://rpc.xlayer.tech");
  let nonce = await rawProvider.getTransactionCount(deployer.address, "pending");
  // Agent wallet writes frequently — bump nonce until we find a clear slot
  nonce = nonce + 1;
  console.log(`Using nonce    : ${nonce}\n`);

  const nations = NATION_CODES.map(toBytes3);
  console.log("Nations:", NATION_CODES.join(", "));

  const Factory    = await ethers.getContractFactory("HotSeatPool");
  const hotSeat    = await Factory.deploy(attestorAddr, nations, { nonce });
  await hotSeat.waitForDeployment();

  const addr = await hotSeat.getAddress();
  const tx   = hotSeat.deploymentTransaction();

  console.log(`\n✅ HotSeatPool deployed`);
  console.log(`   Address : ${addr}`);
  console.log(`   Tx hash : ${tx?.hash ?? "unknown"}\n`);

  // Persist to deployments.json
  deployments.HotSeatPool = {
    address:    addr,
    deployTx:   tx?.hash ?? "",
    deployedAt: new Date().toISOString(),
    network:    "xlayer",
    chainId,
    attestor:   attestorAddr,
    nations:    NATION_CODES,
  };
  writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("deployments.json updated ✓");
}

main().catch(err => { console.error(err); process.exit(1); });
