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

    struct QueuedAction {
        string  agentId;
        address target;
        uint256 value;
        bytes   data;
        string  instruction;
        uint256 threatScore;
        uint256 queuedAt;
        bool    resolved;
    }

    // ---------------------------------------------------------------
    //  State
    // ---------------------------------------------------------------

    mapping(string => Agent) public agents;
    string[] public agentIds;

    mapping(string => mapping(address => bool)) public allowedTargets;

    mapping(uint256 => QueuedAction) public actionQueue;
    uint256 public nextQueueId;

    IENSResolver public ensResolver;

    uint256 public blockThreshold = 70_000;
    uint256 public escalateThreshold = 40_000;
    uint256 public maxStrikes = 5;

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

    event AgentDeactivated(string indexed agentId, string reason);

    event AllowedTargetUpdated(
        string  indexed agentId,
        address target,
        bool    allowed
    );

    event ActionSubmitted(
        uint256 indexed actionId,
        string  indexed agentId,
        address target,
        uint256 value,
        string  instruction
    );

    event ActionApproved(uint256 indexed actionId, string indexed agentId);

    event ActionBlocked(
        uint256 indexed actionId,
        string  indexed agentId,
        string  reason
    );

    event ActionEscalated(
        uint256 indexed actionId,
        string  indexed agentId,
        uint256 threatScore
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
    //  Agent Lifecycle
    // ---------------------------------------------------------------

    function deactivateAgent(
        string calldata agentId
    ) external onlyOwner agentExists(agentId) {
        agents[agentId].active = false;
        emit AgentDeactivated(agentId, "Manual deactivation by owner");
    }

    function reactivateAgent(
        string calldata agentId
    ) external onlyOwner agentExists(agentId) {
        agents[agentId].active = true;
    }

    // ---------------------------------------------------------------
    //  Allowed Targets
    // ---------------------------------------------------------------

    function setAllowedTarget(
        string calldata agentId,
        address target,
        bool allowed
    ) external onlyOwner agentExists(agentId) {
        allowedTargets[agentId][target] = allowed;
        emit AllowedTargetUpdated(agentId, target, allowed);
    }

    function setAllowedTargets(
        string calldata agentId,
        address[] calldata targets,
        bool allowed
    ) external onlyOwner agentExists(agentId) {
        for (uint256 i = 0; i < targets.length; i++) {
            allowedTargets[agentId][targets[i]] = allowed;
            emit AllowedTargetUpdated(agentId, targets[i], allowed);
        }
    }

    function isTargetAllowed(
        string calldata agentId,
        address target
    ) external view returns (bool) {
        return allowedTargets[agentId][target];
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
