# CocoaLedger

**Blockchain-verified cacao traceability — from farm to buyer.**

Built on [Rayls](https://www.rayls.com/) Privacy Node for the Rayls Hackathon #2 at EthCC Cannes 2026.

## The Problem

The cacao industry faces a critical transparency gap. Buyers want verified provenance. Producers need to protect their commercial data. Today, achieving both is impossible:

- **Public blockchains** expose everything — GPS coordinates, prices, supplier identity
- **Traditional databases** are centrally controlled and can be falsified
- **Paper certifications** are slow, expensive, and forgeable

Producers lose because they can't prove quality without exposing trade secrets. Buyers lose because they can't verify origin without trusting intermediaries.

## The Solution

CocoaLedger stores farm IoT sensor data on a **Rayls Privacy Node** — an immutable, private blockchain only the producer can see. An AI agent analyzes the data, produces a quality score, and publishes **only the verdict** on the public chain. Private data (GPS, prices, supplier identity) is revealed **only after purchase**.

```
Farm IoT Sensors → Privacy Node (immutable, private)
                        ↓
                  AI Agent analyzes
                        ↓
              Public Attestation (score only)
                        ↓
              Marketplace (buyer sees score, not data)
                        ↓
                    Purchase
                        ↓
              NFT minted + bridged
                        ↓
              Private data REVEALED to buyer only
```

## Why Blockchain and Not a Database?

A database is controlled by one entity that can modify, delete, or fabricate data. A blockchain provides:

- **Immutability** — IoT readings recorded on-chain cannot be altered retroactively
- **Verifiable timestamps** — every reading has a provable timestamp; you can't fake 6 months of sensor data
- **Cross-validation** — the AI compares declared conditions against immutable IoT records; if a producer claims "6-day fermentation" but timestamps show 2 days, the AI flags it
- **Auditability** — any auditor can verify the chain of events without seeing the raw data

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRIVACY NODE                         │
│                  (only producer sees)                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ CocoaLedger  │  │  HackathonNFT │  │   IoT Data   │  │
│  │   Data.sol   │  │    (ERC721)   │  │  (readings)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                │           │
│         └──────────────────┼────────────────┘           │
│                            │                            │
│                     AI Agent reads                      │
│                     analyzes, scores                    │
└────────────────────────────┼────────────────────────────┘
                             │ bridge
┌────────────────────────────┼────────────────────────────┐
│                    PUBLIC CHAIN                          │
│                  (everyone sees)                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Attestation  │  │  Marketplace  │  │  NFT Mirror   │  │
│  │    .sol      │  │     .sol      │  │  (ERC721)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Chain | Address | Purpose |
|----------|-------|---------|---------|
| `CocoaLedgerData.sol` | Privacy Node | `0x2EC69beE2eb52cDe0716E3a437384d1991Cb8b09` | Full lifecycle tracking: IoT readings, harvest, post-harvest, logistics, AI validation, sale, reveal |
| `HackathonNFT.sol` | Privacy Node | `0x22ABC2FBDc6eE41e6b4a1773f3fb12d4a85eD06C` | Cacao lot NFTs — minted on purchase, bridged to public chain |
| `Attestation.sol` | Public Chain | `0x0Ee606d003e5E519CCcEA3e37c748B11d0cFE61e` | AI quality attestations — score, grade, reasoning on-chain |
| `Marketplace.sol` | Public Chain | `0x192646c88C7d63d5d33C2cAf6608E9cDcA0782f4` | Escrow marketplace for buying verified cacao lots |

## AI Scoring Methodology

The AI agent scores each lot using a **5-factor weighted model**:

| Factor | Weight | What It Evaluates |
|--------|--------|-------------------|
| Flavor/Sensory | 30% | Consistency of sensory profile with declared variety and region |
| Processing Quality | 25% | Fermentation days, drying method, final humidity |
| IoT Data Quality | 20% | Environmental data consistency, number of readings, anomaly detection |
| Farm Credentials | 15% | Farmer experience, certifications, altitude |
| Disease Risk | 10% | Monilia, escoba de bruja risk based on environmental conditions |

### Grades

| Grade | Score | Classification | Price Premium |
|-------|-------|---------------|---------------|
| S | 95-100 | Exceptional | Top 1% |
| A | 85-94 | Premium Fine Flavor | 50-80% |
| B | 70-84 | Fine Flavor | 25-50% |
| C | 50-69 | Standard | 0-25% |
| D | 0-49 | Below Standard | Rejected |

## Lot Lifecycle

Each cacao lot passes through 11 on-chain states, generating a verifiable audit trail:

```
Created → Growing (IoT) → Finalized → AI Validated → Harvested →
Post-Harvest → In Transit → Stored → Tokenized → Listed → Sold → Revealed
```

Every state transition is recorded as an on-chain event with a timestamp.

## Public vs Private Data

| Public (visible before purchase) | Private (revealed after purchase) |
|----------------------------------|-----------------------------------|
| Cacao variety | Farm GPS coordinates |
| AI quality score + grade | Exact region and municipality |
| Score breakdown (5 factors) | Cooperative / farm name |
| Premium recommendation | Purchase price per kg |
| Average temperature, humidity | Production costs |
| Crop health assessment | Detailed flavor profile |
| Number of IoT readings | Full IoT sensor data |
| Certifications (count) | Lab quality analysis |

## API Endpoints

All endpoints under `/api/cacao-market/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cacao-market/lot` | Register a new lot (from web form or agent analysis) |
| `GET` | `/api/cacao-market/lots` | List all lots with public data + AI scores |
| `GET` | `/api/cacao-market/lot/:id` | Get lot info (respects privacy — hides private fields until purchased) |
| `POST` | `/api/cacao-market/lot/:id/purchase` | Purchase lot: mints NFT + bridges to public chain + reveals private data |
| `POST` | `/api/cacao-market/lot/:id/reveal` | Reveal private data (without NFT mint) |
| `POST` | `/api/cacao-market/lot/:id/bridge` | Bridge NFT to public chain |
| `GET` | `/api/cacao-market/attestations` | Get AI attestations from public chain |
| `GET` | `/api/cacao-market/listings` | Get active marketplace listings |

### Agent Integration

The AI agent can POST its analysis result directly to the marketplace:

```bash
# Agent analyzes a lot, then sends result to marketplace
curl -X POST http://localhost:3000/api/cacao-market/lot \
  -H "Content-Type: application/json" \
  -d '{
    "lotId": 42,
    "farmName": "Finca La Esperanza",
    "origin": "Tumaco, Nariño",
    "publicMetadata": {
      "qualityGrade": "A",
      "qualityScore": 89,
      "scoreBreakdown": { ... },
      ...
    },
    "privateMetadata": {
      "gpsAreaCoverage": "1.78N, 78.89W",
      "priceEstimatePerKg": 4.80,
      "iotDataHash": "0x...",
      ...
    }
  }'
```

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- [Node.js](https://nodejs.org/) 18+
- Rayls Privacy Node credentials (from hackathon organizers)

### Setup

```bash
git clone https://github.com/davidrodr1guez/cocoaledger-hackathon.git
cd cocoaledger-hackathon
forge install
npm install
cp .env.example .env  # Fill with your credentials
source .env
```

### Run the Marketplace

```bash
cd app && npm install
DEMO_MODE=true node server.js
# Open http://localhost:3000
```

### Run the Demo Script

```bash
./demo.sh
```

### Run the AI Agent

```bash
cd agent && npm install
cp .env.example .env  # Add OPENROUTER_API_KEY or GEMINI_API_KEY
npm start
```

## Project Structure

```
cocoaledger-hackathon/
├── src/                          # Smart contracts
│   ├── CocoaLedger.sol           # Full lifecycle tracking (Privacy Node)
│   ├── HackathonNFT.sol          # Cacao lot NFTs (ERC721)
│   ├── Attestation.sol           # AI attestation registry (Public Chain)
│   └── Marketplace.sol           # Escrow marketplace (Public Chain)
│
├── script/                       # Foundry deploy/interaction scripts
│   ├── DeployCocoaLedger.s.sol
│   ├── RegisterLot.s.sol         # Register lot + IoT data
│   ├── DeployNFT.s.sol
│   ├── DeployPublic.s.sol        # Deploy Attestation on public chain
│   └── DeployMarketplace.s.sol
│
├── agent/                        # AI verification agent
│   ├── src/cacaoVerifier.ts      # Scoring methodology + prompts
│   ├── src/llm.ts                # Multi-provider LLM calls
│   ├── src/config.ts
│   └── src/index.ts
│
├── app/                          # Marketplace web app
│   ├── server.js                 # Express API + marketplace logic
│   └── public/index.html         # Marketplace UI
│
└── demo.sh                       # Full pipeline demo script
```

## Blockchain Explorers

- **Privacy Node**: https://blockscout-privacy-node-0.rayls.com
- **Public Chain**: https://testnet-explorer.rayls.com

## Tech Stack

- **Contracts**: Solidity 0.8.24, Foundry, Rayls Protocol SDK
- **Agent**: TypeScript, ethers.js, Google Gemini / OpenRouter
- **Frontend**: HTML/CSS/JS (single page), Express.js
- **Chains**: Rayls Privacy Node (gasless, EVM) + Rayls Public Chain (reth, sub-second finality)

## Team

Built at Rayls Hackathon #2, EthCC Cannes, March 28-29, 2026.
