const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// ─── API Routes ────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'CocoaLedger' });
});

// POST /api/lot — Register a new cacao lot (mint NFT with metadata)
app.post('/api/lot', async (req, res) => {
  try {
    const metadata = req.body;

    if (!metadata.variety || !metadata.region || !metadata.weight) {
      return res.status(400).json({ error: 'Required fields: variety, region, weight' });
    }

    const tokenId = nextTokenId++;

    // Store metadata privately (simulates Privacy Node storage)
    lotMetadata[tokenId] = {
      ...metadata,
      tokenId,
      createdAt: new Date().toISOString(),
      status: 'private', // private -> attested -> bridged -> listed
    };

    // Mint NFT on Privacy Node
    const nft = new ethers.Contract(NFT_ADDRESS, NFT_ABI, deployerWallet);
    const tx = await nft.mint(MINT_RECIPIENT, tokenId);
    await tx.wait();

    console.log(`🌱 Minted cacao lot NFT #${tokenId} on Privacy Node`);

    res.json({
      success: true,
      tokenId,
      message: `Cacao lot #${tokenId} registered on Privacy Node`,
      metadata: {
        // Only return non-sensitive summary
        variety: metadata.variety,
        weight: metadata.weight,
        region: '***PRIVATE***',
        cooperative: '***PRIVATE***',
      },
    });
  } catch (e) {
    console.error('Mint error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/lot/:tokenId — Get lot info (respects privacy)
app.get('/api/lot/:tokenId', (req, res) => {
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

// POST /api/lot/:tokenId/reveal — Reveal full metadata (after purchase)
app.post('/api/lot/:tokenId/reveal', (req, res) => {
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

// GET /api/lots — List all lots with their public status
app.get('/api/lots', (req, res) => {
  const lots = Object.values(lotMetadata).map((lot) => ({
    tokenId: lot.tokenId,
    variety: lot.variety,
    weight: lot.weight,
    status: lot.status,
    harvest: lot.harvest || 'N/A',
    createdAt: lot.createdAt,
  }));
  res.json(lots);
});

// POST /api/lot/:tokenId/bridge — Bridge NFT to public chain
app.post('/api/lot/:tokenId/bridge', async (req, res) => {
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
app.get('/api/attestations', async (req, res) => {
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
app.get('/api/marketplace/listings', async (req, res) => {
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
