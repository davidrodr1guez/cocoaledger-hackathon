// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CocoaLedger} from "../src/CocoaLedger.sol";

/// @title DeployCocoaLedger
/// @notice Deploys CocoaLedger to the Privacy Node.
///
/// Usage:
///   source .env
///   forge script script/DeployCocoaLedger.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
contract DeployCocoaLedger is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        CocoaLedger ledger = new CocoaLedger();
        vm.stopBroadcast();

        console.log("=== Deployed to Privacy Node ===");
        console.log("  CocoaLedger:", address(ledger));
        console.log("");
        console.log("Add to your .env:");
        console.log("  COCOA_LEDGER_ADDRESS=%s", vm.toString(address(ledger)));
    }
}
