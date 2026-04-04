import hre from "hardhat";

export async function setupAgentFirewall() {
  const connection = await hre.network.connect();
  const ethers = (connection as any).ethers;

  const [owner, agent1, agent2, forwarder, other] = await ethers.getSigners();

  const MockENSResolver = await ethers.getContractFactory("MockENSResolver");
  const ensResolver = await MockENSResolver.deploy();
  await ensResolver.waitForDeployment();

  const AgentFirewall = await ethers.getContractFactory("AgentFirewall");
  const firewall = await AgentFirewall.deploy(
    await ensResolver.getAddress(),
    forwarder.address,
  );
  await firewall.waitForDeployment();

  return {
    ethers,
    owner,
    agent1,
    agent2,
    forwarder,
    other,
    firewall,
    ensResolver,
  };
}
