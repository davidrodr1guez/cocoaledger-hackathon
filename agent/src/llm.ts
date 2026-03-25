/**
 * LLM call — supports Anthropic, OpenAI, Google Gemini, and OpenRouter.
 * Set AI_PROVIDER in .env to switch.
 *
 * OpenRouter fallback: set OPENROUTER_MODEL=auto to cycle through all free
 * models automatically, or set a specific model to try it first before
 * falling back to the free list.
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

const SYSTEM = `You are an AI asset analyst. You ONLY respond with raw JSON, no prose, no markdown.`;

// Free models on OpenRouter tried in order of reliability
const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
  "qwen/qwen3-coder:free",
  "google/gemma-3-27b-it:free",
  "openai/gpt-oss-120b:free",
];

function buildPrompt(token: TokenData): string {
  return `Evaluate this token for a public marketplace and respond with ONLY a JSON object in this exact format:
{"approved": <true or false>, "score": <integer 0-100>, "reason": "<your one-sentence analysis>"}

Token data:
- Name: ${token.name}
- Symbol: ${token.symbol}
- Supply: ${token.totalSupply}
- Address: ${token.address}

Respond with ONLY the JSON object. No markdown, no extra text.`;
}

function parse(text: string | null | undefined): AnalysisResult {
  if (!text) throw new Error("LLM returned empty content");

  // Strip markdown fences
  let cleaned = text.replace(/```json?\n?|```/g, "").trim();

  // Extract first {...} block in case the model added extra prose
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];

  try {
    const j = JSON.parse(cleaned);
    return {
      approved: Boolean(j.approved),
      score: Math.min(100, Math.max(0, Number(j.score) || 0)),
      reason: String(j.reason || ""),
    };
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${cleaned.slice(0, 200)}`);
  }
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  tokenData: TokenData,
): Promise<AnalysisResult> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });

  const r = await client.chat.completions.create({
    model,
    max_tokens: 256,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildPrompt(tokenData) },
    ],
  });

  if (!r.choices?.length) {
    throw new Error(`No choices returned. Response: ${JSON.stringify(r).slice(0, 300)}`);
  }

  const msg = r.choices[0].message;
  // Some reasoning models put output in `reasoning` when content is null
  const content = msg.content ?? (msg as any).reasoning ?? null;
  return parse(content);
}

async function callOpenRouterWithFallback(tokenData: TokenData): Promise<AnalysisResult> {
  const { openrouterApiKey, openrouterModel } = config;

  // Build the list of models to try: configured model first (unless "auto"), then free list
  const modelsToTry =
    openrouterModel === "auto"
      ? FREE_MODELS
      : [openrouterModel, ...FREE_MODELS.filter((m) => m !== openrouterModel)];

  const errors: string[] = [];

  for (const model of modelsToTry) {
    try {
      console.log(`Trying model: ${model}`);
      const result = await callOpenRouter(openrouterApiKey, model, tokenData);
      if (model !== config.openrouterModel) {
        console.log(`  → succeeded with fallback model: ${model}`);
      }
      return result;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.warn(`  → ${model} failed: ${msg.slice(0, 120)}`);
      errors.push(`[${model}] ${msg.slice(0, 120)}`);
    }
  }

  throw new Error(`All OpenRouter models failed:\n${errors.join("\n")}`);
}

export async function analyzeToken(tokenData: TokenData): Promise<AnalysisResult> {
  if (config.aiProvider === "openrouter") {
    return callOpenRouterWithFallback(tokenData);
  }

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
