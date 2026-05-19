import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x" + "0".repeat(64);

export default {
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  // X Layer mainnet is the DEFAULT — this is where all real TXs go
  defaultNetwork: "xlayer",
  networks: {
    xlayer: {
      type: "http",
      url: "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: [PRIVATE_KEY],
    },
    // Testnet kept for last-resort dry-run only — never deploy final contracts here
    xlayer_testnet: {
      type: "http",
      url: "https://testrpc.xlayer.tech",
      chainId: 1952,
      accounts: [PRIVATE_KEY],
    },
  },
};
