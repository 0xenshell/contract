import { expect } from "chai";
import { setupAgentFirewall } from "./utils.js";

describe("AgentFirewall", function () {
  let ethers: any;
  let owner: any;
  let agent1: any;
  let forwarder: any;
  let other: any;
  let firewall: any;
  let ensResolver: any;

  // ensNode is computed by the contract from agentId + ensParentNode

  beforeEach(async function () {
    const env = await setupAgentFirewall();
    ethers = env.ethers;
    owner = env.owner;
    agent1 = env.agent1;
    forwarder = env.forwarder;
    other = env.other;
    firewall = env.firewall;
    ensResolver = env.ensResolver;
  });

  describe("registerAgentSimple", function () {
    it("registers an agent successfully", async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );

      const agent = await firewall.getAgent("trader");
      expect(agent.ensNode).to.not.equal(ethers.ZeroHash);
      expect(agent.agentAddress).to.equal(agent1.address);
      expect(agent.spendLimit).to.equal(ethers.parseEther("0.1"));
      expect(agent.threatScore).to.equal(0);
      expect(agent.strikes).to.equal(0);
      expect(agent.active).to.equal(true);
      expect(agent.worldIdVerified).to.equal(false);
      expect(agent.registeredAt).to.be.gt(0);
    });

    it("increments agent count", async function () {
      expect(await firewall.getAgentCount()).to.equal(0);

      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );

      expect(await firewall.getAgentCount()).to.equal(1);
    });

    it("emits AgentRegistered event", async function () {
      await expect(
        firewall.registerAgentSimple(
          "trader",
          agent1.address,
          ethers.parseEther("0.1"),
        ),
      ).to.emit(firewall, "AgentRegistered");
    });

    it("writes initial ENS records", async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );

      const agent = await firewall.getAgent("trader");
      expect(await ensResolver.text(agent.ensNode, "threat-score")).to.equal("0");
      expect(await ensResolver.text(agent.ensNode, "threat-strikes")).to.equal("0");
    });

    it("reverts on duplicate agent", async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );

      await expect(
        firewall.registerAgentSimple(
          "trader",
          agent1.address,
          ethers.parseEther("0.1"),
        ),
      ).to.be.revertedWith("Agent already registered");
    });

    it("allows anyone to register an agent", async function () {
      const tx = await firewall
        .connect(other)
        .registerAgentSimple(
          "public-agent",
          agent1.address,
          ethers.parseEther("0.1"),
        );
      await tx.wait();
      const agent = await firewall.getAgent("public-agent");
      expect(agent.agentAddress).to.equal(agent1.address);
    });
  });

  describe("getAgent", function () {
    it("reverts for non-existent agent", async function () {
      await expect(
        firewall.getAgent("ghost"),
      ).to.be.revertedWith("Agent not found");
    });
  });

  describe("deactivateAgent", function () {
    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );
    });

    it("deactivates an agent", async function () {
      await firewall.deactivateAgent("trader");
      const agent = await firewall.getAgent("trader");
      expect(agent.active).to.equal(false);
    });

    it("emits AgentDeactivated event", async function () {
      await expect(firewall.deactivateAgent("trader"))
        .to.emit(firewall, "AgentDeactivated")
        .withArgs("trader", "Manual deactivation by owner");
    });

    it("reverts for non-existent agent", async function () {
      await expect(
        firewall.deactivateAgent("ghost"),
      ).to.be.revertedWith("Agent not found");
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        firewall.connect(other).deactivateAgent("trader"),
      ).to.be.revertedWith("Not agent or contract owner");
    });
  });

  describe("reactivateAgent", function () {
    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.deactivateAgent("trader");
    });

    it("reactivates a deactivated agent", async function () {
      await firewall.reactivateAgent("trader");
      const agent = await firewall.getAgent("trader");
      expect(agent.active).to.equal(true);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        firewall.connect(other).reactivateAgent("trader"),
      ).to.be.revertedWith("Not agent or contract owner");
    });
  });

  describe("allowedTargets", function () {
    const target1 = "0x1111111111111111111111111111111111111111";
    const target2 = "0x2222222222222222222222222222222222222222";

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );
    });

    it("sets a single allowed target", async function () {
      await firewall.setAllowedTarget("trader", target1, true);
      expect(await firewall.isTargetAllowed("trader", target1)).to.equal(true);
      expect(await firewall.isTargetAllowed("trader", target2)).to.equal(false);
    });

    it("emits AllowedTargetUpdated event", async function () {
      await expect(firewall.setAllowedTarget("trader", target1, true))
        .to.emit(firewall, "AllowedTargetUpdated")
        .withArgs("trader", target1, true);
    });

    it("revokes an allowed target", async function () {
      await firewall.setAllowedTarget("trader", target1, true);
      await firewall.setAllowedTarget("trader", target1, false);
      expect(await firewall.isTargetAllowed("trader", target1)).to.equal(false);
    });

    it("sets multiple allowed targets in batch", async function () {
      await firewall.setAllowedTargets("trader", [target1, target2], true);
      expect(await firewall.isTargetAllowed("trader", target1)).to.equal(true);
      expect(await firewall.isTargetAllowed("trader", target2)).to.equal(true);
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        firewall.connect(other).setAllowedTarget("trader", target1, true),
      ).to.be.revertedWith("Not agent or contract owner");
    });

    it("reverts for non-existent agent", async function () {
      await expect(
        firewall.setAllowedTarget("ghost", target1, true),
      ).to.be.revertedWith("Agent not found");
    });
  });

  describe("submitAction", function () {
    const target = "0x1111111111111111111111111111111111111111";
    const data = "0x";
    const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );
    });

    it("queues an action and emits ActionSubmitted", async function () {
      const tx = await firewall.submitAction(
        "trader",
        target,
        ethers.parseEther("0.05"),
        data,
        instructionHash,
      );

      await expect(tx)
        .to.emit(firewall, "ActionSubmitted")
        .withArgs(0, "trader", target, ethers.parseEther("0.05"), instructionHash);

      const queued = await firewall.getQueuedAction(0);
      expect(queued.agentId).to.equal("trader");
      expect(queued.target).to.equal(target);
      expect(queued.instructionHash).to.equal(instructionHash);
      expect(queued.resolved).to.equal(false);
      expect(queued.decision).to.equal(0);
    });

    it("reverts when agent is frozen", async function () {
      await firewall.deactivateAgent("trader");

      await expect(
        firewall.submitAction("trader", target, 0, data, instructionHash),
      ).to.be.revertedWith("Agent is frozen");
    });

    it("reverts when agent has max strikes", async function () {
      await firewall.setMaxStrikes(0);

      await expect(
        firewall.submitAction("trader", target, 0, data, instructionHash),
      ).to.be.revertedWith("Max strikes exceeded");
    });

    it("reverts for non-existent agent", async function () {
      await expect(
        firewall.submitAction("ghost", target, 0, data, instructionHash),
      ).to.be.revertedWith("Agent not found");
    });

    it("increments queue ID for each action", async function () {
      const hash1 = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      const hash2 = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

      await firewall.submitAction("trader", target, 0, data, hash1);
      await firewall.submitAction("trader", target, 0, data, hash2);

      const first = await firewall.getQueuedAction(0);
      const second = await firewall.getQueuedAction(1);
      expect(first.instructionHash).to.equal(hash1);
      expect(second.instructionHash).to.equal(hash2);
    });
  });

  describe("onReport (CRE resolution)", function () {
    const target = "0x1111111111111111111111111111111111111111";
    const data = "0x";
    const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const metadata = "0x";

    function encodeReport(agentId: string, actionId: number, decision: number, rawThreatScore: number) {
      return ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint256", "uint8", "uint256"],
        [agentId, actionId, decision, rawThreatScore],
      );
    }

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.submitAction("trader", target, 0, data, instructionHash);
    });

    it("approves an action (decision = 1)", async function () {
      const report = encodeReport("trader", 0, 1, 0);
      const tx = await firewall.connect(forwarder).onReport(metadata, report);
      await expect(tx)
        .to.emit(firewall, "ActionApproved")
        .withArgs(0, "trader");

      const queued = await firewall.getQueuedAction(0);
      expect(queued.resolved).to.equal(true);
      expect(queued.decision).to.equal(1);
    });

    it("escalates an action (decision = 2)", async function () {
      const report = encodeReport("trader", 0, 2, 0);
      const tx = await firewall.connect(forwarder).onReport(metadata, report);
      await expect(tx)
        .to.emit(firewall, "ActionEscalated")
        .withArgs(0, "trader", 0);

      const queued = await firewall.getQueuedAction(0);
      expect(queued.resolved).to.equal(false);
      expect(queued.decision).to.equal(2);
    });

    it("blocks an action (decision = 3)", async function () {
      const report = encodeReport("trader", 0, 3, 0);
      const tx = await firewall.connect(forwarder).onReport(metadata, report);
      await expect(tx)
        .to.emit(firewall, "ActionBlocked")
        .withArgs(0, "trader", "Blocked by CRE oracle");

      const queued = await firewall.getQueuedAction(0);
      expect(queued.resolved).to.equal(true);
      expect(queued.decision).to.equal(3);
    });

    it("reverts on double resolve", async function () {
      const report = encodeReport("trader", 0, 1, 0);
      await firewall.connect(forwarder).onReport(metadata, report);
      await expect(
        firewall.connect(forwarder).onReport(metadata, report),
      ).to.be.revertedWith("Already resolved");
    });

    it("reverts for non-existent action", async function () {
      const report = encodeReport("trader", 999, 1, 0);
      await expect(
        firewall.connect(forwarder).onReport(metadata, report),
      ).to.be.revertedWith("Action not found");
    });

    it("reverts when called by non-forwarder", async function () {
      const report = encodeReport("trader", 0, 1, 0);
      await expect(
        firewall.connect(other).onReport(metadata, report),
      ).to.be.revertedWith("Only CRE forwarder");
    });
  });

  describe("approveAction (Ledger)", function () {
    const target = "0x1111111111111111111111111111111111111111";
    const data = "0x";
    const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.submitAction("trader", target, 0, data, instructionHash);
      // CRE escalates the action via onReport
      const escalateReport = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint256", "uint8", "uint256"],
        ["trader", 0, 2, 0],
      );
      await firewall.connect(forwarder).onReport("0x", escalateReport);
    });

    it("approves an escalated action", async function () {
      const tx = await firewall.approveAction(0);
      await expect(tx)
        .to.emit(firewall, "ActionApproved")
        .withArgs(0, "trader");

      const queued = await firewall.getQueuedAction(0);
      expect(queued.resolved).to.equal(true);
    });

    it("reverts if action is not escalated", async function () {
      await firewall.submitAction("trader", target, 0, data, instructionHash);
      await expect(
        firewall.approveAction(1),
      ).to.be.revertedWith("Action not escalated");
    });

    it("reverts on double resolve", async function () {
      await firewall.approveAction(0);
      await expect(
        firewall.approveAction(0),
      ).to.be.revertedWith("Already resolved");
    });

    it("reverts for non-existent action", async function () {
      await expect(
        firewall.approveAction(999),
      ).to.be.revertedWith("Action not found");
    });

    it("reverts when called by non-agent-owner", async function () {
      await expect(
        firewall.connect(other).approveAction(0),
      ).to.be.revertedWith("Not agent owner");
    });
  });

  describe("rejectAction (Ledger)", function () {
    const target = "0x1111111111111111111111111111111111111111";
    const data = "0x";
    const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.submitAction("trader", target, 0, data, instructionHash);
      const escalateReport = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint256", "uint8", "uint256"],
        ["trader", 0, 2, 0],
      );
      await firewall.connect(forwarder).onReport("0x", escalateReport);
    });

    it("rejects an escalated action", async function () {
      const tx = await firewall.rejectAction(0);
      await expect(tx)
        .to.emit(firewall, "ActionBlocked")
        .withArgs(0, "trader", "Rejected by agent owner");

      const queued = await firewall.getQueuedAction(0);
      expect(queued.resolved).to.equal(true);
    });

    it("reverts if action is not escalated", async function () {
      await firewall.submitAction("trader", target, 0, data, instructionHash);
      await expect(
        firewall.rejectAction(1),
      ).to.be.revertedWith("Action not escalated");
    });

    it("reverts on double resolve", async function () {
      await firewall.rejectAction(0);
      await expect(
        firewall.rejectAction(0),
      ).to.be.revertedWith("Already resolved");
    });

    it("reverts when called by non-agent-owner", async function () {
      await expect(
        firewall.connect(other).rejectAction(0),
      ).to.be.revertedWith("Not agent owner");
    });
  });

  describe("threat score via onReport", function () {
    const target = "0x1111111111111111111111111111111111111111";
    const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const metadata = "0x";

    function encodeReport(agentId: string, actionId: number, decision: number, rawThreatScore: number) {
      return ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint256", "uint8", "uint256"],
        [agentId, actionId, decision, rawThreatScore],
      );
    }

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.submitAction("trader", target, 0, "0x", instructionHash);
    });

    it("computes EMA correctly on first update", async function () {
      const report = encodeReport("trader", 0, 1, 50000);
      await firewall.connect(forwarder).onReport(metadata, report);
      const agent = await firewall.getAgent("trader");
      expect(agent.threatScore).to.equal(15000);
    });

    it("computes EMA correctly on sequential updates", async function () {
      const report1 = encodeReport("trader", 0, 1, 50000);
      await firewall.connect(forwarder).onReport(metadata, report1);
      // Submit another action for second report
      await firewall.submitAction("trader", target, 0, "0x", instructionHash);
      const report2 = encodeReport("trader", 1, 1, 50000);
      await firewall.connect(forwarder).onReport(metadata, report2);
      const agent = await firewall.getAgent("trader");
      expect(agent.threatScore).to.equal(25500);
    });

    it("increments strikes when raw score >= escalation threshold", async function () {
      const report = encodeReport("trader", 0, 1, 40000);
      await firewall.connect(forwarder).onReport(metadata, report);
      const agent = await firewall.getAgent("trader");
      expect(agent.strikes).to.equal(1);
    });

    it("does not increment strikes when raw score is below threshold", async function () {
      const report = encodeReport("trader", 0, 1, 39999);
      await firewall.connect(forwarder).onReport(metadata, report);
      const agent = await firewall.getAgent("trader");
      expect(agent.strikes).to.equal(0);
    });

    it("auto-freezes agent at max strikes", async function () {
      for (let i = 0; i < 5; i++) {
        await firewall.submitAction("trader", target, 0, "0x", instructionHash);
      }
      for (let i = 0; i < 5; i++) {
        const report = encodeReport("trader", i, 1, 40000);
        await firewall.connect(forwarder).onReport(metadata, report);
      }
      const agent = await firewall.getAgent("trader");
      expect(agent.active).to.equal(false);
      expect(agent.strikes).to.equal(5);
    });

    it("updates ENS records", async function () {
      const report = encodeReport("trader", 0, 1, 50000);
      await firewall.connect(forwarder).onReport(metadata, report);
      const agent = await firewall.getAgent("trader");
      expect(await ensResolver.text(agent.ensNode, "threat-score")).to.equal("15000");
      expect(await ensResolver.text(agent.ensNode, "threat-strikes")).to.equal("1");
    });

    it("emits ThreatScoreUpdated event", async function () {
      const report = encodeReport("trader", 0, 1, 50000);
      await expect(
        firewall.connect(forwarder).onReport(metadata, report),
      )
        .to.emit(firewall, "ThreatScoreUpdated")
        .withArgs("trader", 0, 15000, 50000, 1);
    });
  });

  describe("trust mesh", function () {
    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "checker",
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.registerAgentSimple(
        "target",
        other.address,
        ethers.parseEther("0.1"),
      );
    });

    it("returns true for a clean agent", async function () {
      expect(await firewall.isTrusted("target")).to.equal(true);
    });

    it("returns false for a deactivated agent", async function () {
      await firewall.deactivateAgent("target");
      expect(await firewall.isTrusted("target")).to.equal(false);
    });

    it("returns false for a deactivated agent via max strikes", async function () {
      // Use onReport to push threat scores that accumulate strikes
      const target = "0x1111111111111111111111111111111111111111";
      const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      for (let i = 0; i < 5; i++) {
        await firewall.submitAction("target", target, 0, "0x", instructionHash);
      }
      for (let i = 0; i < 5; i++) {
        const report = ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "uint256", "uint8", "uint256"],
          ["target", i, 1, 40000],
        );
        await firewall.connect(forwarder).onReport("0x", report);
      }
      expect(await firewall.isTrusted("target")).to.equal(false);
    });

    it("checkTrust emits TrustChecked event", async function () {
      await expect(firewall.checkTrust("checker", "target"))
        .to.emit(firewall, "TrustChecked")
        .withArgs("checker", "target", 0, 0, true);
    });

    it("checkTrust emits false for untrusted agent", async function () {
      await firewall.deactivateAgent("target");
      await expect(firewall.checkTrust("checker", "target"))
        .to.emit(firewall, "TrustChecked")
        .withArgs("checker", "target", 0, 0, false);
    });

    it("reverts for non-existent checker agent", async function () {
      await expect(
        firewall.checkTrust("ghost", "target"),
      ).to.be.revertedWith("Agent not found");
    });

    it("reverts for non-existent target agent", async function () {
      await expect(
        firewall.checkTrust("checker", "ghost"),
      ).to.be.revertedWith("Agent not found");
    });
  });

  describe("admin setters", function () {
    it("setBlockThreshold updates threshold", async function () {
      await firewall.setBlockThreshold(80000);
      expect(await firewall.blockThreshold()).to.equal(80000);
    });

    it("setBlockThreshold reverts for non-owner", async function () {
      await expect(
        firewall.connect(other).setBlockThreshold(80000),
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });

    it("setEscalateThreshold updates threshold", async function () {
      await firewall.setEscalateThreshold(50000);
      expect(await firewall.escalateThreshold()).to.equal(50000);
    });

    it("setEscalateThreshold reverts for non-owner", async function () {
      await expect(
        firewall.connect(other).setEscalateThreshold(50000),
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });

    it("setForwarder updates forwarder address", async function () {
      await firewall.setForwarder(other.address);
      expect(await firewall.forwarder()).to.equal(other.address);
    });

    it("setForwarder reverts for non-owner", async function () {
      await expect(
        firewall.connect(other).setForwarder(other.address),
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });

    it("setENSResolver updates resolver", async function () {
      await firewall.setENSResolver(other.address);
      expect(await firewall.ensResolver()).to.equal(other.address);
    });

    it("setENSResolver reverts for non-owner", async function () {
      await expect(
        firewall.connect(other).setENSResolver(other.address),
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });

    it("setMaxStrikes updates max strikes", async function () {
      await firewall.setMaxStrikes(10);
      expect(await firewall.maxStrikes()).to.equal(10);
    });

    it("setMaxStrikes reverts for non-owner", async function () {
      await expect(
        firewall.connect(other).setMaxStrikes(10),
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });
  });
});
