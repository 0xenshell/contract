// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal mock that records setText calls for test assertions.
contract MockENSResolver {
    mapping(bytes32 => mapping(string => string)) private _records;

    function setText(bytes32 node, string calldata key, string calldata value) external {
        _records[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _records[node][key];
    }
}
