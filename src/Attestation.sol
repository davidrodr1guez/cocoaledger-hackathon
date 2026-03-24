// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Attestation
/// @notice Minimal on-chain registry for AI attestations.
///         AI agents post their analysis of bridged assets here.
///         This is a skeleton — add your own access control, validation, or scoring logic.
contract Attestation {

    struct AttestationData {
        address attester;
        address token;
        bool approved;
        string reason;
        uint256 score;          // 0-100
        uint256 timestamp;
    }

    mapping(address => AttestationData[]) public attestations;

    event Attested(address indexed token, address indexed attester, bool approved, uint256 score);

    function attest(address token, bool approved, string calldata reason, uint256 score) external {
        require(token != address(0), "Invalid token");
        require(score <= 100, "Score must be 0-100");

        attestations[token].push(AttestationData({
            attester: msg.sender,
            token: token,
            approved: approved,
            reason: reason,
            score: score,
            timestamp: block.timestamp
        }));

        emit Attested(token, msg.sender, approved, score);
    }

    function getAttestations(address token) external view returns (AttestationData[] memory) {
        return attestations[token];
    }

    function getAttestationCount(address token) external view returns (uint256) {
        return attestations[token].length;
    }
}
