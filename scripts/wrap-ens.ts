/**
 * Wrap enshell.eth in the ENS NameWrapper.
 *
 * This is required so the ENS Public Resolver can authorize the firewall
 * contract to write text records on subdomains like trader.enshell.eth.
 *
 * Steps:
 *   1. Approve the NameWrapper to transfer the BaseRegistrar NFT
 *   2. Call wrapETH2LD to wrap the name
 *
 * Usage:
 *   npx hardhat run scripts/wrap-ens.ts --network sepolia
 *
 * Only needs to be run once per ENS name.
 */

import hre from "hardhat";

// Sepolia addresses
const BASE_REGISTRAR = "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85";
const NAME_WRAPPER = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

const LABEL = "enshell";

const BASE_REGISTRAR_ABI = [
  "function approve(address to, uint256 tokenId)",
];

const NAME_WRAPPER_ABI = [
  "function wrapETH2LD(string label, address wrappedOwner, uint16 ownerControlledFuses, address resolver) returns (uint64 expiry)",
];

async function main() {
  const connection = await hre.network.connect();
  const ethers = (connection as any).ethers;
  const [signer] = await ethers.getSigners();

  console.log(`Signer: ${signer.address}`);
  console.log(`Wrapping: ${LABEL}.eth`);
  console.log();

  // Compute the BaseRegistrar token ID (keccak256 of the label)
  const tokenId = ethers.keccak256(ethers.toUtf8Bytes(LABEL));

  // Step 1: Approve NameWrapper to transfer the NFT
  console.log("Step 1: Approving NameWrapper on BaseRegistrar...");
  const registrar = new ethers.Contract(BASE_REGISTRAR, BASE_REGISTRAR_ABI, signer);
  const approveTx = await registrar.approve(NAME_WRAPPER, tokenId);
  await approveTx.wait();
  console.log(`  Done (tx: ${approveTx.hash})`);

  // Step 2: Wrap the name
  console.log("Step 2: Wrapping in NameWrapper...");
  const wrapper = new ethers.Contract(NAME_WRAPPER, NAME_WRAPPER_ABI, signer);
  const wrapTx = await wrapper.wrapETH2LD(
    LABEL,
    signer.address,
    0,                // ownerControlledFuses (no restrictions)
    PUBLIC_RESOLVER,  // resolver
  );
  await wrapTx.wait();
  console.log(`  Done (tx: ${wrapTx.hash})`);

  console.log();
  console.log(`${LABEL}.eth is now wrapped in the NameWrapper.`);
  console.log("The ENS Public Resolver will now accept setText calls from authorized operators.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
