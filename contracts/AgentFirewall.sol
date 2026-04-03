// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ENShell AgentFirewall
/// @notice On-chain firewall for AI agents. Registry, scoring, and event layer.

interface IENSResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

contract AgentFirewall is Ownable {

    // ---------------------------------------------------------------
    //  Structs
    // ---------------------------------------------------------------

    struct Agent {
        bytes32 ensNode;
        address agentAddress;
        uint256 spendLimit;
        uint256 threatScore;
        uint256 strikes;
        bool    active;
        bool    worldIdVerified;
        uint256 registeredAt;
    }

    // ---------------------------------------------------------------
    //  State
    // ---------------------------------------------------------------

    mapping(string => Agent) public agents;
    string[] public agentIds;

    IENSResolver public ensResolver;

    // ---------------------------------------------------------------
    //  Events
    // ---------------------------------------------------------------

    event AgentRegistered(
        string indexed agentId,
        bytes32 ensNode,
        address agentAddress,
        uint256 spendLimit,
        bool    worldIdVerified
    );

    // ---------------------------------------------------------------
    //  Modifiers
    // ---------------------------------------------------------------

    modifier agentExists(string calldata agentId) {
        require(agents[agentId].registeredAt != 0, "Agent not found");
        _;
    }

    // ---------------------------------------------------------------
    //  Constructor
    // ---------------------------------------------------------------

    constructor(address _ensResolver) Ownable(msg.sender) {
        ensResolver = IENSResolver(_ensResolver);
    }
}
