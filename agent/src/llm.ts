/**
 * LLM call — supports Anthropic, OpenAI, and Google Gemini (free tier).
 * Set AI_PROVIDER in .env to switch.
 */
import { config } from "./config";

export interface AnalysisResult {
  approved: boolean;
  score: number;
  reason: string;
}

export interface TokenData {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
}

const SYSTEM = `You are an AI asset analyst. Evaluate the token data and return JSON:
{"approved": true/false, "score": 0-100, "reason": "one sentence"}
Respond with ONLY the JSON, no markdown.`;

function buildPrompt(token: TokenData): string {
  return `Token: ${token.name} (${token.symbol}), supply: ${token.totalSupply}, address: ${token.address}. Is this suitable for a public marketplace?`;
}

function parse(text: string): AnalysisResult {
  const cleaned = text.replace(/```json?\n?|```/g, "").trim();
  const j = JSON.parse(cleaned);
  return {
    approved: Boolean(j.approved),
    score: Math.min(100, Math.max(0, Number(j.score) || 0)),
    reason: String(j.reason || ""),
  };
}

export async function analyzeToken(tokenData: TokenData): Promise<AnalysisResult> {
  if (config.aiProvider === "openai") {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(tokenData) },
      ],
    });
    return parse(r.choices[0].message.content!);
  }

  if (config.aiProvider === "gemini") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(config.geminiApiKey);
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
    const r = await model.generateContent(`${SYSTEM}\n\n${buildPrompt(tokenData)}`);
    return parse(r.response.text());
  }

  // Default: Anthropic
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const r = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: "user", content: buildPrompt(tokenData) }],
  });
  const block = r.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return parse(block.text);
}
