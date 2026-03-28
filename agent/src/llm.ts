/**
 * LLM call — supports Anthropic, OpenAI, Google Gemini, and OpenRouter.
 * Adapted for CocoaLedger cacao lot verification.
 */
import { config } from "./config";
import { CacaoLotData, VerificationResult, buildCacaoPrompt, parseVerification } from "./cacaoVerifier";

const SYSTEM = `You are an expert cacao fine flavor analyst specializing in Colombian cacao verification for premium chocolate markets. You evaluate cacao lots for quality, origin authenticity, and consistency. You ONLY respond with raw JSON, no prose, no markdown.`;

const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
  "qwen/qwen3-coder:free",
  "google/gemma-3-27b-it:free",
  "openai/gpt-oss-120b:free",
];

async function callOpenRouter(
  apiKey: string,
  model: string,
  lot: CacaoLotData,
): Promise<VerificationResult> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });

  const r = await client.chat.completions.create({
    model,
    max_tokens: 512,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildCacaoPrompt(lot) },
    ],
  });

  if (!r.choices?.length) {
    throw new Error(`No choices returned. Response: ${JSON.stringify(r).slice(0, 300)}`);
  }

  const msg = r.choices[0].message;
  const content = msg.content ?? (msg as any).reasoning ?? null;
  return parseVerification(content);
}

async function callOpenRouterWithFallback(lot: CacaoLotData): Promise<VerificationResult> {
  const { openrouterApiKey, openrouterModel } = config;

  const modelsToTry =
    openrouterModel === "auto"
      ? FREE_MODELS
      : [openrouterModel, ...FREE_MODELS.filter((m) => m !== openrouterModel)];

  const errors: string[] = [];

  for (const model of modelsToTry) {
    try {
      console.log(`   Trying model: ${model}`);
      const result = await callOpenRouter(openrouterApiKey, model, lot);
      if (model !== config.openrouterModel) {
        console.log(`   → succeeded with fallback model: ${model}`);
      }
      return result;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.warn(`   → ${model} failed: ${msg.slice(0, 120)}`);
      errors.push(`[${model}] ${msg.slice(0, 120)}`);
    }
  }

  throw new Error(`All OpenRouter models failed:\n${errors.join("\n")}`);
}

export async function analyzeCacaoLot(lot: CacaoLotData): Promise<VerificationResult> {
  if (config.aiProvider === "openrouter") {
    return callOpenRouterWithFallback(lot);
  }

  if (config.aiProvider === "gemini") {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const client = new GoogleGenerativeAI(config.geminiApiKey);
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
    const r = await model.generateContent(`${SYSTEM}\n\n${buildCacaoPrompt(lot)}`);
    return parseVerification(r.response.text());
  }

  if (config.aiProvider === "anthropic") {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: config.anthropicApiKey });
    const r = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: buildCacaoPrompt(lot) }],
    });
    const block = r.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type");
    return parseVerification(block.text);
  }

  // OpenAI
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const r = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 512,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildCacaoPrompt(lot) },
    ],
  });
  return parseVerification(r.choices[0].message.content!);
}
