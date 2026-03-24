// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HackathonMultiToken} from "../src/HackathonMultiToken.sol";

/// @title TransferMultiToken
/// @notice Transfers ERC1155 tokens from the Privacy Node to the public chain.
///
///         IMPORTANT: Must be signed with REGISTERED_PRIVATE_KEY.
///
/// Usage:
///   source .env
///   forge script script/TransferMultiToken.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
contract TransferMultiToken is Script {
    function run() external {
        uint256 registeredKey = vm.envUint("REGISTERED_PRIVATE_KEY");
        address tokenAddr = vm.envAddress("MULTI_TOKEN_ADDRESS");
        address to = vm.envAddress("TRANSFER_TO");
        uint256 tokenId = vm.envUint("MULTI_TOKEN_TRANSFER_ID");
        uint256 amount = vm.envUint("MULTI_TOKEN_TRANSFER_AMOUNT");
        uint256 publicChainId = vm.envUint("PUBLIC_CHAIN_ID");

        HackathonMultiToken token = HackathonMultiToken(tokenAddr);

        vm.startBroadcast(registeredKey);
        bool success = token.teleportToPublicChain(to, tokenId, amount, publicChainId, "");
        vm.stopBroadcast();

        require(success, "teleportToPublicChain failed");

        console.log("=== Multi-Token Teleport Initiated ===");
        console.log("  Token:    ", tokenAddr);
        console.log("  ID:       ", tokenId);
        console.log("  Amount:   ", amount);
        console.log("  To:       ", to);
        console.log("  Chain ID: ", publicChainId);
    }
}
