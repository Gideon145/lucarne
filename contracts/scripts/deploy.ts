import hre from "hardhat";
import "dotenv/config";

async function main() {
  // Hardhat v3 API: ethers lives on the network connection, not on hre directly
  const connection = await hre.network.getOrCreate();
  const ethers = (connection as any).ethers;
  if (!ethers) throw new Error("ethers not on network connection — check plugin registration");

  const [deployer] = await ethers.getSigners();
  const networkName = connection.networkName;
  const chainId = (connection.networkConfig as any).chainId;

  console.log(`\nDeploying LUCARNE contracts`);
  console.log(`Network : ${networkName} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} OKB\n`);

  if (chainId !== 196) {
    console.warn("⚠  Not deploying to X Layer mainnet (chainId 196). Proceeding anyway for testnet dry-run.");
  }

  // ── 1. SignalAttestor ─────────────────────────────────────────────────────
  const attesterAddress = process.env.AGENT_WALLET || deployer.address;
  const SignalAttestor = await ethers.getContractFactory("SignalAttestor");
  const signalAttestor = await SignalAttestor.deploy(attesterAddress);
  await signalAttestor.waitForDeployment();
  const signalAttestorAddr = await signalAttestor.getAddress();
  console.log(`✅ SignalAttestor deployed: ${signalAttestorAddr}`);

  // ── 2. MomentumPerp ───────────────────────────────────────────────────────
  const MomentumPerp = await ethers.getContractFactory("MomentumPerp");
  const momentumPerp = await MomentumPerp.deploy(signalAttestorAddr);
  await momentumPerp.waitForDeployment();
  const momentumPerpAddr = await momentumPerp.getAddress();
  console.log(`✅ MomentumPerp deployed: ${momentumPerpAddr}`);

  // ── 3. SurvivorPool ───────────────────────────────────────────────────────
  const SurvivorPool = await ethers.getContractFactory("SurvivorPool");
  const survivorPool = await SurvivorPool.deploy(signalAttestorAddr);
  await survivorPool.waitForDeployment();
  const survivorPoolAddr = await survivorPool.getAddress();
  console.log(`✅ SurvivorPool deployed: ${survivorPoolAddr}`);

  // ── 4. TifosiBond ─────────────────────────────────────────────────────────
  const TifosiBond = await ethers.getContractFactory("TifosiBond");
  const tifosiBond = await TifosiBond.deploy(signalAttestorAddr);
  await tifosiBond.waitForDeployment();
  const tifosiBondAddr = await tifosiBond.getAddress();
  console.log(`✅ TifosiBond deployed: ${tifosiBondAddr}`);

  // ── 5. ChampionCrest ──────────────────────────────────────────────────────
  const ChampionCrest = await ethers.getContractFactory("ChampionCrest");
  const championCrest = await ChampionCrest.deploy(signalAttestorAddr);
  await championCrest.waitForDeployment();
  const championCrestAddr = await championCrest.getAddress();
  console.log(`✅ ChampionCrest deployed: ${championCrestAddr}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const deployments = {
    network: networkName,
    chainId,
    deployer: deployer.address,
    attester: attesterAddress,
    SignalAttestor: signalAttestorAddr,
    MomentumPerp:   momentumPerpAddr,
    SurvivorPool:   survivorPoolAddr,
    TifosiBond:     tifosiBondAddr,
    ChampionCrest:  championCrestAddr,
    deployedAt: new Date().toISOString(),
  };

  console.log("\nDeployments:\n", JSON.stringify(deployments, null, 2));

  // Write deployments to file
  const { writeFileSync } = await import("fs");
  writeFileSync("deployments.json", JSON.stringify(deployments, null, 2));
  console.log("\ndeployments.json written ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
