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
        bytes32 instructionHash;
        uint256 queuedAt;
        bool    resolved;
        uint8   decision;       // 0 = pending, 1 = approved, 2 = escalated, 3 = blocked
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
    address public creOracle;

    uint256 public blockThreshold = 70_000;
    uint256 public escalateThreshold = 40_000;
    uint256 public maxStrikes = 5;

    uint256 public constant EMA_ALPHA = 300;
    uint256 public constant EMA_SCALE = 1000;

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
        bytes32 instructionHash
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

    event ThreatScoreUpdated(
        string  indexed agentId,
        uint256 previousScore,
        uint256 newScore,
        uint256 rawDetectionScore,
        uint256 strikes
    );

    event TrustChecked(
        string  indexed checkerAgentId,
        string  indexed targetAgentId,
        uint256 threatScore,
        uint256 strikes,
        bool    trusted
    );

    // ---------------------------------------------------------------
    //  Modifiers
    // ---------------------------------------------------------------

    modifier onlyOracle() {
        require(msg.sender == creOracle, "Only CRE oracle");
        _;
    }

    modifier agentExists(string calldata agentId) {
        require(agents[agentId].registeredAt != 0, "Agent not found");
        _;
    }

    // ---------------------------------------------------------------
    //  Constructor
    // ---------------------------------------------------------------

    constructor(address _ensResolver, address _creOracle) Ownable(msg.sender) {
        ensResolver = IENSResolver(_ensResolver);
        creOracle = _creOracle;
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
    //  Action Submission
    // ---------------------------------------------------------------

    /// @notice Submit an action for CRE analysis. Basic policy checks are applied
    ///         as circuit breakers; all passing actions are queued for the CRE oracle
    ///         to resolve (approve / escalate / block).
    function submitAction(
        string calldata agentId,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 instructionHash
    ) external agentExists(agentId) returns (uint256 actionId) {
        Agent storage agent = agents[agentId];
        require(agent.active, "Agent is frozen");
        require(agent.strikes < maxStrikes, "Max strikes exceeded");

        actionId = _queueAction(agentId, target, value, data, instructionHash);
        return actionId;
    }

    // ---------------------------------------------------------------
    //  CRE Oracle Resolution
    // ---------------------------------------------------------------

    /// @notice CRE oracle resolves a queued action after off-chain analysis.
    /// @param actionId The queued action ID
    /// @param decision 1 = approve, 2 = escalate (to Ledger owner), 3 = block
    function resolveAction(
        uint256 actionId,
        uint8 decision
    ) external onlyOracle {
        QueuedAction storage action = actionQueue[actionId];
        require(action.queuedAt != 0, "Action not found");
        require(action.decision == 0, "Already resolved");
        require(decision >= 1 && decision <= 3, "Invalid decision");

        action.decision = decision;

        if (decision == 1) {
            action.resolved = true;
            emit ActionApproved(actionId, action.agentId);
        } else if (decision == 2) {
            emit ActionEscalated(actionId, action.agentId, agents[action.agentId].threatScore);
        } else {
            action.resolved = true;
            emit ActionBlocked(actionId, action.agentId, "Blocked by CRE oracle");
        }
    }

    // ---------------------------------------------------------------
    //  Ledger Approval (for escalated actions only)
    // ---------------------------------------------------------------

    function approveAction(uint256 actionId) external onlyOwner {
        QueuedAction storage action = actionQueue[actionId];
        require(action.queuedAt != 0, "Action not found");
        require(action.decision == 2, "Action not escalated");
        require(!action.resolved, "Already resolved");
        action.resolved = true;
        emit ActionApproved(actionId, action.agentId);
    }

    function rejectAction(uint256 actionId) external onlyOwner {
        QueuedAction storage action = actionQueue[actionId];
        require(action.queuedAt != 0, "Action not found");
        require(action.decision == 2, "Action not escalated");
        require(!action.resolved, "Already resolved");
        action.resolved = true;
        emit ActionBlocked(actionId, action.agentId, "Rejected by owner via Ledger");
    }

    // ---------------------------------------------------------------
    //  Threat Score Updates (CRE oracle)
    // ---------------------------------------------------------------

    function updateThreatScore(
        string calldata agentId,
        uint256 rawScore
    ) external onlyOracle agentExists(agentId) {
        Agent storage agent = agents[agentId];
        uint256 previousScore = agent.threatScore;

        uint256 newScore = (EMA_ALPHA * rawScore + (EMA_SCALE - EMA_ALPHA) * previousScore) / EMA_SCALE;
        agent.threatScore = newScore;

        if (rawScore >= escalateThreshold) {
            agent.strikes += 1;
        }

        if (agent.strikes >= maxStrikes) {
            agent.active = false;
            emit AgentDeactivated(agentId, "Auto-frozen: max strikes exceeded");
        }

        _updateENSRecords(agentId);

        emit ThreatScoreUpdated(agentId, previousScore, newScore, rawScore, agent.strikes);
    }

    // ---------------------------------------------------------------
    //  Trust Mesh
    // ---------------------------------------------------------------

    /// @notice Check if a target agent is trusted. Emits TrustChecked event.
    function checkTrust(
        string calldata checkerAgentId,
        string calldata targetAgentId
    ) external agentExists(checkerAgentId) agentExists(targetAgentId) returns (bool trusted) {
        trusted = isTrusted(targetAgentId);
        Agent storage target = agents[targetAgentId];
        emit TrustChecked(checkerAgentId, targetAgentId, target.threatScore, target.strikes, trusted);
        return trusted;
    }

    /// @notice View whether an agent is trusted (active, below thresholds).
    function isTrusted(
        string calldata agentId
    ) public view agentExists(agentId) returns (bool) {
        Agent storage agent = agents[agentId];
        if (!agent.active) return false;
        if (agent.threatScore >= blockThreshold) return false;
        if (agent.strikes >= maxStrikes) return false;
        return true;
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

    function getQueuedAction(uint256 actionId) external view returns (QueuedAction memory) {
        return actionQueue[actionId];
    }

    // ---------------------------------------------------------------
    //  Admin
    // ---------------------------------------------------------------

    function setMaxStrikes(uint256 _max) external onlyOwner {
        maxStrikes = _max;
    }

    function setBlockThreshold(uint256 _threshold) external onlyOwner {
        blockThreshold = _threshold;
    }

    function setEscalateThreshold(uint256 _threshold) external onlyOwner {
        escalateThreshold = _threshold;
    }

    function setCreOracle(address _creOracle) external onlyOwner {
        creOracle = _creOracle;
    }

    function setENSResolver(address _ensResolver) external onlyOwner {
        ensResolver = IENSResolver(_ensResolver);
    }

    // ---------------------------------------------------------------
    //  Internal Helpers
    // ---------------------------------------------------------------

    function _queueAction(
        string calldata agentId,
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 instructionHash
    ) internal returns (uint256 actionId) {
        actionId = nextQueueId++;
        actionQueue[actionId] = QueuedAction({
            agentId: agentId,
            target: target,
            value: value,
            data: data,
            instructionHash: instructionHash,
            queuedAt: block.timestamp,
            resolved: false,
            decision: 0
        });
        emit ActionSubmitted(actionId, agentId, target, value, instructionHash);
        return actionId;
    }

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
