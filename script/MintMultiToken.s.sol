// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HackathonMultiToken} from "../src/HackathonMultiToken.sol";

/// @title MintMultiToken
/// @notice Mints ERC1155 tokens to a recipient. Must be called by the token owner (deployer).
///
/// Usage:
///   source .env
///   forge script script/MintMultiToken.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
contract MintMultiToken is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address tokenAddr = vm.envAddress("MULTI_TOKEN_ADDRESS");
        address recipient = vm.envAddress("MINT_RECIPIENT");
        uint256 tokenId = vm.envUint("MULTI_TOKEN_MINT_ID");
        uint256 amount = vm.envUint("MULTI_TOKEN_MINT_AMOUNT");

        HackathonMultiToken token = HackathonMultiToken(tokenAddr);

        vm.startBroadcast(deployerKey);
        token.mint(recipient, tokenId, amount, "");
        vm.stopBroadcast();

        console.log("Minted %s units of token #%s to %s", amount, tokenId, recipient);
    }
}
