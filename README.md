# Rayls Hackathon Starter

Deploy a bridgeable ERC20 token on your Rayls Privacy Node and transfer it to a public chain.

## What You'll Build

Each team gets a dedicated **Privacy Node** — a sovereign, gasless EVM chain where only you can see what's deployed. Your mission: take an asset from **invisible to tradeable**, with AI agents governing every step of the reveal.

The five-phase flow:

1. **Design Privately** — Deploy rich, complex assets on your Privacy Node. Full metadata, access rules, private balances. Nobody sees anything yet.
2. **AI Attestation** — An AI agent inspects your asset and produces a signed proof of existence, posted to the public chain without exposing private details.
3. **Governance & Approval** — Submit for institutional disclosure review. An AI compliance agent evaluates the asset and produces a structured recommendation.
4. **Bridge & Simplify** — Once approved, your complex private asset crosses to the Public L1 in a simplified, tradeable form. You decide what gets revealed.
5. **List & Trade** — Deploy a marketplace on the Public L1. Your once-invisible asset is now publicly discoverable — with full AI-attested provenance.

This starter repo covers the core building block: deploying a bridgeable token on your Privacy Node and teleporting it to the public chain (phases 1 and 4). You'll extend it with AI agents, governance logic, and a marketplace to complete your project.

