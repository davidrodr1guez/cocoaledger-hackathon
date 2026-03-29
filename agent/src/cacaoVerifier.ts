/**
 * CocoaLedger — AI Cacao Lot Verifier
 *
 * Scoring methodology:
 *   Score = weighted average of 5 factors:
 *   - Flavor Profile (30%): consistency with declared variety/region
 *   - Processing Quality (25%): fermentation days, drying method, final humidity
 *   - IoT/Environmental (20%): temperature, humidity, rainfall consistency with region
 *   - Farm Credentials (15%): farmer experience, certifications, altitude
 *   - Disease Risk (10%): presence of monilia, escoba de bruja, or anomalies
 *
 *   Grades:
 *   A (85-100) = Premium Fine Flavor → 50-80% premium
 *   B (70-84)  = Fine Flavor → 25-50% premium
 *   C (50-69)  = Standard Grade → 0-25% premium
 *   D (0-49)   = Below Standard / Rejected
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
  // IoT data summary
  iotReadings?: {
    avgTemperature?: number;
    avgHumidity?: number;
    avgSoilMoisture?: number;
    avgRainfall?: number;
    readingCount?: number;
  };
}

export interface VerificationResult {
  approved: boolean;
  qualityScore: number;
  grade: string;
  breakdown: {
    flavorScore: number;
    processingScore: number;
    iotScore: number;
    farmScore: number;
    diseaseScore: number;
  };
  flavorClassification: string;
  originAuthenticity: string;
  premiumRecommendation: string;
  riskFlags: string[];
  confidence: number;
  reason: string;
}

const SYSTEM = `You are an expert cacao quality grader for the Colombian cacao industry. You evaluate lots using a standardized scoring system. You ONLY respond with raw JSON, no prose, no markdown.`;

export function buildCacaoPrompt(lot: CacaoLotData): string {
  const iotSection = lot.iotReadings && lot.iotReadings.readingCount
    ? `
IoT Environmental Data (from on-chain sensors — immutable, cannot be falsified):
- Average Temperature: ${lot.iotReadings.avgTemperature}°C
- Average Humidity: ${lot.iotReadings.avgHumidity}%
- Average Soil Moisture: ${lot.iotReadings.avgSoilMoisture}%
- Average Rainfall: ${lot.iotReadings.avgRainfall}mm/day
- Number of readings: ${lot.iotReadings.readingCount}
Note: This IoT data is recorded directly by sensors on the blockchain and CANNOT be modified after recording. Use it to cross-validate the declared region and growing conditions.`
    : `
IoT Data: No sensor readings available for this lot.
Note: Lack of IoT data reduces confidence in environmental claims.`;

  return `Evaluate this Colombian cacao lot using the following SCORING METHODOLOGY:

SCORING BREAKDOWN (weighted average):
1. FLAVOR PROFILE (30% weight): Score 0-100
   - Does the sensory profile match the declared variety?
   - Criollo should have: high fruitiness (>7), moderate acidity (>6), low bitterness (<5), floral notes (>5)
   - Trinitario: balanced profile, strong body (>7)
   - Forastero: higher bitterness, lower complexity

2. PROCESSING QUALITY (25% weight): Score 0-100
   - Fermentation: 5-7 days optimal for fine flavor. <3 days = under-fermented. >8 days = risk of over-fermentation
   - Drying: Solar preferred over mechanical. 4-7 days optimal
   - Final humidity: 6-8% ideal. >10% = storage risk. <5% = over-dried

3. IoT/ENVIRONMENTAL CONSISTENCY (20% weight): Score 0-100
   - Cross-validate IoT data against declared region
   - Tumaco (Pacific): expect 24-28°C avg, 75-90% humidity, high rainfall
   - Santander (Andean): expect 20-26°C, 60-80% humidity, moderate rainfall
   - If no IoT data: cap this score at 50

4. FARM CREDENTIALS (15% weight): Score 0-100
   - Farmer experience: >10yr=excellent, 5-10=good, <3=risky
   - Certifications: Organic, Rainforest Alliance, Fair Trade add points
   - Altitude: 200-800m ideal for fine aroma cacao

5. DISEASE RISK (10% weight): Score 0-100 (100=no disease risk)
   - Check for signs of monilia, escoba de bruja based on environmental conditions
   - High humidity + high temperature = elevated disease risk
   - Deduct points for disease-prone conditions

GRADE ASSIGNMENT:
- Grade A (85-100): Premium Fine Flavor → 50-80% price premium
- Grade B (70-84): Fine Flavor → 25-50% premium
- Grade C (50-69): Standard Grade → 0-25% premium
- Grade D (0-49): Below Standard → REJECTED

Respond with ONLY this JSON:
{
  "approved": <true if grade A/B/C, false if D>,
  "qualityScore": <final weighted score 0-100>,
  "grade": "<A/B/C/D>",
  "breakdown": {
    "flavorScore": <0-100>,
    "processingScore": <0-100>,
    "iotScore": <0-100>,
    "farmScore": <0-100>,
    "diseaseScore": <0-100>
  },
  "flavorClassification": "<commodity | fine_flavor | premium_fine_flavor>",
  "originAuthenticity": "<VERIFIED | UNVERIFIED | SUSPICIOUS>",
  "premiumRecommendation": "<e.g. '45-60%'>",
  "riskFlags": [<array of risk strings>],
  "confidence": <0.0-1.0>,
  "reason": "<2-3 sentence justification citing specific data points>"
}

=== LOT DATA ===
- Variety: ${lot.variety}
- Weight: ${lot.weight}
- Harvest: ${lot.harvest}
- Region: ${lot.region}
- Altitude: ${lot.altitude}
- Fermentation: ${lot.fermentationDays} days
- Drying: ${lot.dryingMethod}
- Final Humidity: ${lot.humidity}
- Flavor Profile: Acidity ${lot.flavorProfile.acidity}/10, Bitterness ${lot.flavorProfile.bitterness}/10, Fruitiness ${lot.flavorProfile.fruitiness}/10, Floral ${lot.flavorProfile.floral}/10, Body ${lot.flavorProfile.body}/10
- Certifications: ${lot.certifications.join(", ") || "None"}
- Cooperative: ${lot.cooperativeName}
- Farmer Experience: ${lot.farmerExperienceYears} years
${iotSection}

Respond with ONLY the JSON object.`;
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
      grade: String(j.grade || "D"),
      breakdown: {
        flavorScore: Number(j.breakdown?.flavorScore) || 0,
        processingScore: Number(j.breakdown?.processingScore) || 0,
        iotScore: Number(j.breakdown?.iotScore) || 0,
        farmScore: Number(j.breakdown?.farmScore) || 0,
        diseaseScore: Number(j.breakdown?.diseaseScore) || 0,
      },
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

// Sample lots for demo — lot 1 is premium, lot 2 is suspicious
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
    iotReadings: {
      avgTemperature: 24.5,
      avgHumidity: 81.7,
      avgSoilMoisture: 63.8,
      avgRainfall: 5.9,
      readingCount: 3,
    },
  },
  {
    tokenId: 2,
    variety: "Criollo Fino de Aroma",
    weight: "200 kg",
    harvest: "2026-Q1",
    region: "Arauca",
    altitude: "120 msnm",
    fermentationDays: 2,
    dryingMethod: "Mechanical, 1 day",
    humidity: "12.5%",
    flavorProfile: { acidity: 3.0, bitterness: 8.5, fruitiness: 2.1, floral: 1.2, body: 4.0 },
    certifications: [],
    cooperativeName: "Unknown",
    farmerExperienceYears: 1,
    iotReadings: {
      avgTemperature: 34.5,
      avgHumidity: 45,
      avgSoilMoisture: 28,
      avgRainfall: 0,
      readingCount: 1,
    },
  },
];
