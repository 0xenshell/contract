import { expect } from "chai";
import { setupAgentFirewall } from "./utils.js";

describe("AgentFirewall", function () {
  let ethers: any;
  let owner: any;
  let agent1: any;
  let other: any;
  let firewall: any;
  let ensResolver: any;

  const ensNode = "0x1111111111111111111111111111111111111111111111111111111111111111";

  beforeEach(async function () {
    const env = await setupAgentFirewall();
    ethers = env.ethers;
    owner = env.owner;
    agent1 = env.agent1;
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

    beforeEach(async function () {
      await firewall.registerAgentSimple(
        "trader",
        ensNode,
        agent1.address,
        ethers.parseEther("0.1"),
      );
      await firewall.setAllowedTarget("trader", target, true);
    });

    it("auto-approves a clean action", async function () {
      const tx = await firewall.submitAction(
        "trader",
        target,
        ethers.parseEther("0.05"),
        data,
        "Send 0.05 ETH",
      );

      await expect(tx)
        .to.emit(firewall, "ActionApproved")
        .withArgs(0, "trader");
    });

    it("escalates when target is not allowed", async function () {
      const unknownTarget = "0x9999999999999999999999999999999999999999";
      const tx = await firewall.submitAction(
        "trader",
        unknownTarget,
        ethers.parseEther("0.01"),
        data,
        "Send to unknown",
      );

      await expect(tx)
        .to.emit(firewall, "ActionEscalated")
        .withArgs(0, "trader", 0);

      const queued = await firewall.getQueuedAction(0);
      expect(queued.target).to.equal(unknownTarget);
      expect(queued.resolved).to.equal(false);
    });

    it("escalates when value exceeds spend limit", async function () {
      const tx = await firewall.submitAction(
        "trader",
        target,
        ethers.parseEther("1.0"),
        data,
        "Big spend",
      );

      await expect(tx)
        .to.emit(firewall, "ActionEscalated")
        .withArgs(0, "trader", 0);
    });

    it("blocks when agent has max strikes", async function () {
      // Directly set strikes to maxStrikes (5) by manipulating via a future
      // threat score update feature. For now, we test by lowering maxStrikes.
      await firewall.setMaxStrikes(0);

      const tx = await firewall.submitAction(
        "trader",
        target,
        ethers.parseEther("0.01"),
        data,
        "Should be blocked",
      );

      await expect(tx)
        .to.emit(firewall, "ActionBlocked")
        .withArgs(0, "trader", "Max strikes exceeded");
    });

    it("reverts when agent is frozen", async function () {
      await firewall.deactivateAgent("trader");

      await expect(
        firewall.submitAction(
          "trader",
          target,
          ethers.parseEther("0.01"),
          data,
          "Frozen agent",
        ),
      ).to.be.revertedWith("Agent is frozen");
    });

    it("reverts for non-existent agent", async function () {
      await expect(
        firewall.submitAction(
          "ghost",
          target,
          ethers.parseEther("0.01"),
          data,
          "No agent",
        ),
      ).to.be.revertedWith("Agent not found");
    });

    it("increments queue ID for each queued action", async function () {
      const unknownTarget = "0x9999999999999999999999999999999999999999";

      await firewall.submitAction("trader", unknownTarget, 0, data, "first");
      await firewall.submitAction("trader", unknownTarget, 0, data, "second");

      const first = await firewall.getQueuedAction(0);
      const second = await firewall.getQueuedAction(1);
      expect(first.instruction).to.equal("first");
      expect(second.instruction).to.equal("second");
    });
  });
});
