const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Mutex for sequential on-chain transactions ───────────────────────
let txLock = false;
async function withTxLock(fn) {
  while (txLock) await new Promise(r => setTimeout(r, 500));
  txLock = true;
  try { return await fn(); } finally { txLock = false; }
}

// ─── Config ────────────────────────────────────────────────────────────
const PRIVACY_NODE_RPC = process.env.PRIVACY_NODE_RPC_URL;
const PUBLIC_CHAIN_RPC = process.env.PUBLIC_CHAIN_RPC_URL;
const NFT_ADDRESS = process.env.NFT_ADDRESS;
const NFT_MIRROR_ADDRESS = process.env.NFT_MIRROR_ADDRESS;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const REGISTERED_KEY = process.env.REGISTERED_PRIVATE_KEY;
const PUBLIC_KEY = process.env.PUBLIC_CHAIN_PRIVATE_KEY;
const MINT_RECIPIENT = process.env.MINT_RECIPIENT;
const TRANSFER_TO = process.env.TRANSFER_TO;
const PUBLIC_CHAIN_ID = process.env.PUBLIC_CHAIN_ID;

// ─── Providers & Wallets ───────────────────────────────────────────────
const privacyProvider = new ethers.JsonRpcProvider(PRIVACY_NODE_RPC);
const publicProvider = new ethers.JsonRpcProvider(PUBLIC_CHAIN_RPC);
const deployerWallet = new ethers.Wallet(DEPLOYER_KEY, privacyProvider);
const registeredWallet = new ethers.Wallet(REGISTERED_KEY, privacyProvider);
const publicWallet = PUBLIC_KEY ? new ethers.Wallet(PUBLIC_KEY, publicProvider) : null;

