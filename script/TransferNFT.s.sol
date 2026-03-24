// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HackathonNFT} from "../src/HackathonNFT.sol";

/// @title TransferNFT
/// @notice Transfers an NFT from the Privacy Node to the public chain via teleportToPublicChain().
///
///         IMPORTANT: This script must be signed with REGISTERED_PRIVATE_KEY — the private key
///         of your registered private-chain address (from the onboarding response).
///
/// Usage:
///   source .env
///   forge script script/TransferNFT.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
contract TransferNFT is Script {
    function run() external {
        uint256 registeredKey = vm.envUint("REGISTERED_PRIVATE_KEY");
        address nftAddr = vm.envAddress("NFT_ADDRESS");
        address to = vm.envAddress("TRANSFER_TO");
        uint256 tokenId = vm.envUint("NFT_TRANSFER_TOKEN_ID");
        uint256 publicChainId = vm.envUint("PUBLIC_CHAIN_ID");

        HackathonNFT nft = HackathonNFT(nftAddr);

        vm.startBroadcast(registeredKey);
        bool success = nft.teleportToPublicChain(to, tokenId, publicChainId);
        vm.stopBroadcast();

        require(success, "teleportToPublicChain failed");

        console.log("=== NFT Teleport Initiated ===");
        console.log("  NFT:      ", nftAddr);
        console.log("  Token ID: ", tokenId);
        console.log("  To:       ", to);
        console.log("  Chain ID: ", publicChainId);
        console.log("");
        console.log("NFT is locked on the Privacy Node.");
        console.log("The relayer will mint it on the public chain shortly.");
    }
}
