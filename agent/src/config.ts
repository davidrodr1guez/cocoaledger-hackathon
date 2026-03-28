import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function opt(name: string, fallback: string = ""): string {
  return process.env[name] || fallback;
}

export const config = {
  // Chain RPCs
  publicChainRpc: req("PUBLIC_CHAIN_RPC_URL"),
  privacyNodeRpc: opt("PRIVACY_NODE_RPC_URL"),

  // Contract addresses
  tokenAddress: opt("NFT_ADDRESS", "0x"),
  nftMirrorAddress: opt("NFT_MIRROR_ADDRESS", ""),
  attestationAddress: opt("ATTESTATION_ADDRESS", ""),
  marketplaceAddress: opt("MARKETPLACE_ADDRESS", ""),

  // Agent wallet
  agentPrivateKey: req("AGENT_PRIVATE_KEY"),

  // AI config
  aiProvider: (opt("AI_PROVIDER", "openrouter")) as "anthropic" | "openai" | "gemini" | "openrouter",
  anthropicApiKey: opt("ANTHROPIC_API_KEY"),
  openaiApiKey: opt("OPENAI_API_KEY"),
  geminiApiKey: opt("GEMINI_API_KEY"),
  openrouterApiKey: opt("OPENROUTER_API_KEY"),
  openrouterModel: opt("OPENROUTER_MODEL", "auto"),
};
