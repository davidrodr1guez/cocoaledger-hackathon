// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HackathonNFT} from "../src/HackathonNFT.sol";

/// @title MintNFT
/// @notice Mints an NFT to a recipient address. Must be called by the token owner (deployer).
///
/// Usage:
///   source .env
///   forge script script/MintNFT.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
contract MintNFT is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address nftAddr = vm.envAddress("NFT_ADDRESS");
        address recipient = vm.envAddress("MINT_RECIPIENT");
        uint256 tokenId = vm.envUint("NFT_MINT_TOKEN_ID");

        HackathonNFT nft = HackathonNFT(nftAddr);

        vm.startBroadcast(deployerKey);
        nft.mint(recipient, tokenId);
        vm.stopBroadcast();

        console.log("Minted NFT #%s to %s", tokenId, recipient);
    }
}
