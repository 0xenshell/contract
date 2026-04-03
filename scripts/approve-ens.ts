/**
 * Authorize the AgentFirewall contract as an ENS operator.
 *
 * This grants the firewall permission to write text records (threat-score,
 * threat-strikes) on ENS names owned by the deployer wallet.
 *
 * Calls setApprovalForAll on both the ENS Registry and NameWrapper
 * to cover wrapped and unwrapped names.
 *
 * Usage:
 *   npx hardhat run scripts/approve-ens.ts --network sepolia
 *
 * Requires:
 *   FIREWALL_ADDRESS env var set to the deployed AgentFirewall address.
 */

import hre from "hardhat";

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8";

const ABI = ["function setApprovalForAll(address operator, bool approved)"];

async function main() {
  const firewallAddress = process.env.FIREWALL_ADDRESS;
  if (!firewallAddress) {
    console.error("Error: Set FIREWALL_ADDRESS env var to the deployed AgentFirewall address.");
    console.error("Example: FIREWALL_ADDRESS=0x... npx hardhat run scripts/approve-ens.ts --network sepolia");
    process.exit(1);
  }

  const connection = await hre.network.connect();
  const ethers = (connection as any).ethers;
  const [signer] = await ethers.getSigners();

  console.log(`Signer:           ${signer.address}`);
  console.log(`Firewall address:  ${firewallAddress}`);
  console.log();

  // Approve on ENS Registry
  console.log("Approving on ENS Registry...");
  const registry = new ethers.Contract(ENS_REGISTRY, ABI, signer);
  const tx1 = await registry.setApprovalForAll(firewallAddress, true);
  await tx1.wait();
  console.log(`  Done (tx: ${tx1.hash})`);

  // Approve on NameWrapper
  console.log("Approving on NameWrapper...");
  const wrapper = new ethers.Contract(NAME_WRAPPER, ABI, signer);
  const tx2 = await wrapper.setApprovalForAll(firewallAddress, true);
  await tx2.wait();
  console.log(`  Done (tx: ${tx2.hash})`);

  console.log();
  console.log("ENS operator approval complete. The firewall can now write text records.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
