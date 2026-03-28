/**
 * CocoaLedger — AI Cacao Verification Agent
 *
 * Flow:
 * 1. Read cacao lot data (simulated metadata from Privacy Node)
 * 2. AI verifies quality, origin, and consistency
 * 3. Posts attestation on public chain
 *
 * Usage:
 *   cd agent && npm install && cp .env.example .env
 *   # fill in .env
 *   npm start
 */
import { ethers } from "ethers";
import { config } from "./config";
import { analyzeCacaoLot } from "./llm";
import { SAMPLE_LOTS } from "./cacaoVerifier";

const ATTESTATION_ABI = [
  "function attest(address token, bool approved, string reason, uint256 score)",
  "function getAttestations(address token) view returns (tuple(address attester, address token, bool approved, string reason, uint256 score, uint256 timestamp)[])",
];

const ERC721_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

async function main() {
  console.log("\n🌱 CocoaLedger — AI Cacao Verification Agent\n");
  console.log("=".repeat(50));

  const publicProvider = new ethers.JsonRpcProvider(config.publicChainRpc);
  const wallet = new ethers.Wallet(config.agentPrivateKey, publicProvider);

  console.log(`Agent wallet: ${wallet.address}`);
  console.log(`Public chain: ${config.publicChainRpc}`);

  // Check if attestation contract is configured
  if (!config.attestationAddress || config.attestationAddress === "0x") {
    console.log("\n⚠️  ATTESTATION_ADDRESS not set. Running in analysis-only mode.\n");
  }

  // Process each sample lot
  for (const lot of SAMPLE_LOTS) {
    console.log("\n" + "─".repeat(50));
    console.log(`\n📦 Processing Lot — Token #${lot.tokenId}`);
    console.log(`   Variety:       ${lot.variety}`);
    console.log(`   Weight:        ${lot.weight}`);
    console.log(`   Region:        ${lot.region}`);
    console.log(`   Harvest:       ${lot.harvest}`);
    console.log(`   Cooperative:   ${lot.cooperativeName}`);
    console.log(`   Fermentation:  ${lot.fermentationDays} days`);

    // 2. AI Analysis
    console.log("\n🤖 Sending to AI for verification...\n");
    const result = await analyzeCacaoLot(lot);

    // Display result
    const statusIcon = result.approved ? "✅" : "❌";
    const classIcon = result.flavorClassification === "premium_fine_flavor" ? "⭐" :
                      result.flavorClassification === "fine_flavor" ? "🟢" : "🟡";

    console.log(`${statusIcon} Verification Result:`);
    console.log(`   Quality Score:    ${result.qualityScore}/100`);
    console.log(`   Classification:   ${classIcon} ${result.flavorClassification}`);
    console.log(`   Origin:           ${result.originAuthenticity}`);
    console.log(`   Premium:          ${result.premiumRecommendation} over base`);
    console.log(`   Confidence:       ${(result.confidence * 100).toFixed(0)}%`);
    console.log(`   Risk Flags:       ${result.riskFlags.length === 0 ? "None" : result.riskFlags.join(", ")}`);
    console.log(`   Reasoning:        ${result.reason}`);

    // 3. Post attestation on-chain (if contract configured)
    if (config.attestationAddress && config.attestationAddress !== "0x") {
      try {
        const attestation = new ethers.Contract(config.attestationAddress, ATTESTATION_ABI, wallet);

        const attestReason = JSON.stringify({
          qualityScore: result.qualityScore,
          classification: result.flavorClassification,
          origin: result.originAuthenticity,
          premium: result.premiumRecommendation,
          riskFlags: result.riskFlags,
          confidence: result.confidence,
          summary: result.reason,
        });

        console.log("\n📝 Posting attestation on-chain...");
        const tx = await attestation.attest(
          config.nftMirrorAddress || config.tokenAddress,
          result.approved,
          attestReason,
          result.qualityScore
        );
        const receipt = await tx.wait();
        console.log(`   ✅ Attestation tx: ${tx.hash}`);
        console.log(`   Status: ${receipt.status === 1 ? "success" : "failed"}`);
      } catch (e: any) {
        console.log(`   ⚠️  Attestation failed: ${e.message?.slice(0, 100)}`);
      }
    }

    console.log("\n" + "─".repeat(50));
  }

  console.log("\n🌱 CocoaLedger verification complete.\n");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
