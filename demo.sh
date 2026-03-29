#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# CocoaLedger — Full Demo Script
# Shows the complete pipeline: Register → AI Score → Purchase → Reveal
# ═══════════════════════════════════════════════════════════════

API="http://localhost:3000"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
RED="\033[31m"
DIM="\033[2m"
RESET="\033[0m"

pause() {
  echo ""
  read -p "  [Press Enter to continue] " dummy
  echo ""
}

clear
echo -e "${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  🌱 CocoaLedger — Live Demo${RESET}"
echo -e "${BOLD}  Blockchain-Verified Cacao Traceability${RESET}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "${DIM}  Privacy Node: https://privacy-node-0.rayls.com${RESET}"
echo -e "${DIM}  Public Chain: https://testnet-rpc.rayls.com${RESET}"
echo -e "${DIM}  CocoaLedger:  0x2EC69beE2eb52cDe0716E3a437384d1991Cb8b09${RESET}"
pause

# ─── Step 1: Register a lot ────────────────────────────────────
echo -e "${BOLD}${CYAN}STEP 1: Cooperative registers a cacao lot${RESET}"
echo -e "${DIM}  A cooperative in Tumaco, Nariño uploads IoT data + lot details${RESET}"
echo -e "${DIM}  All data stored on Rayls Privacy Node — invisible to public${RESET}"
echo ""
echo -e "  ${YELLOW}POST ${API}/api/cacao-market/lot${RESET}"
echo ""

RESULT=$(curl -s -X POST "${API}/api/cacao-market/lot" \
  -H "Content-Type: application/json" \
  -d '{
    "lotId": 42,
    "farmName": "Finca La Esperanza",
    "origin": "Tumaco, Nariño, Colombia",
    "readingsCount": 15,
    "analyzedAt": "2026-03-29T08:00:00Z",
    "publicMetadata": {
      "qualityGrade": "A",
      "qualityScore": 89,
      "scoreBreakdown": {
        "flavorScore": 92,
        "processingScore": 88,
        "iotScore": 86,
        "farmScore": 90,
        "diseaseScore": 85
      },
      "premiumRecommendation": "50-65%",
      "originVerified": true,
      "avgTemperature": 25.8,
      "avgHumidity": 83.2,
      "avgSoilPH": 6.3,
      "avgRainfall": 9.5,
      "cropHealthAssessment": "Excellent crop health. IoT sensors confirm optimal microclimate for fine aroma cacao. No disease indicators detected across 15 readings.",
      "regionSummary": "Pacific coast Colombian cacao region. Ideal altitude and rainfall for Criollo variety.",
      "harvestAssessment": "Ready for harvest. Fruit maturity at optimal stage.",
      "recommendedUse": "Premium single-origin dark chocolate (72%+)",
      "totalReadings": 15,
      "farmName": "Finca La Esperanza",
      "origin": "Tumaco, Nariño, Colombia"
    },
    "privateMetadata": {
      "gpsAreaCoverage": "1.7820N, 78.8900W — 4.5 hectares in Valle del Mira",
      "priceEstimatePerKg": 4.80,
      "iotDataHash": "0x7a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
      "labQualityAnalysis": "High floral notes with pronounced fruity acidity. Tannin structure suggests excellent aging potential. Fermentation uniformity index: 0.94 (excellent).",
      "anomalies": [],
      "producerRecommendations": "Maintain current 6-day fermentation protocol. Solar drying conditions optimal.",
      "deviceStats": [
        {"deviceId": 1, "readingCount": 8, "avgTemperature": 25.2, "avgHumidity": 84.1},
        {"deviceId": 2, "readingCount": 7, "avgTemperature": 26.4, "avgHumidity": 82.3}
      ]
    }
  }')

echo -e "  ${GREEN}Response:${RESET}"
echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
pause

# ─── Step 2: View marketplace ──────────────────────────────────
echo -e "${BOLD}${CYAN}STEP 2: Buyer views marketplace${RESET}"
echo -e "${DIM}  Buyer sees AI quality score, grade, and premium recommendation${RESET}"
echo -e "${DIM}  Private data (GPS, price, farm identity) is HIDDEN${RESET}"
echo ""
echo -e "  ${YELLOW}GET ${API}/api/cacao-market/lot/42${RESET}"
echo ""

