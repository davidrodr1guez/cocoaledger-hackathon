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

export const config = {
  publicChainRpc: req("PUBLIC_CHAIN_RPC_URL"),
  tokenAddress: req("TOKEN_ADDRESS"),
  attestationAddress: req("ATTESTATION_ADDRESS"),
  agentPrivateKey: req("AGENT_PRIVATE_KEY"),
  aiProvider: (process.env.AI_PROVIDER || "gemini") as "anthropic" | "openai" | "gemini" | "openrouter",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
  openrouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
};
