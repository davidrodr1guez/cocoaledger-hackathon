/**
 * PazCacao — AI Cacao Lot Verifier
 *
 * Reads NFT metadata from Privacy Node, sends to LLM for quality/origin verification,
 * returns structured analysis result.
 */
import { config } from "./config";

export interface CacaoLotData {
  tokenId: number;
  variety: string;
  weight: string;
  harvest: string;
  region: string;
  altitude: string;
  fermentationDays: number;
  dryingMethod: string;
  humidity: string;
  flavorProfile: {
    acidity: number;
    bitterness: number;
    fruitiness: number;
    floral: number;
    body: number;
  };
  certifications: string[];
  cooperativeName: string;
  farmerExperienceYears: number;
}

export interface VerificationResult {
  approved: boolean;
  qualityScore: number;
  flavorClassification: string;
  originAuthenticity: string;
  premiumRecommendation: string;
  riskFlags: string[];
  confidence: number;
  reason: string;
}

const SYSTEM = `You are an expert cacao fine flavor analyst specializing in Colombian cacao verification for premium chocolate markets. You ONLY respond with raw JSON, no prose, no markdown.`;

export function buildCacaoPrompt(lot: CacaoLotData): string {
  return `Evaluate this Colombian cacao lot for a premium chocolate marketplace. Respond with ONLY a JSON object in this exact format:
{
  "approved": <true or false>,
  "qualityScore": <integer 0-100>,
  "flavorClassification": "<commodity | fine_flavor | premium_fine_flavor>",
  "originAuthenticity": "<VERIFIED | UNVERIFIED | SUSPICIOUS>",
  "premiumRecommendation": "<percentage range over base price, e.g. '30-50%'>",
  "riskFlags": [<array of strings, empty if none>],
  "confidence": <float 0-1>,
  "reason": "<2-3 sentence analysis>"
}

Cacao lot data:
- Variety: ${lot.variety}
- Weight: ${lot.weight}
- Harvest: ${lot.harvest}
- Region: ${lot.region}
- Altitude: ${lot.altitude}
- Fermentation: ${lot.fermentationDays} days
- Drying: ${lot.dryingMethod}
- Humidity: ${lot.humidity}
- Flavor Profile: Acidity ${lot.flavorProfile.acidity}/10, Bitterness ${lot.flavorProfile.bitterness}/10, Fruitiness ${lot.flavorProfile.fruitiness}/10, Floral ${lot.flavorProfile.floral}/10, Body ${lot.flavorProfile.body}/10
- Certifications: ${lot.certifications.join(", ") || "None"}
- Cooperative: ${lot.cooperativeName}
- Farmer Experience: ${lot.farmerExperienceYears} years

Consider:
1. Is the flavor profile consistent with fine aroma cacao from this Colombian region?
2. Are fermentation and drying parameters within premium quality ranges?
3. Does altitude match the declared region?
4. Are there any inconsistencies or red flags?

Respond with ONLY the JSON object. No markdown, no extra text.`;
}

export function parseVerification(text: string | null | undefined): VerificationResult {
  if (!text) throw new Error("LLM returned empty content");

  let cleaned = text.replace(/```json?\n?|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];

  try {
    const j = JSON.parse(cleaned);
    return {
      approved: Boolean(j.approved),
      qualityScore: Math.min(100, Math.max(0, Number(j.qualityScore) || 0)),
      flavorClassification: String(j.flavorClassification || "commodity"),
      originAuthenticity: String(j.originAuthenticity || "UNVERIFIED"),
      premiumRecommendation: String(j.premiumRecommendation || "0%"),
      riskFlags: Array.isArray(j.riskFlags) ? j.riskFlags.map(String) : [],
      confidence: Math.min(1, Math.max(0, Number(j.confidence) || 0)),
      reason: String(j.reason || ""),
    };
  } catch {
    throw new Error(`Failed to parse LLM response: ${cleaned.slice(0, 200)}`);
  }
}

// Sample cacao lots for demo
export const SAMPLE_LOTS: CacaoLotData[] = [
  {
    tokenId: 1,
    variety: "Criollo Fino de Aroma",
    weight: "500 kg",
    harvest: "2026-Q1",
    region: "Tumaco, Nariño",
    altitude: "450 msnm",
    fermentationDays: 6,
    dryingMethod: "Solar, 5 days",
    humidity: "7.2%",
    flavorProfile: { acidity: 7.5, bitterness: 4.2, fruitiness: 8.1, floral: 6.8, body: 7.9 },
    certifications: ["Organic", "Rainforest Alliance"],
    cooperativeName: "CoopCacao Tumaco",
    farmerExperienceYears: 8,
  },
  {
    tokenId: 2,
    variety: "Criollo Fino de Aroma",
    weight: "300 kg",
    harvest: "2026-Q1",
    region: "Tumaco, Nariño",
    altitude: "50 msnm",
    fermentationDays: 2,
    dryingMethod: "Mechanical, 1 day",
    humidity: "12.5%",
    flavorProfile: { acidity: 3.0, bitterness: 8.5, fruitiness: 2.1, floral: 1.2, body: 4.0 },
    certifications: [],
    cooperativeName: "Unknown",
    farmerExperienceYears: 1,
  },
];
