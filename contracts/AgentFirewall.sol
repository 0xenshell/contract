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

    // ---------------------------------------------------------------
    //  Agent Registration
    // ---------------------------------------------------------------

    /// @notice Register agent without World ID (fully functional, not just for testing)
    function registerAgentSimple(
        string calldata agentId,
        bytes32 ensNode,
        address agentAddress,
        uint256 spendLimit
    ) external onlyOwner {
        require(agents[agentId].registeredAt == 0, "Agent already registered");

        agents[agentId] = Agent({
            ensNode: ensNode,
            agentAddress: agentAddress,
            spendLimit: spendLimit,
            threatScore: 0,
            strikes: 0,
            active: true,
            worldIdVerified: false,
            registeredAt: block.timestamp
        });

        agentIds.push(agentId);
        _updateENSRecords(agentId);

        emit AgentRegistered(agentId, ensNode, agentAddress, spendLimit, false);
    }

    // ---------------------------------------------------------------
    //  View Functions
    // ---------------------------------------------------------------

    function getAgent(string calldata agentId) external view returns (Agent memory) {
        require(agents[agentId].registeredAt != 0, "Agent not found");
        return agents[agentId];
    }

    function getAgentCount() external view returns (uint256) {
        return agentIds.length;
    }

    // ---------------------------------------------------------------
    //  Internal Helpers
    // ---------------------------------------------------------------

    function _updateENSRecords(string calldata agentId) internal {
        Agent storage agent = agents[agentId];
        ensResolver.setText(agent.ensNode, "threat-score", _uint2str(agent.threatScore));
        ensResolver.setText(agent.ensNode, "threat-strikes", _uint2str(agent.strikes));
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
