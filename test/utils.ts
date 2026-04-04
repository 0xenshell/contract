import hre from "hardhat";

export async function setupAgentFirewall() {
  const connection = await hre.network.connect();
  const ethers = (connection as any).ethers;

  const [owner, agent1, agent2, forwarder, other] = await ethers.getSigners();

  const MockENSResolver = await ethers.getContractFactory("MockENSResolver");
  const ensResolver = await MockENSResolver.deploy();
  await ensResolver.waitForDeployment();

  const MockNameWrapper = await ethers.getContractFactory("MockNameWrapper");
  const nameWrapper = await MockNameWrapper.deploy();
  await nameWrapper.waitForDeployment();

  // Use a deterministic parent node for tests
  const ensParentNode = ethers.namehash("enshell.eth");

  const AgentFirewall = await ethers.getContractFactory("AgentFirewall");
  const firewall = await AgentFirewall.deploy(
    await ensResolver.getAddress(),
    await nameWrapper.getAddress(),
    ensParentNode,
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
    nameWrapper,
    ensParentNode,
  };
}