// ─── ABIs ──────────────────────────────────────────────────────────────
const NFT_ABI = [
  'function mint(address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function teleportToPublicChain(address to, uint256 tokenId, uint256 chainId) returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

const MARKETPLACE_ABI = [
  'function list(address token, uint8 assetType, uint256 tokenId, uint256 amount, uint256 price) returns (uint256)',
  'function buy(uint256 listingId) payable',
  'function getListing(uint256 listingId) view returns (tuple(address token, uint8 assetType, uint256 tokenId, uint256 amount, uint256 price, bool active))',
  'function getActiveListings() view returns (uint256[])',
  'function nextListingId() view returns (uint256)',
];

const ATTESTATION_ABI = [
  'function attest(address token, bool approved, string reason, uint256 score)',
  'function getAttestations(address token) view returns (tuple(address attester, address token, bool approved, string reason, uint256 score, uint256 timestamp)[])',
];

// ─── In-memory metadata store (Privacy Node simulation) ────────────────
const lotMetadata = {};
let nextTokenId = 10; // Start from 10 to avoid collision with test mints

// ─── Demo data for slides/presentation ─────────────────────────────────
if (process.env.DEMO_MODE === 'true') {
  const demoLots = [
    {
      tokenId: 1,
      variety: "Criollo Fino de Aroma",
      weight: "500 kg",
      harvest: "2026-Q1",
      region: "Tumaco, Nariño",
      altitude: "450 msnm",
      cooperativeName: "CoopCacao Tumaco",
      fermentationDays: 6,
      dryingMethod: "Solar, 5 days",
      humidity: "7.2%",
      farmerExperienceYears: 8,
      certifications: ["Organic", "Rainforest Alliance"],
      flavorProfile: { acidity: 7.5, bitterness: 4.2, fruitiness: 8.1, floral: 6.8, body: 7.9 },
      purchasePricePerKg: "$2.00",
      productionCostPerKg: "$3.50",
      iotReadings: [
        { time: "06:00", temp: "23.5°C", humidity: "82%", soil: "65.5%", rain: "12.5mm" },
        { time: "14:00", temp: "28.5°C", humidity: "75%", soil: "62.0%", rain: "0mm" },
        { time: "20:00", temp: "21.5°C", humidity: "88%", soil: "68.0%", rain: "5mm" },
      ],
      gps: { lat: 1.782, lon: -78.89 },
      status: "listed",
      aiScore: 88,
      aiGrade: "A",
      aiBreakdown: { flavor: 92, processing: 88, iot: 85, farm: 82, disease: 90 },
      aiClassification: "premium_fine_flavor",
      aiOrigin: "VERIFIED",
      aiPremium: "45-60%",
      aiConfidence: 0.92,
      aiReason: "Flavor profile consistent with Criollo from Pacific Colombia. High fruitiness (8.1) and moderate acidity (7.5) match Tumaco terroir. Fermentation and drying parameters within premium range. IoT data confirms stable microclimate.",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      tokenId: 2,
      variety: "Trinitario",
      weight: "300 kg",
      harvest: "2026-Q1",
      region: "San Vicente de Chucurí, Santander",
      altitude: "680 msnm",
      cooperativeName: "FedeCacao Santander",
      fermentationDays: 5,
      dryingMethod: "Solar, 4 days",
      humidity: "7.8%",
      farmerExperienceYears: 12,
      certifications: ["Fair Trade", "UTZ"],
      flavorProfile: { acidity: 6.2, bitterness: 5.5, fruitiness: 6.8, floral: 5.5, body: 8.2 },
      purchasePricePerKg: "$1.80",
      productionCostPerKg: "$3.20",
      iotReadings: [
        { time: "06:00", temp: "21.0°C", humidity: "78%", soil: "58.2%", rain: "8mm" },
        { time: "14:00", temp: "26.5°C", humidity: "65%", soil: "52.0%", rain: "0mm" },
        { time: "20:00", temp: "19.5°C", humidity: "85%", soil: "61.0%", rain: "3mm" },
      ],
      gps: { lat: 6.883, lon: -73.417 },
      status: "attested",
      aiScore: 79,
      aiGrade: "B",
      aiBreakdown: { flavor: 78, processing: 72, iot: 83, farm: 85, disease: 80 },
      aiClassification: "fine_flavor",
      aiOrigin: "VERIFIED",
      aiPremium: "25-35%",
      aiConfidence: 0.87,
      aiReason: "Solid Trinitario with strong body (8.2). Santander profile confirmed by altitude and IoT temperature range. Good processing but fermentation slightly short for maximum flavor development.",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      tokenId: 3,
      variety: "Criollo Fino de Aroma",
      weight: "200 kg",
      harvest: "2026-Q1",
      region: "Arauca",
      altitude: "120 msnm",
      cooperativeName: "CacaoArauca",
      fermentationDays: 2,
      dryingMethod: "Mechanical, 1 day",
      humidity: "12.5%",
      farmerExperienceYears: 1,
      certifications: [],
      flavorProfile: { acidity: 3.0, bitterness: 8.5, fruitiness: 2.1, floral: 1.2, body: 4.0 },
      purchasePricePerKg: "$0.90",
      productionCostPerKg: "$1.50",
      iotReadings: [
        { time: "14:00", temp: "34.5°C", humidity: "45%", soil: "28.0%", rain: "0mm" },
      ],
      gps: { lat: 7.089, lon: -70.762 },
      status: "rejected",
      aiScore: 28,
      aiGrade: "D",
      aiBreakdown: { flavor: 15, processing: 20, iot: 30, farm: 25, disease: 45 },
      aiClassification: "commodity",
      aiOrigin: "SUSPICIOUS",
      aiPremium: "0%",
      aiConfidence: 0.94,
      aiReason: "REJECTED. Declared as Criollo but flavor profile indicates Forastero (high bitterness 8.5, low fruitiness 2.1). Humidity 12.5% exceeds premium threshold. Only 1 IoT reading — insufficient monitoring. Mechanical drying degrades quality.",
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      tokenId: 4,
      variety: "Nacional",
      weight: "750 kg",
      harvest: "2026-Q1",
      region: "Catatumbo, Norte de Santander",
      altitude: "520 msnm",
      cooperativeName: "CoopCacao Catatumbo",
      fermentationDays: 7,
      dryingMethod: "Solar, 6 days",
      humidity: "6.8%",
      farmerExperienceYears: 15,
      certifications: ["Organic", "Rainforest Alliance", "Direct Trade"],
      flavorProfile: { acidity: 7.8, bitterness: 3.8, fruitiness: 8.5, floral: 7.2, body: 8.0 },
      purchasePricePerKg: "$2.50",
      productionCostPerKg: "$4.00",
      iotReadings: [
        { time: "06:00", temp: "22.0°C", humidity: "80%", soil: "62.0%", rain: "15mm" },
        { time: "10:00", temp: "25.0°C", humidity: "72%", soil: "59.0%", rain: "2mm" },
        { time: "14:00", temp: "27.5°C", humidity: "68%", soil: "55.0%", rain: "0mm" },
        { time: "18:00", temp: "23.0°C", humidity: "78%", soil: "60.0%", rain: "8mm" },
        { time: "22:00", temp: "20.5°C", humidity: "86%", soil: "65.0%", rain: "4mm" },
      ],
      gps: { lat: 8.533, lon: -73.067 },
      status: "revealed",
      aiScore: 94,
      aiGrade: "A",
      aiBreakdown: { flavor: 97, processing: 95, iot: 92, farm: 90, disease: 88 },
      aiClassification: "premium_fine_flavor",
      aiOrigin: "VERIFIED",
      aiPremium: "60-80%",
      aiConfidence: 0.96,
      aiReason: "Exceptional Nacional variety. Outstanding fruitiness (8.5) and floral notes (7.2) with low bitterness (3.8). 7-day fermentation and solar drying optimal. 5 IoT readings show ideal microclimate. 15 years farmer experience. Triple certified. Premium recommendation: top 5% of Colombian cacao.",
      createdAt: new Date(Date.now() - 10800000).toISOString(),
    },
  ];

  demoLots.forEach(lot => { lotMetadata[lot.tokenId] = lot; });
  nextTokenId = 100;
  console.log("  DEMO MODE: 4 sample lots loaded");
}

// ─── API Routes ────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'CocoaLedger' });
});