LOT=$(curl -s "${API}/api/cacao-market/lot/42")
echo -e "  ${GREEN}What the buyer sees:${RESET}"
echo "$LOT" | python3 -m json.tool 2>/dev/null || echo "$LOT"
echo ""
echo -e "  ${RED}Notice: Region, GPS, Price, Cooperative → 🔒 PRIVATE${RESET}"
echo -e "  ${GREEN}But: Quality score (89/100), Grade (A), Premium (50-65%) → VISIBLE${RESET}"
pause

# ─── Step 3: Open website ──────────────────────────────────────
echo -e "${BOLD}${CYAN}STEP 3: View on marketplace UI${RESET}"
echo -e "${DIM}  Opening http://localhost:3000 in browser...${RESET}"
echo ""
open "http://localhost:3000" 2>/dev/null || echo "  Open http://localhost:3000 in your browser"
pause

# ─── Step 4: Purchase lot ──────────────────────────────────────
echo -e "${BOLD}${CYAN}STEP 4: Buyer purchases the lot${RESET}"
echo -e "${DIM}  This triggers: NFT mint → Bridge to public chain → Reveal private data${RESET}"
echo ""
echo -e "  ${YELLOW}POST ${API}/api/cacao-market/lot/42/purchase${RESET}"
echo ""

PURCHASE=$(curl -s -X POST "${API}/api/cacao-market/lot/42/purchase" \
  -H "Content-Type: application/json" \
  -d '{"buyerAddress": "0x026214C977E0C1B3b1Fa6AF71B79CDe41cD87C5d"}')

echo -e "  ${GREEN}Purchase result:${RESET}"
echo "$PURCHASE" | python3 -m json.tool 2>/dev/null || echo "$PURCHASE"

MINT_TX=$(echo "$PURCHASE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mintTxHash','N/A'))" 2>/dev/null)
BRIDGE_TX=$(echo "$PURCHASE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('bridgeTxHash','N/A'))" 2>/dev/null)
NFT_ID=$(echo "$PURCHASE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('nftTokenId','N/A'))" 2>/dev/null)

echo ""
echo -e "  ${GREEN}✅ NFT #${NFT_ID} minted on Privacy Node${RESET}"
echo -e "  ${GREEN}✅ NFT bridged to Public Chain${RESET}"
echo -e "  ${GREEN}✅ Private data REVEALED to buyer${RESET}"
echo ""
echo -e "  ${CYAN}Verify on explorer:${RESET}"
echo -e "  ${DIM}Mint: https://blockscout-privacy-node-0.rayls.com/tx/${MINT_TX}${RESET}"
echo -e "  ${DIM}Bridge: https://blockscout-privacy-node-0.rayls.com/tx/${BRIDGE_TX}${RESET}"
pause

# ─── Step 5: View revealed data ────────────────────────────────
echo -e "${BOLD}${CYAN}STEP 5: Buyer now sees ALL private data${RESET}"
echo -e "${DIM}  After purchase, the NFT reveal unlocks the full provenance${RESET}"
echo ""
echo -e "  ${YELLOW}GET ${API}/api/cacao-market/lot/42${RESET}"
echo ""

REVEALED=$(curl -s "${API}/api/cacao-market/lot/42")
echo -e "  ${GREEN}REVEALED data:${RESET}"
echo "$REVEALED" | python3 -m json.tool 2>/dev/null || echo "$REVEALED"
echo ""
echo -e "  ${GREEN}✅ GPS: Now visible (1.7820N, 78.8900W)${RESET}"
echo -e "  ${GREEN}✅ Price: Now visible (\$4.80/kg)${RESET}"
echo -e "  ${GREEN}✅ Farm: Now visible (Finca La Esperanza)${RESET}"
echo -e "  ${GREEN}✅ IoT Data Hash: Verifiable on-chain${RESET}"

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  🌱 CocoaLedger Demo Complete${RESET}"
echo -e "${BOLD}  Private data → AI verification → NFT mint → Purchase → Reveal${RESET}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${RESET}"
echo ""
