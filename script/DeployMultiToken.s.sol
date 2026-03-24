// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HackathonMultiToken} from "../src/HackathonMultiToken.sol";
import {IDeploymentProxyRegistryV1} from "rayls-protocol-sdk/interfaces/IDeploymentProxyRegistryV1.sol";

/// @title DeployMultiToken
/// @notice Deploys HackathonMultiToken (ERC1155) to the Privacy Node.
///
/// Usage:
///   source .env
///   forge script script/DeployMultiToken.s.sol --rpc-url $PRIVACY_NODE_RPC_URL --broadcast --legacy
contract DeployMultiToken is Script {
    function run() external {
        address registryAddr = vm.envAddress("DEPLOYMENT_PROXY_REGISTRY");
        string memory uri = vm.envString("MULTI_TOKEN_URI");
        string memory name = vm.envString("MULTI_TOKEN_NAME");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        IDeploymentProxyRegistryV1 registry = IDeploymentProxyRegistryV1(registryAddr);

        address endpoint = registry.getContract("Endpoint");
        address rnEndpoint = registry.getContract("RNEndpoint");
        address userGovernance = registry.getContract("RNUserGovernance");

        require(endpoint != address(0), "Endpoint not found in registry");
        require(rnEndpoint != address(0), "RNEndpoint not found in registry");
        require(userGovernance != address(0), "RNUserGovernance not found in registry");

        vm.startBroadcast(deployerKey);

        HackathonMultiToken token = new HackathonMultiToken(
            uri,
            name,
            endpoint,
            rnEndpoint,
            userGovernance
        );

        vm.stopBroadcast();

        console.log("=== Deployed ===");
        console.log("  HackathonMultiToken:", address(token));
        console.log("");
        console.log("Next step: Set MULTI_TOKEN_ADDRESS=%s in your .env", vm.toString(address(token)));
    }
}
