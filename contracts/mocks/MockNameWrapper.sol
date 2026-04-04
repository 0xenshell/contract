// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal mock that records setSubnodeRecord calls for test assertions.
contract MockNameWrapper {
    mapping(bytes32 => bool) public subnodesCreated;

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32) {
        bytes32 labelHash = keccak256(bytes(label));
        bytes32 node = keccak256(abi.encodePacked(parentNode, labelHash));
        subnodesCreated[node] = true;
        return node;
    }
}