// POST /api/cacao-market/lot — Register a new cacao lot
// Accepts TWO formats:
// 1. From web form: { variety, region, weight, ... }
// 2. From Julio's agent: { lotId, farmName, origin, publicMetadata, privateMetadata }
app.post('/api/cacao-market/lot', async (req, res) => {
  try {
    const body = req.body;

    // Format 2: From agent analysis (has publicMetadata)
    if (body.publicMetadata) {
      const pub = body.publicMetadata;
      const priv = body.privateMetadata || {};
      const tokenId = body.lotId !== undefined ? body.lotId : nextTokenId++;

      lotMetadata[tokenId] = {
        tokenId,
        // Public data (visible before purchase)
        variety: pub.recommendedUse || 'Colombian Cacao',
        weight: `${pub.totalReadings} readings`,
        harvest: new Date().toISOString().slice(0, 7),
        status: 'listed',
        createdAt: body.analyzedAt || new Date().toISOString(),
        iotReadings: Array(pub.totalReadings).fill({}),
        // AI scores (public)
        aiScore: pub.qualityScore,
        aiGrade: pub.qualityGrade,
        aiBreakdown: pub.scoreBreakdown || {},
        aiClassification: pub.qualityGrade === 'S' || pub.qualityGrade === 'A' ? 'premium_fine_flavor' : pub.qualityGrade === 'B' ? 'fine_flavor' : 'commodity',
        aiOrigin: pub.originVerified ? 'VERIFIED' : 'UNVERIFIED',
        aiPremium: pub.premiumRecommendation || '0%',
        aiConfidence: 0.9,
        aiReason: pub.cropHealthAssessment || '',
        // Private data (hidden until purchase)
        region: body.origin || priv.gpsAreaCoverage || '🔒 PRIVATE',
        cooperativeName: body.farmName || '🔒 PRIVATE',
        gps: priv.gpsAreaCoverage ? { area: priv.gpsAreaCoverage } : null,
        purchasePricePerKg: priv.priceEstimatePerKg ? `$${priv.priceEstimatePerKg.toFixed(2)}` : '🔒 PRIVATE',
        iotDataHash: priv.iotDataHash || null,
        anomalies: priv.anomalies || [],
        labQualityAnalysis: priv.labQualityAnalysis || '',
        producerRecommendations: priv.producerRecommendations || '',
        deviceStats: priv.deviceStats || [],
        // Public assessments
        cropHealthAssessment: pub.cropHealthAssessment || '',
        regionSummary: pub.regionSummary || '',
        harvestAssessment: pub.harvestAssessment || '',
        avgTemperature: pub.avgTemperature,
        avgHumidity: pub.avgHumidity,
        avgSoilPH: pub.avgSoilPH,
        avgRainfall: pub.avgRainfall,
      };

      console.log(`🤖 Agent registered lot #${tokenId}: ${pub.qualityGrade} (${pub.qualityScore}/100)`);

      return res.json({
        success: true,
        tokenId,
        grade: pub.qualityGrade,
        score: pub.qualityScore,
        message: `Lot #${tokenId} listed on marketplace — Grade ${pub.qualityGrade} (${pub.qualityScore}/100)`,
      });
    }

    // Format 1: From web form
    const metadata = body;
    if (!metadata.variety || !metadata.region || !metadata.weight) {
      return res.status(400).json({ error: 'Required fields: variety, region, weight' });
    }

    const tokenId = nextTokenId++;

    lotMetadata[tokenId] = {
      ...metadata,
      tokenId,
      createdAt: new Date().toISOString(),
      status: 'private',
    };

    // Mint NFT on Privacy Node
    try {
      const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, deployerWallet);
      const tx = await nft.mint(MINT_RECIPIENT, tokenId);
      await tx.wait();
      console.log(`🌱 Minted cacao lot NFT #${tokenId} on Privacy Node`);
    } catch (mintErr) {
      console.log(`⚠️ NFT mint skipped: ${mintErr.message}`);
    }

    res.json({
      success: true,
      tokenId,
      message: `Cacao lot #${tokenId} registered on Privacy Node`,
      metadata: {
        variety: metadata.variety,
        weight: metadata.weight,
        region: '***PRIVATE***',
        cooperative: '***PRIVATE***',
      },
    });
  } catch (e) {
    console.error('Register error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cacao-market/lot/:tokenId — Get lot info (respects privacy)
app.get('/api/cacao-market/lot/:tokenId', (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const lot = lotMetadata[tokenId];

  if (!lot) {
    return res.status(404).json({ error: 'Lot not found' });
  }

  // If not yet revealed, return only public info
  if (lot.status !== 'revealed') {
    return res.json({
      tokenId,
      status: lot.status,
      // Public info only
      variety: lot.variety,
      weight: lot.weight,
      harvest: lot.harvest || 'N/A',
      // Private info hidden
      region: '🔒 PRIVATE',
      altitude: '🔒 PRIVATE',
      cooperative: '🔒 PRIVATE',
      farmer: '🔒 PRIVATE',
      flavorProfile: '🔒 PRIVATE',
      fermentation: '🔒 PRIVATE',
      message: 'Full provenance revealed after purchase',
    });
  }

  // If revealed, return everything
  return res.json({ tokenId, status: 'revealed', ...lot });
});

// POST /api/cacao-market/lot/:tokenId/prepare — Server-side: mint NFT, bridge, list on marketplace
app.post('/api/cacao-market/lot/:tokenId/prepare', async (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const lot = lotMetadata[tokenId];

  if (!lot) {
    return res.status(404).json({ error: 'Lot not found' });
  }

  let nftTokenId = Date.now() % 100000;
  let mintTxHash = null;
  let bridgeTxHash = null;
  let listingId = null;
  const price = req.body.price || '1000000000000000'; // 0.001 USDR default

  try {
    // 1. Mint NFT on Privacy Node
    const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, deployerWallet);
    const mintTx = await nft.mint(MINT_RECIPIENT, nftTokenId);
    await mintTx.wait();
    mintTxHash = mintTx.hash;
    console.log(`🎨 NFT #${nftTokenId} minted on Privacy Node — tx: ${mintTxHash}`);

    // 2. Bridge NFT to public chain (to our public address, not buyer)
    const nftReg = new ethers.Contract(NFT_ADDRESS, NFT_ABI, registeredWallet);
    const bridgeTx = await nftReg.teleportToPublicChain(TRANSFER_TO, nftTokenId, PUBLIC_CHAIN_ID);
    await bridgeTx.wait();
    bridgeTxHash = bridgeTx.hash;
    console.log(`🌉 NFT #${nftTokenId} bridged to public chain — tx: ${bridgeTxHash}`);

    // 3. Wait for mirror to process, then approve + list on marketplace
    if (publicWallet) {
      console.log(`⏳ Waiting 15s for relayer to process bridge...`);
      await new Promise(r => setTimeout(r, 15000));

      const NFT_MIRROR = NFT_MIRROR_ADDRESS;
      const MARKETPLACE = process.env.MARKETPLACE_ADDRESS;

      if (NFT_MIRROR && MARKETPLACE) {
        const ERC721_PUBLIC = [
          'function approve(address to, uint256 tokenId)',
          'function ownerOf(uint256 tokenId) view returns (address)',
        ];

        try {
          const mirrorNft = new ethers.Contract(NFT_MIRROR, ERC721_PUBLIC, publicWallet);

          // Check if we own the NFT on public chain
          const owner = await mirrorNft.ownerOf(nftTokenId);
          console.log(`📋 NFT #${nftTokenId} owner on public chain: ${owner}`);

          // Approve marketplace
          const approveTx = await mirrorNft.approve(MARKETPLACE, nftTokenId, { gasLimit: 100000, type: 0 });
          await approveTx.wait();
          console.log(`✅ Approved marketplace for NFT #${nftTokenId}`);

          // List on marketplace (assetType=1 for ERC721, price in wei)
          const marketplace = new ethers.Contract(MARKETPLACE, [
            'function list(address token, uint8 assetType, uint256 tokenId, uint256 amount, uint256 price) returns (uint256)',
            'function nextListingId() view returns (uint256)',
          ], publicWallet);

          const listTx = await marketplace.list(NFT_MIRROR, 1, nftTokenId, 1, price, { gasLimit: 300000, type: 0 });
          await listTx.wait();
          listingId = Number(await marketplace.nextListingId()) - 1;
          console.log(`🏪 Listed on marketplace — listing #${listingId}`);
        } catch (listErr) {
          console.log(`⚠️ Marketplace listing skipped: ${listErr.message?.slice(0, 100)}`);
        }
      }
    }

    lot.status = 'listed';
    lot.nftTokenId = nftTokenId;
    lot.listingId = listingId;

    res.json({
      success: true,
      tokenId,
      nftTokenId,
      mintTxHash,
      bridgeTxHash,
      listingId,
      nftMirrorAddress: NFT_MIRROR_ADDRESS,
      marketplaceAddress: process.env.MARKETPLACE_ADDRESS,
      price,
      message: `Lot #${tokenId} prepared: NFT #${nftTokenId} minted, bridged, and listed.`,
    });
  } catch (e) {
    console.error('Prepare error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/cacao-market/lot/:tokenId/confirm-purchase — After buyer signs on-chain buy()
app.post('/api/cacao-market/lot/:tokenId/confirm-purchase', (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const lot = lotMetadata[tokenId];

  if (!lot) {
    return res.status(404).json({ error: 'Lot not found' });
  }

  lot.status = 'revealed';
  lot.purchasedAt = new Date().toISOString();
  lot.buyerAddress = req.body.buyerAddress || 'unknown';
  lot.buyTxHash = req.body.txHash || null;

  console.log(`🔓 Lot #${tokenId} PURCHASED & REVEALED — buyer: ${lot.buyerAddress}`);

  res.json({
    success: true,
    tokenId,
    status: 'revealed',
    message: 'Purchase confirmed. Full provenance revealed.',
    fullMetadata: lot,
  });
});

// GET /api/cacao-market/lot/:tokenId/purchase-stream — SSE purchase with live logs
app.get('/api/cacao-market/lot/:tokenId/purchase-stream', async (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const lot = lotMetadata[tokenId];
  const buyerAddress = req.query.buyer || TRANSFER_TO;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  if (!lot) {
    send('error', { message: 'Lot not found' });
    res.end();
    return;
  }

  let nftTokenId = Date.now() % 100000;

  // Step 1: Mint
  send('log', { message: 'Connecting to Rayls Privacy Node...' });
  send('log', { message: `Minting NFT #${nftTokenId} on Privacy Node...` });

  let mintTxHash = null;
  try {
    const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, deployerWallet);
    const mintTx = await nft.mint(MINT_RECIPIENT, nftTokenId);
    await mintTx.wait();
    mintTxHash = mintTx.hash;
    send('success', {
      message: `NFT #${nftTokenId} minted on Privacy Node`,
      txHash: mintTxHash,
      explorer: `https://blockscout-privacy-node-0.rayls.com/tx/${mintTxHash}`,
    });
  } catch (e) {
    nftTokenId = (Date.now() + 1) % 100000;
    try {
      const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, deployerWallet);
      const mintTx = await nft.mint(MINT_RECIPIENT, nftTokenId);
      await mintTx.wait();
      mintTxHash = mintTx.hash;
      send('success', {
        message: `NFT #${nftTokenId} minted on Privacy Node`,
        txHash: mintTxHash,
        explorer: `https://blockscout-privacy-node-0.rayls.com/tx/${mintTxHash}`,
      });
    } catch (e2) {
      send('warn', { message: `Mint retry failed: ${e2.message?.slice(0, 60)}` });
    }
  }

  // Step 2: Bridge
  send('log', { message: `Bridging NFT #${nftTokenId} to Public Chain...` });

  let bridgeTxHash = null;
  try {
    const nftReg = new ethers.Contract(NFT_ADDRESS, NFT_ABI, registeredWallet);
    const bridgeTx = await nftReg.teleportToPublicChain(buyerAddress, nftTokenId, PUBLIC_CHAIN_ID);
    await bridgeTx.wait();
    bridgeTxHash = bridgeTx.hash;
    send('success', {
      message: `NFT #${nftTokenId} bridged to Public Chain`,
      txHash: bridgeTxHash,
      explorer: `https://blockscout-privacy-node-0.rayls.com/tx/${bridgeTxHash}`,
    });
  } catch (e) {
    send('warn', { message: `Bridge: ${e.message?.slice(0, 60)}` });
  }

  // Step 3: Reveal
  lot.status = 'revealed';
  lot.nftTokenId = nftTokenId;
  lot.purchasedAt = new Date().toISOString();
  lot.buyerAddress = buyerAddress;

  send('success', { message: 'Private data REVEALED to buyer' });
  send('complete', {
    tokenId,
    nftTokenId,
    mintTxHash,
    bridgeTxHash,
    mintExplorer: mintTxHash ? `https://blockscout-privacy-node-0.rayls.com/tx/${mintTxHash}` : null,
    bridgeExplorer: bridgeTxHash ? `https://blockscout-privacy-node-0.rayls.com/tx/${bridgeTxHash}` : null,
    fullMetadata: lot,
  });

  console.log(`🔓 Lot #${tokenId} PURCHASED & REVEALED — NFT #${nftTokenId}`);
  res.end();
});

// POST /api/cacao-market/lot/:tokenId/purchase — JSON fallback
app.post('/api/cacao-market/lot/:tokenId/purchase', async (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const lot = lotMetadata[tokenId];

  if (!lot) {
    return res.status(404).json({ error: 'Lot not found' });
  }

  const buyerAddress = req.body.buyerAddress || TRANSFER_TO;
  let nftTokenId = Date.now() % 100000;
  let mintTxHash = null;
  let bridgeTxHash = null;

  try {
    const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, deployerWallet);
    const mintTx = await nft.mint(MINT_RECIPIENT, nftTokenId);
    await mintTx.wait();
    mintTxHash = mintTx.hash;
  } catch (e) {
    nftTokenId = (Date.now() + 1) % 100000;
    try {
      const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, deployerWallet);
      const mintTx = await nft.mint(MINT_RECIPIENT, nftTokenId);
      await mintTx.wait();
      mintTxHash = mintTx.hash;
    } catch (e2) {}
  }

  try {
    const nftReg = new ethers.Contract(NFT_ADDRESS, NFT_ABI, registeredWallet);
    const bridgeTx = await nftReg.teleportToPublicChain(buyerAddress, nftTokenId, PUBLIC_CHAIN_ID);
    await bridgeTx.wait();
    bridgeTxHash = bridgeTx.hash;
  } catch (e) {}

  lot.status = 'revealed';
  lot.nftTokenId = nftTokenId;
  lot.purchasedAt = new Date().toISOString();
  lot.buyerAddress = buyerAddress;

  res.json({
    success: true, tokenId, nftTokenId, status: 'revealed',
    mintTxHash, bridgeTxHash,
    mintExplorer: mintTxHash ? `https://blockscout-privacy-node-0.rayls.com/tx/${mintTxHash}` : null,
    bridgeExplorer: bridgeTxHash ? `https://blockscout-privacy-node-0.rayls.com/tx/${bridgeTxHash}` : null,
    fullMetadata: lot,
  });
});

// POST /api/cacao-market/lot/:tokenId/reveal — Reveal only (backward compat)
app.post('/api/cacao-market/lot/:tokenId/reveal', (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const lot = lotMetadata[tokenId];

  if (!lot) {
    return res.status(404).json({ error: 'Lot not found' });
  }

  lot.status = 'revealed';
  console.log(`🔓 Lot #${tokenId} REVEALED to buyer`);

  res.json({
    tokenId,
    status: 'revealed',
    message: 'Full provenance now available',
    fullMetadata: lot,
  });
});

// GET /api/lots — List all lots with their public status + AI scores (no private data)
app.get('/api/cacao-market/lots', (req, res) => {
  const lots = Object.values(lotMetadata).map((lot) => ({
    tokenId: lot.tokenId,
    variety: lot.variety,
    weight: lot.weight,
    status: lot.status,
    harvest: lot.harvest || 'N/A',
    createdAt: lot.createdAt,
    iotReadings: lot.iotReadings ? lot.iotReadings.map(() => ({})) : [], // count only, no data
    // AI results (public — scoring methodology is transparent)
    aiScore: lot.aiScore,
    aiGrade: lot.aiGrade,
    aiBreakdown: lot.aiBreakdown,
    aiClassification: lot.aiClassification,
    aiOrigin: lot.aiOrigin,
    aiPremium: lot.aiPremium,
    aiConfidence: lot.aiConfidence,
  }));
  res.json(lots);
});

// POST /api/cacao-market/lot/:tokenId/bridge — Bridge NFT to public chain
app.post('/api/cacao-market/lot/:tokenId/bridge', async (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const lot = lotMetadata[tokenId];

  if (!lot) {
    return res.status(404).json({ error: 'Lot not found' });
  }

  try {
    const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, registeredWallet);
    const tx = await nft.teleportToPublicChain(TRANSFER_TO, tokenId, PUBLIC_CHAIN_ID);
    await tx.wait();

    lot.status = 'bridged';
    console.log(`🌉 Lot #${tokenId} bridged to public chain`);

    res.json({ success: true, tokenId, status: 'bridged', txHash: tx.hash });
  } catch (e) {
    console.error('Bridge error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attestations — Get all attestations from public chain
app.get('/api/cacao-market/attestations', async (req, res) => {
  const attestAddr = process.env.ATTESTATION_ADDRESS;
  if (!attestAddr) {
    return res.json([]);
  }

  try {
    const attestation = new ethers.Contract(attestAddr, ATTESTATION_ABI, publicProvider);
    const tokenAddr = NFT_MIRROR_ADDRESS || NFT_ADDRESS;
    const data = await attestation.getAttestations(tokenAddr);

    const attestations = data.map((a) => ({
      attester: a.attester,
      token: a.token,
      approved: a.approved,
      reason: a.reason,
      score: Number(a.score),
      timestamp: Number(a.timestamp),
    }));

    res.json(attestations);
  } catch (e) {
    res.json([]);
  }
});

// GET /api/marketplace/listings — Get active marketplace listings
app.get('/api/cacao-market/listings', async (req, res) => {
  const marketAddr = process.env.MARKETPLACE_ADDRESS;
  if (!marketAddr || !publicWallet) {
    return res.json([]);
  }

  try {
    const marketplace = new ethers.Contract(marketAddr, MARKETPLACE_ABI, publicProvider);
    const activeIds = await marketplace.getActiveListings();

    const listings = await Promise.all(
      activeIds.map(async (id) => {
        const l = await marketplace.getListing(id);
        const tokenId = Number(l.tokenId);
        const lot = lotMetadata[tokenId] || {};
        return {
          listingId: Number(id),
          token: l.token,
          tokenId,
          price: ethers.formatEther(l.price),
          active: l.active,
          // Public metadata from our store
          variety: lot.variety || 'Unknown',
          weight: lot.weight || 'Unknown',
          status: lot.status || 'unknown',
        };
      })
    );

    res.json(listings);
  } catch (e) {
    res.json([]);
  }
});

// ─── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌱 CocoaLedger API running on http://localhost:${PORT}`);
  console.log(`   Privacy Node: ${PRIVACY_NODE_RPC}`);
  console.log(`   Public Chain: ${PUBLIC_CHAIN_RPC}`);
  console.log(`   NFT Address:  ${NFT_ADDRESS}\n`);
});
