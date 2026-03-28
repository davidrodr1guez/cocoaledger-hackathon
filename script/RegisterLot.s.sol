// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CocoaLedger} from "../src/CocoaLedger.sol";

/// @title RegisterLot
/// @notice Registers a sample cacao lot and records IoT data on the Privacy Node.
contract RegisterLot is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address ledgerAddr = vm.envAddress("COCOA_LEDGER_ADDRESS");
        CocoaLedger ledger = CocoaLedger(ledgerAddr);

        vm.startBroadcast(deployerKey);

        // 1. Register lot
        uint256 lotId = ledger.registerLot(
            "Criollo Fino de Aroma",
            "Tumaco, Narino",
            "CoopCacao Tumaco",
            500,                        // weight kg
            "2026-Q1",
            "Organic,Rainforest Alliance",
            200                         // purchase price $2.00/kg — PRIVATE
        );
        console.log("Registered lot #%s", lotId);

        // 2. Set details + flavor profile
        uint256[5] memory flavor = [uint256(75), 42, 81, 68, 79];
        ledger.setLotDetails(
            lotId,
            450,                // altitude
            6,                  // ferment days
            "Solar, 5 days",
            720,                // humidity 7.2%
            8,                  // farmer exp years
            flavor
        );
        console.log("  Details set");

        // 3. Record IoT readings
        ledger.recordIoTData(lotId, 1782000, -78890000, 450, 6550, 620, 2350, 8200, 1250);
        console.log("  IoT reading 1: morning (23.5C, 82%% humidity)");

        ledger.recordIoTData(lotId, 1782000, -78890000, 450, 6200, 620, 2850, 7500, 0);
        console.log("  IoT reading 2: afternoon (28.5C, 75%% humidity)");

        ledger.recordIoTData(lotId, 1782000, -78890000, 450, 6800, 620, 2150, 8800, 500);
        console.log("  IoT reading 3: evening (21.5C, 88%% humidity)");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Lot Registered with IoT Data ===");
        console.log("  Lot ID:       %s", lotId);
        console.log("  Variety:      Criollo Fino de Aroma");
        console.log("  Region:       [PRIVATE] Tumaco, Narino");
        console.log("  GPS:          [PRIVATE] 1.782, -78.89");
        console.log("  Buy Price:    [PRIVATE] $2.00/kg");
        console.log("  IoT Readings: 3");
        console.log("");
        console.log("All data on Privacy Node. Invisible to public chain.");
    }
}
