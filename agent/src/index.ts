/**
 * Rayls AI Agent Skeleton
 *
 * Demonstrates: read public chain → call LLM → write result on-chain.
 * This is the pattern. Adapt it to governance, marketplace, or any other use case.
 *
 * Usage:
 *   cd agent && npm install && cp .env.example .env
 *   # fill in .env
 *   npm start
 */
import { ethers } from "ethers";
import { config } from "./config";
import { analyzeToken } from "./llm";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

const ATTESTATION_ABI = [
  "function attest(address token, bool approved, string reason, uint256 score)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(config.publicChainRpc);
  const wallet = new ethers.Wallet(config.agentPrivateKey, provider);

  const token = new ethers.Contract(config.tokenAddress, ERC20_ABI, provider);
  const attestation = new ethers.Contract(config.attestationAddress, ATTESTATION_ABI, wallet);

  // 1. Read token data from public chain
  const [name, symbol, totalSupply] = await Promise.all([
    token.name(),
    token.symbol(),
    token.totalSupply(),
  ]);

  const tokenData = {
    address: config.tokenAddress,
    name: name as string,
    symbol: symbol as string,
    totalSupply: (totalSupply as bigint).toString(),
  };
  console.log("Token:", tokenData.name, `(${tokenData.symbol})`, "supply:", tokenData.totalSupply);

  // 2. Call LLM
  const result = await analyzeToken(tokenData);
  console.log("AI verdict:", result.approved ? "APPROVED" : "REJECTED", `score=${result.score}`, result.reason);

  // 3. Post attestation on-chain
  const tx = await attestation.attest(config.tokenAddress, result.approved, result.reason, result.score);
  const receipt = await tx.wait();
  console.log("Attestation tx:", tx.hash, "status:", receipt.status === 1 ? "success" : "failed");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
