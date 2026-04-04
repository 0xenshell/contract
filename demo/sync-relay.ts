/**
 * Re-sync all demo agents to the relay with owner field.
 * No on-chain transactions — just HTTP POSTs.
 * Usage: npx hardhat run demo/sync-relay.ts
 */
import { Wallet } from "ethers";
import { NETWORK_CONFIG, Network } from "@enshell/sdk";
import * as fs from "fs";
import * as path from "path";

const RELAY_URL = NETWORK_CONFIG[Network.SEPOLIA].relayUrl;

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
  const demoDir = path.dirname(new URL(import.meta.url).pathname);
  const envPath = path.join(demoDir, ".env.demo");

  if (!fs.existsSync(envPath)) {
    console.error("demo/.env.demo not found. Run generate-wallets.ts first.");
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf-8");
  const keys: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const match = line.match(/^ENSHELL_PRIVATE_KEY_(\w+)=(.+)$/);
    if (match) keys[match[1].toLowerCase()] = match[2];
  }

  console.log(`Syncing agents to relay (${RELAY_URL})...\n`);

  let synced = 0;
  for (const [walletName, suffixes] of Object.entries(AGENT_SUFFIXES)) {
    const pk = keys[walletName];
    if (!pk) { console.log(`  [skip] No key for ${walletName}`); continue; }

    const address = new Wallet(pk).address;

    for (const suffix of suffixes) {
      const agentId = `${walletName}-${suffix}`;
      try {
        const res = await fetch(`${RELAY_URL}/agents/${agentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ensName: `${agentId}.enshell.eth`,
            address,
            owner: address,
            spendLimit: "1.0",
            active: true,
          }),
        });
        const status = res.ok ? "ok" : `${res.status}`;
        synced++;
        process.stdout.write(`\r  Synced ${synced}/60 agents...`);
      } catch { /* continue */ }
    }
  }

  console.log(`\n\nDone! Synced ${synced} agents to relay with owner field.`);
}

main().catch(console.error);
