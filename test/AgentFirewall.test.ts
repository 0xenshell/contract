import { expect } from "chai";
import { setupAgentFirewall } from "./utils.js";

describe("AgentFirewall", function () {
  let ethers: any;
  let owner: any;
  let agent1: any;
  let oracle: any;
  let other: any;
  let firewall: any;
  let ensResolver: any;

  const ensNode = "0x1111111111111111111111111111111111111111111111111111111111111111";

  beforeEach(async function () {
    const env = await setupAgentFirewall();
    ethers = env.ethers;
    owner = env.owner;
    agent1 = env.agent1;
    oracle = env.oracle;
    other = env.other;
    firewall = env.firewall;
    ensResolver = env.ensResolver;
  });

  describe("registerAgentSimple", function () {
    it("registers an agent successfully", async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );

      const agent = await firewall.getAgent("trader");
      expect(agent.ensNode).to.equal(ensNode);
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
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );

      expect(await firewall.getAgentCount()).to.equal(1);
    });

    it("emits AgentRegistered event", async function () {
      await expect(
        firewall.registerAgentSimple(
          "trader",
          ensNode,
          agent1.address,
          ethers.parseEther("0.1"),
        ),
      )
        .to.emit(firewall, "AgentRegistered")
        .withArgs(
          "trader",
          ensNode,
          agent1.address,
          ethers.parseEther("0.1"),
          false,
        );
    });

    it("writes initial ENS records", async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );

      expect(await ensResolver.text(ensNode, "threat-score")).to.equal("0");
      expect(await ensResolver.text(ensNode, "threat-strikes")).to.equal("0");
    });

    it("reverts on duplicate agent", async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );

      await expect(
        firewall.registerAgentSimple(
          "trader",
          ensNode,
          agent1.address,
          ethers.parseEther("0.1"),
        ),
      ).to.be.revertedWith("Agent already registered");
    });

    it("reverts when called by non-owner", async function () {
      await expect(
        firewall
          .connect(other)
          .registerAgentSimple(
            "trader",
            ensNode,
            agent1.address,
            ethers.parseEther("0.1"),
          ),
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
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
        ensNode,
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
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });
  });

  describe("reactivateAgent", function () {
    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
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
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });
  });

  describe("allowedTargets", function () {
    const target1 = "0x1111111111111111111111111111111111111111";
    const target2 = "0x2222222222222222222222222222222222222222";

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
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
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
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
        ensNode,
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

  describe("resolveAction", function () {
    const target = "0x1111111111111111111111111111111111111111";
    const data = "0x";
    const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.submitAction("trader", target, 0, data, instructionHash);
    });

    it("approves an action (decision = 1)", async function () {
      const tx = await firewall.connect(oracle).resolveAction(0, 1);
      await expect(tx)
        .to.emit(firewall, "ActionApproved")
        .withArgs(0, "trader");

      const queued = await firewall.getQueuedAction(0);
      expect(queued.resolved).to.equal(true);
      expect(queued.decision).to.equal(1);
    });

    it("escalates an action (decision = 2)", async function () {
      const tx = await firewall.connect(oracle).resolveAction(0, 2);
      await expect(tx)
        .to.emit(firewall, "ActionEscalated")
        .withArgs(0, "trader", 0);

      const queued = await firewall.getQueuedAction(0);
      expect(queued.resolved).to.equal(false);
      expect(queued.decision).to.equal(2);
    });

    it("blocks an action (decision = 3)", async function () {
      const tx = await firewall.connect(oracle).resolveAction(0, 3);
      await expect(tx)
        .to.emit(firewall, "ActionBlocked")
        .withArgs(0, "trader", "Blocked by CRE oracle");

      const queued = await firewall.getQueuedAction(0);
      expect(queued.resolved).to.equal(true);
      expect(queued.decision).to.equal(3);
    });

    it("reverts on double resolve", async function () {
      await firewall.connect(oracle).resolveAction(0, 1);
      await expect(
        firewall.connect(oracle).resolveAction(0, 1),
      ).to.be.revertedWith("Already resolved");
    });

    it("reverts for invalid decision", async function () {
      await expect(
        firewall.connect(oracle).resolveAction(0, 0),
      ).to.be.revertedWith("Invalid decision");

      await expect(
        firewall.connect(oracle).resolveAction(0, 4),
      ).to.be.revertedWith("Invalid decision");
    });

    it("reverts for non-existent action", async function () {
      await expect(
        firewall.connect(oracle).resolveAction(999, 1),
      ).to.be.revertedWith("Action not found");
    });

    it("reverts when called by non-oracle", async function () {
      await expect(
        firewall.connect(other).resolveAction(0, 1),
      ).to.be.revertedWith("Only CRE oracle");
    });
  });

  describe("approveAction (Ledger)", function () {
    const target = "0x1111111111111111111111111111111111111111";
    const data = "0x";
    const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.submitAction("trader", target, 0, data, instructionHash);
      // CRE escalates the action
      await firewall.connect(oracle).resolveAction(0, 2);
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

    it("reverts when called by non-owner", async function () {
      await expect(
        firewall.connect(other).approveAction(0),
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });
  });

  describe("rejectAction (Ledger)", function () {
    const target = "0x1111111111111111111111111111111111111111";
    const data = "0x";
    const instructionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.submitAction("trader", target, 0, data, instructionHash);
      await firewall.connect(oracle).resolveAction(0, 2);
    });

    it("rejects an escalated action", async function () {
      const tx = await firewall.rejectAction(0);
      await expect(tx)
        .to.emit(firewall, "ActionBlocked")
        .withArgs(0, "trader", "Rejected by owner via Ledger");

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

    it("reverts when called by non-owner", async function () {
      await expect(
        firewall.connect(other).rejectAction(0),
      ).to.be.revertedWithCustomError(firewall, "OwnableUnauthorizedAccount");
    });
  });

  describe("updateThreatScore", function () {
    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );
    });

    it("computes EMA correctly on first update", async function () {
      // EMA: (300 * 50000 + 700 * 0) / 1000 = 15000
      await firewall.connect(oracle).updateThreatScore("trader", 50000);
      const agent = await firewall.getAgent("trader");
      expect(agent.threatScore).to.equal(15000);
    });

    it("computes EMA correctly on sequential updates", async function () {
      // First: (300 * 50000 + 700 * 0) / 1000 = 15000
      await firewall.connect(oracle).updateThreatScore("trader", 50000);
      // Second: (300 * 50000 + 700 * 15000) / 1000 = 15000 + 10500 = 25500
      await firewall.connect(oracle).updateThreatScore("trader", 50000);
      const agent = await firewall.getAgent("trader");
      expect(agent.threatScore).to.equal(25500);
    });

    it("increments strikes when raw score >= escalation threshold", async function () {
      await firewall.connect(oracle).updateThreatScore("trader", 40000);
      const agent = await firewall.getAgent("trader");
      expect(agent.strikes).to.equal(1);
    });

    it("does not increment strikes when raw score is below threshold", async function () {
      await firewall.connect(oracle).updateThreatScore("trader", 39999);
      const agent = await firewall.getAgent("trader");
      expect(agent.strikes).to.equal(0);
    });

    it("auto-freezes agent at max strikes", async function () {
      for (let i = 0; i < 5; i++) {
        await firewall.connect(oracle).updateThreatScore("trader", 40000);
      }
      const agent = await firewall.getAgent("trader");
      expect(agent.active).to.equal(false);
      expect(agent.strikes).to.equal(5);
    });

    it("updates ENS records", async function () {
      await firewall.connect(oracle).updateThreatScore("trader", 50000);
      // EMA = 15000, ENS stores raw value (no /EMA_SCALE in current impl)
      expect(await ensResolver.text(ensNode, "threat-score")).to.equal("15000");
      expect(await ensResolver.text(ensNode, "threat-strikes")).to.equal("1");
    });

    it("emits ThreatScoreUpdated event", async function () {
      await expect(
        firewall.connect(oracle).updateThreatScore("trader", 50000),
      )
        .to.emit(firewall, "ThreatScoreUpdated")
        .withArgs("trader", 0, 15000, 50000, 1);
    });

    it("reverts when called by non-oracle", async function () {
      await expect(
        firewall.connect(other).updateThreatScore("trader", 50000),
      ).to.be.revertedWith("Only CRE oracle");
    });

    it("reverts for non-existent agent", async function () {
      await expect(
        firewall.connect(oracle).updateThreatScore("ghost", 50000),
      ).to.be.revertedWith("Agent not found");
    });
  });
});
