import hre from "hardhat";

export async function setupAgentFirewall() {
  const connection = await hre.network.connect();
  const ethers = (connection as any).ethers;

  const [owner, agent1, agent2, other] = await ethers.getSigners();

  const MockENSResolver = await ethers.getContractFactory("MockENSResolver");
  const ensResolver = await MockENSResolver.deploy();
  await ensResolver.waitForDeployment();

  const AgentFirewall = await ethers.getContractFactory("AgentFirewall");
  const firewall = await AgentFirewall.deploy(await ensResolver.getAddress());
  await firewall.waitForDeployment();

  return {
    ethers,
    owner,
    agent1,
    agent2,
    other,
    firewall,
    ensResolver,
  };
}
