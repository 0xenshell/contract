/**
 * Authorize the AgentFirewall contract as an ENS operator.
 *
 * This grants the firewall permission to write text records (threat-score,
 * threat-strikes) on ENS names owned by the deployer wallet.
 *
 * Calls setApprovalForAll on:
 *   1. ENS Registry - for unwrapped name management
 *   2. NameWrapper - for wrapped name management
 *   3. Public Resolver - for writing text records (the resolver has its own approval mapping)
 *
 * Usage:
 *   FIREWALL_ADDRESS=0x... npx hardhat run scripts/approve-ens.ts --network sepolia
 */

import hre from "hardhat";

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

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
  console.log("1/3 Approving on ENS Registry...");
  const registry = new ethers.Contract(ENS_REGISTRY, ABI, signer);
  const tx1 = await registry.setApprovalForAll(firewallAddress, true);
  await tx1.wait();
  console.log(`    Done (tx: ${tx1.hash})`);

  // Approve on NameWrapper
  console.log("2/3 Approving on NameWrapper...");
  const wrapper = new ethers.Contract(NAME_WRAPPER, ABI, signer);
  const tx2 = await wrapper.setApprovalForAll(firewallAddress, true);
  await tx2.wait();
  console.log(`    Done (tx: ${tx2.hash})`);

  // Approve on Public Resolver
  console.log("3/3 Approving on Public Resolver...");
  const resolver = new ethers.Contract(PUBLIC_RESOLVER, ABI, signer);
  const tx3 = await resolver.setApprovalForAll(firewallAddress, true);
  await tx3.wait();
  console.log(`    Done (tx: ${tx3.hash})`);

  console.log();
  console.log("ENS operator approval complete. The firewall can now write text records.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
