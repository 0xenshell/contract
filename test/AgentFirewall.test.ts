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
});
