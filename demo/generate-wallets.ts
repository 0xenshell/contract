import hre from "hardhat";
import { Wallet, formatEther } from "ethers";
import * as fs from "fs";
import * as path from "path";

const WALLET_NAMES = [
  "alice", "bob", "carol", "dave", "eve",
  "frank", "grace", "heidi", "ivan", "judy",
  "karl", "lana", "mike", "nina", "oscar",
];

const FUNDING_AMOUNT = "0.2"; // ETH per wallet

async function main() {
  const connection = await hre.network.connect();
  const ethers = (connection as any).ethers;
  const [deployer] = await ethers.getSigners();

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${formatEther(balance)} ETH\n`);

  const totalNeeded = parseFloat(FUNDING_AMOUNT) * WALLET_NAMES.length;
  if (parseFloat(formatEther(balance)) < totalNeeded) {
    console.error(`Need ${totalNeeded} ETH but only have ${formatEther(balance)}`);
    process.exit(1);
  }

  const wallets: { name: string; address: string; privateKey: string }[] = [];
  const envLines: string[] = [
    `# ENShell Demo Wallets — Generated ${new Date().toISOString()}`,
    `# DO NOT COMMIT THIS FILE`,
    ``,
    `ENSHELL_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`,
    ``,
  ];

  // Generate wallets
  console.log("Generating 15 wallets...\n");
  for (const name of WALLET_NAMES) {
    const w = Wallet.createRandom();
    wallets.push({ name, address: w.address, privateKey: w.privateKey });
    envLines.push(`ENSHELL_PRIVATE_KEY_${name.toUpperCase()}=${w.privateKey}`);
  }

  // Write .env.demo
  const demoDir = path.dirname(new URL(import.meta.url).pathname);
  fs.writeFileSync(path.join(demoDir, ".env.demo"), envLines.join("\n") + "\n");
  console.log("Written: demo/.env.demo\n");

  // Write wallets.json
  fs.writeFileSync(
    path.join(demoDir, "wallets.json"),
    JSON.stringify(
      wallets.map((w) => ({ name: w.name, address: w.address })),
      null,
      2,
    ),
  );
  console.log("Written: demo/wallets.json\n");

  // Fund each wallet
  console.log(`Funding each wallet with ${FUNDING_AMOUNT} ETH...\n`);
  console.log("  Name       Address                                     Tx");
  console.log("  " + "-".repeat(75));

  for (const w of wallets) {
    const tx = await deployer.sendTransaction({
      to: w.address,
      value: ethers.parseEther(FUNDING_AMOUNT),
    });
    await tx.wait();
    console.log(`  ${w.name.padEnd(10)} ${w.address}  ${tx.hash.slice(0, 18)}...`);
  }

  console.log(`\nDone! Funded ${wallets.length} wallets with ${FUNDING_AMOUNT} ETH each.`);
  console.log(`Total spent: ${totalNeeded} ETH`);
  console.log(`\nTo use: cp demo/.env.demo .env`);
  console.log(`Then:   enshell --wallet env --key alice register --id alice-trader ...`);
}

main().catch(console.error);
