// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HackathonNFT} from "../src/HackathonNFT.sol";
import {IDeploymentProxyRegistryV1} from "rayls-protocol-sdk/interfaces/IDeploymentProxyRegistryV1.sol";

/// @title DeployNFT
/// @notice Deploys HackathonNFT to the Privacy Node.
///         Infrastructure addresses are discovered from the on-chain DeploymentProxyRegistry.
///
/// Usage:
///   source .env
///   forge script script/DeployNFT.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
contract DeployNFT is Script {
    function run() external {
        address registryAddr = vm.envAddress("DEPLOYMENT_PROXY_REGISTRY");
        string memory nftUri = vm.envString("NFT_TOKEN_URI");
        string memory nftName = vm.envString("NFT_NAME");
        string memory nftSymbol = vm.envString("NFT_SYMBOL");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        IDeploymentProxyRegistryV1 registry = IDeploymentProxyRegistryV1(registryAddr);

        address endpoint = registry.getContract("Endpoint");
        address rnEndpoint = registry.getContract("RNEndpoint");
        address userGovernance = registry.getContract("RNUserGovernance");

        require(endpoint != address(0), "Endpoint not found in registry");
        require(rnEndpoint != address(0), "RNEndpoint not found in registry");
        require(userGovernance != address(0), "RNUserGovernance not found in registry");

        console.log("=== Infrastructure Addresses ===");
        console.log("  Endpoint:        ", endpoint);
        console.log("  RNEndpoint:      ", rnEndpoint);
        console.log("  RNUserGovernance:", userGovernance);

        vm.startBroadcast(deployerKey);

        HackathonNFT nft = new HackathonNFT(
            nftUri,
            nftName,
            nftSymbol,
            endpoint,
            rnEndpoint,
            userGovernance
        );

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployed ===");
        console.log("  HackathonNFT:", address(nft));
        console.log("");
        console.log("Next step: Set NFT_ADDRESS=%s in your .env", vm.toString(address(nft)));
    }
}