See [Architecture Overview](docs/architecture.md) for how the bridge and contracts work under the hood.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed (`forge`, `cast`)
- [Node.js](https://nodejs.org/) 18+ installed (for `npm`)
- `curl` for API calls
- Backend URL + API keys (provided by hackathon organizers)

## Quick Setup

```bash
git clone <this-repo>
cd rayls-hackathon-starter
forge install
npm install
cp .env.example .env
```

Edit `.env` with the values provided by hackathon organizers:

```
PRIVACY_NODE_RPC_URL=<provided>
DEPLOYMENT_PROXY_REGISTRY=<provided>
PUBLIC_CHAIN_RPC_URL=<provided>
PUBLIC_CHAIN_ID=<provided>
BACKEND_URL=<provided>
USER_AUTH_KEY=<provided>
OPERATOR_AUTH_KEY=<provided>
DEPLOYER_PRIVATE_KEY=<your Foundry wallet key — generate with: cast wallet new>
```

Then load it:
```bash
source .env
```

> Re-run `source .env` whenever you update the file.

---

## Step-by-Step Guide

### Step 1: Register Your User

Create your identity and get wallet addresses for both chains.

```bash
curl -X POST "$BACKEND_URL/api/user/onboarding" \
  -H "Authorization: Bearer $USER_AUTH_KEY" \
  -H "Content-Type: application/json" \
  -d '{"external_user_id": "your-unique-id"}'
```

> Replace `"your-unique-id"` with any unique string (e.g. your team name). Use the **same ID** in Step 2.

Response:
```json
{
  "public_chain_address": "0xAAAA...",
  "private_chain_address": "0xBBBB...",
  "public_chain_private_key": "0x...",
  "private_chain_private_key": "0x...",
  "status": 0,
  "created_at": "..."
}
```

**Save all values from this response** — you'll need them in Step 3.

### Step 2: Approve Your User

Approve your address pair so you can bridge tokens.

```bash
curl -X PATCH "$BACKEND_URL/api/operator/onboarding/status" \
  -H "Authorization: Bearer $OPERATOR_AUTH_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "your-unique-id",
    "public_address": "<public_chain_address>",
    "private_address": "<private_chain_address>",
    "new_status": 1
  }'
```

> A successful response returns HTTP 200 with an empty body.

### Step 3: Update Your Environment

Update `.env` with the values from Step 1's response, then reload:

```
REGISTERED_PRIVATE_KEY=<private_chain_private_key from response>
MINT_RECIPIENT=<private_chain_address from response>
TRANSFER_TO=<public_chain_address from response>
TOKEN_NAME="My Token"
TOKEN_SYMBOL="MTK"
```

```bash
source .env
```

### Step 4: Deploy Your Token

```bash
forge script script/Deploy.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
```

The script discovers infrastructure addresses from the on-chain registry and deploys your token. Copy the deployed address and set it in your `.env`:
```
TOKEN_ADDRESS=<deployed address from output>
```

Then reload:
```bash
source .env
```

### Step 5: Register Your Token

Register the deployed token with the governance system.

```bash
curl -X POST "$BACKEND_URL/api/user/tokens" \
  -H "Authorization: Bearer $USER_AUTH_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$TOKEN_NAME\",
    \"symbol\": \"$TOKEN_SYMBOL\",
    \"address\": \"$TOKEN_ADDRESS\",
    \"uri\": \"\",
    \"standard\": 1
  }"
```

> `standard`: `1` = ERC20, `2` = ERC721, `3` = ERC1155

### Step 6: Approve Your Token

Activate the token. This triggers the relayer to deploy a mirror contract on the public chain.

```bash
curl -X PATCH "$BACKEND_URL/api/operator/tokens/status" \
  -H "Authorization: Bearer $OPERATOR_AUTH_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"address\": \"$TOKEN_ADDRESS\", \"status\": 1}"
```

### Step 7: Wait for Mirror Deployment

After approval, the relayer automatically:
1. Deploys a `PublicChainERC20` mirror on the public chain
2. Maps the private → public token addresses
3. Authorizes the mirror as a sender

**This takes ~30-60 seconds.** You can verify by running CheckBalance — if it prints a mirror address instead of reverting, the mirror is deployed:

```bash
forge script script/CheckBalance.s.sol --rpc-url $PRIVACY_NODE_RPC_URL
```

### Step 8: Mint Tokens

Mint tokens to your registered private-chain address (the one from Step 1).

```bash
forge script script/Mint.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
```

This calls `mint()` (onlyOwner) on your token, sending tokens to `MINT_RECIPIENT`.

### Step 9: Transfer to Public Chain

Bridge tokens from the Privacy Node to the public chain.

```bash
forge script script/Transfer.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
```

This calls `teleportToPublicChain()` which:
1. **Locks** tokens on the Privacy Node
2. Dispatches a cross-chain message
3. The relayer picks it up and submits to the public chain
4. The mirror contract **mints** tokens for you on the public chain

> **Note:** This script signs with `REGISTERED_PRIVATE_KEY` (your registered private-chain address), not `DEPLOYER_PRIVATE_KEY`. The `onlyRegisteredUsers` modifier requires `msg.sender` to be an approved user.

### Step 10: Verify on Public Chain

Check your balance on the public chain mirror contract. Your tokens should appear within a minute after the transfer.

```bash
forge script script/CheckBalance.s.sol --rpc-url $PRIVACY_NODE_RPC_URL
```

This script automatically discovers the mirror contract address from the on-chain governance registry, then queries the public chain for your balance.

---

## Using ERC721 or ERC1155

The same flow works for NFTs and multi-tokens. Use the matching scripts and set `standard` accordingly when registering via API.

| Standard | Contract | Deploy Script | Mint Script | Transfer Script | API `standard` |
|----------|----------|--------------|-------------|----------------|----------------|
| ERC20 | `HackathonToken.sol` | `Deploy.s.sol` | `Mint.s.sol` | `Transfer.s.sol` | `1` |
| ERC721 | `HackathonNFT.sol` | `DeployNFT.s.sol` | `MintNFT.s.sol` | `TransferNFT.s.sol` | `2` |
| ERC1155 | `HackathonMultiToken.sol` | `DeployMultiToken.s.sol` | `MintMultiToken.s.sol` | `TransferMultiToken.s.sol` | `3` |

Configure the matching env vars (see `.env.example` for `NFT_*` and `MULTI_TOKEN_*` sections), then follow Steps 4-10 using the corresponding scripts.

---

## Understanding the Two Keys

| Key | Used By | Purpose |
|-----|---------|---------|
| `DEPLOYER_PRIVATE_KEY` | Deploy.s.sol, Mint.s.sol | Your Foundry wallet. Owns the token contract. Can mint/burn. |
| `REGISTERED_PRIVATE_KEY` | Transfer.s.sol | Your registered private-chain address (from onboarding). Required by `onlyRegisteredUsers` modifier. |

## Challenge Tracks

Choose one of the three challenges:

### RWA Tokenization
Tokenize a real-world asset (bond, invoice, fund share) privately on your Privacy Node. An AI compliance agent reviews it before it goes public. Bridge a clean receipt token to a marketplace.
- **AI Role:** Governance compliance reviewer
- **Key contracts:** Your token + a governance contract that accepts/rejects AI recommendations

### Confidential NFT Reveal
Mint a high-value digital asset with fully private metadata. An AI oracle attests its existence on-chain. The asset reveals itself to buyers only after purchase.
- **AI Role:** Cross-chain attestation oracle
- **Key contracts:** Your token + an attestation contract on the public chain

### Autonomous Institution Agent
Build an AI agent that runs an entire institutional treasury: detecting assets, attesting them, submitting governance, bridging, and listing — autonomously. Humans watch; the agent operates.
- **AI Role:** Full autonomous orchestration
- **Key contracts:** Your token + the full five-phase pipeline scripted end-to-end

## AI Agent Skeleton

The `agent/` directory contains a minimal TypeScript example showing how to connect an AI to on-chain interactions. It demonstrates one pattern in three steps:

1. **Read** — connects to the public chain via ethers.js and reads a bridged token's name, symbol, and supply
2. **Analyze** — sends the token data to an LLM and gets back a structured verdict (approved/rejected, score, reasoning)
3. **Write** — posts the AI's verdict as an on-chain attestation by calling `Attestation.sol`

```bash
cd agent && npm install && cp .env.example .env
# Fill in your values, then:
npm start
```

Supports **Google Gemini** (free tier — no credit card), **Anthropic** (Claude), and **OpenAI**. Set `AI_PROVIDER` in `agent/.env`.

This is one pattern — adapt the read/analyze/write steps to your challenge track. The repo also includes `Attestation.sol` and `DeployPublic.s.sol` as optional building blocks.

## Customizing Your Token

Edit `src/HackathonToken.sol` — there are commented-out examples for:

1. **Custom decimals** — e.g. 6 decimals for stablecoins
2. **Receive validation** — add custom checks on incoming public chain transfers
3. **AccessControl** — role-based mint/burn permissions

## Transferring Back (Public → Private)

To return tokens from the public chain to your Privacy Node, call `teleportToPrivacyNode()` on the mirror contract. You'll need the public chain RPC and your public chain private key (from the onboarding response).

**ERC20:**
```bash
cast send <PUBLIC_MIRROR_ADDRESS> \
  "teleportToPrivacyNode(address,uint256,uint256)" \
  <YOUR_PRIVATE_CHAIN_ADDRESS> <AMOUNT_IN_WEI> <PRIVACY_NODE_CHAIN_ID> \
  --rpc-url $PUBLIC_CHAIN_RPC_URL \
  --private-key <PUBLIC_CHAIN_PRIVATE_KEY> \
  --legacy
```

**ERC721:**
```bash
cast send <PUBLIC_MIRROR_ADDRESS> \
  "teleportToPrivacyNode(address,uint256,uint256)" \
  <YOUR_PRIVATE_CHAIN_ADDRESS> <TOKEN_ID> <PRIVACY_NODE_CHAIN_ID> \
  --rpc-url $PUBLIC_CHAIN_RPC_URL \
  --private-key <PUBLIC_CHAIN_PRIVATE_KEY> \
  --legacy
```

**ERC1155:**
```bash
cast send <PUBLIC_MIRROR_ADDRESS> \
  "teleportToPrivacyNode(address,uint256,uint256,uint256)" \
  <YOUR_PRIVATE_CHAIN_ADDRESS> <TOKEN_ID> <AMOUNT> <PRIVACY_NODE_CHAIN_ID> \
  --rpc-url $PUBLIC_CHAIN_RPC_URL \
  --private-key <PUBLIC_CHAIN_PRIVATE_KEY> \
  --legacy
```

The mirror address is shown in the `CheckBalance.s.sol` output, or query it via the governance API.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `User not registered` | Your address isn't approved in RNUserGovernanceV1 | Complete Steps 1-2 |
| `Token not found` or reverts on transfer | Token not registered/activated | Complete Steps 5-6 and wait for mirror deployment |
| `Ownable: caller is not the owner` | Wrong key used for mint | Use `DEPLOYER_PRIVATE_KEY` for Mint.s.sol |
| Transfer succeeds but no tokens on public chain | Relayer hasn't processed yet | Wait ~60 seconds, then check again |
| `Failed to get EIP-1559 fees` | Rayls Privacy Nodes are gasless and don't support EIP-1559 | Add `--legacy` flag to your `forge script` command (already included in all commands above) |
| Token approval returns HTTP 500 | Backend needs a moment after token registration | Retry the same curl command after 5 seconds |
| Mirror address returns `0x0000...0000` | Relayer hasn't deployed the mirror yet | Wait 30-60 seconds after token approval |

## Debugging

Inspect a failed transaction:
```bash
cast run <TX_HASH> --rpc-url $PRIVACY_NODE_RPC_URL
```

Check if the mirror contract is deployed:
```bash
# Get the TokenGovernance address
TOKEN_GOV=$(cast call $DEPLOYMENT_PROXY_REGISTRY "getContract(string)(address)" "RNTokenGovernance" --rpc-url $PRIVACY_NODE_RPC_URL)

# Query the public mirror address
cast call $TOKEN_GOV "getPublicAddressByPrivateAddress(address)(address)" $TOKEN_ADDRESS --rpc-url $PRIVACY_NODE_RPC_URL
```

Check your balances:
```bash
# Balance on Privacy Node
cast call $TOKEN_ADDRESS "balanceOf(address)(uint256)" <YOUR_ADDRESS> --rpc-url $PRIVACY_NODE_RPC_URL

# Locked amount (tokens currently bridged to public)
cast call $TOKEN_ADDRESS "getLockedAmount(address)(uint256)" <YOUR_ADDRESS> --rpc-url $PRIVACY_NODE_RPC_URL
```

## Further Reading

- [Architecture Overview](docs/architecture.md) — how the bridge works
- [API Reference](docs/api-reference.md) — complete backend endpoint documentation
