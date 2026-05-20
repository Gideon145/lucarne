import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

async function main() {
  const connection = await hre.network.getOrCreate();
  const ethers = (connection as any).ethers;
  if (!ethers) throw new Error("ethers not on network connection — check plugin registration");

  const [deployer] = await ethers.getSigners();
  const networkName = connection.networkName;
  const chainId = (connection.networkConfig as any).chainId;

  console.log(`\nDeploying LucarnePredictions`);
  console.log(`Network : ${networkName} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} OKB\n`);

  const Factory = await ethers.getContractFactory("LucarnePredictions");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`✅ LucarnePredictions deployed: ${address}`);

  // Update deployments.json
  const deploymentsPath = path.join(__dirname, "../deployments.json");
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  deployments.LucarnePredictions = address;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\n📝 deployments.json updated`);

  // Also write to frontend lib
  const frontendPath = path.join(__dirname, "../../frontend/lib/deployments.json");
  if (fs.existsSync(frontendPath)) {
    const fd = JSON.parse(fs.readFileSync(frontendPath, "utf8"));
    fd.LucarnePredictions = address;
    fs.writeFileSync(frontendPath, JSON.stringify(fd, null, 2));
    console.log(`📝 frontend/lib/deployments.json updated`);
  }

  console.log(`\n🚀 Done. Contract: ${address}`);
  console.log(`   OKLink: https://www.oklink.com/xlayer/address/${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
