import hre from "hardhat";
import { Wallet, JsonRpcProvider } from "ethers";
import * as fs from "fs";
import * as path from "path";

const AGENT_SUFFIXES: Record<string, string[]> = {
  alice: ["trader", "scanner", "keeper", "vault"],
  bob: ["bridge", "oracle", "sentinel", "relay"],
  carol: ["indexer", "monitor", "sweeper", "guard"],
  dave: ["solver", "router", "watcher", "beacon"],
  eve: ["minter", "burner", "staker", "claimer"],
  frank: ["lender", "swapper", "yielder", "hedger"],
  grace: ["nft", "dao", "voter", "proposer"],
  heidi: ["data", "feed", "price", "signal"],
  ivan: ["bot", "arb", "sniper", "market"],
  judy: ["safe", "multi", "timelock", "proxy"],
  karl: ["pool", "farm", "stake", "reward"],
  lana: ["cross", "wrap", "unwrap", "settle"],
  mike: ["verify", "audit", "scan", "alert"],
  nina: ["govern", "exec", "veto", "delegate"],
  oscar: ["test", "debug", "bench", "stress"],
};

async function main() {
  const connection = await hre.network.connect();
  const ethers = (connection as any).ethers;

  const demoDir = path.dirname(new URL(import.meta.url).pathname);
  const envPath = path.join(demoDir, ".env.demo");

  if (!fs.existsSync(envPath)) {
    console.error("demo/.env.demo not found. Run generate-wallets.ts first.");
    process.exit(1);
  }

  // Parse .env.demo
  const envContent = fs.readFileSync(envPath, "utf-8");
  const keys: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const match = line.match(/^ENSHELL_PRIVATE_KEY_(\w+)=(.+)$/);
    if (match) keys[match[1].toLowerCase()] = match[2];
  }

  const rpcUrl = envContent.match(/ENSHELL_RPC_URL=(.+)/)?.[1] || "https://ethereum-sepolia-rpc.publicnode.com";
  const provider = new JsonRpcProvider(rpcUrl);

  // Get the firewall contract
  const contractAddress = "0x3886791bd82ff55294FaaEcCe3624A2376978dB2";
  const firewall = await ethers.getContractAt("AgentFirewall", contractAddress);

  console.log(`Registering agents on ${contractAddress}...\n`);
  console.log("  Agent ID                   Owner          Tx");
  console.log("  " + "-".repeat(65));

  let registered = 0;
  for (const [walletName, suffixes] of Object.entries(AGENT_SUFFIXES)) {
    const pk = keys[walletName];
    if (!pk) {
      console.log(`  [skip] No key found for ${walletName}`);
      continue;
    }

    const signer = new Wallet(pk, provider);
    const userFirewall = firewall.connect(signer);

    for (const suffix of suffixes) {
      const agentId = `${walletName}-${suffix}`;
      try {
        const tx = await userFirewall.registerAgentSimple(
          agentId,
          signer.address,
          ethers.parseEther("1.0"),
        );
        await tx.wait();
        registered++;
        console.log(`  ${agentId.padEnd(25)} ${signer.address.slice(0, 10)}...  ${tx.hash.slice(0, 18)}...`);
      } catch (err: any) {
        if (err.message?.includes("already registered")) {
          console.log(`  ${agentId.padEnd(25)} [already registered]`);
        } else {
          console.log(`  ${agentId.padEnd(25)} [ERROR] ${err.message?.slice(0, 60)}`);
        }
      }
    }
  }

  console.log(`\nDone! Registered ${registered} agents.`);
}

main().catch(console.error);
