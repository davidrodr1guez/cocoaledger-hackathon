// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Attestation} from "../src/Attestation.sol";

/// @title DeployPublic
/// @notice Deploys the Attestation contract on the public chain.
///
/// Usage:
///   source .env
///   forge script script/DeployPublic.s.sol --rpc-url $PUBLIC_CHAIN_RPC_URL --broadcast --legacy
contract DeployPublic is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        Attestation attestation = new Attestation();
        vm.stopBroadcast();

        console.log("=== Deployed to Public Chain ===");
        console.log("  Attestation:", address(attestation));
        console.log("");
        console.log("Add to your .env:");
        console.log("  ATTESTATION_ADDRESS=%s", vm.toString(address(attestation)));
    }
}
