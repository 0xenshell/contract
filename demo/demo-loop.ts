/**
 * ENShell Demo Loop
 *
 * Continuously simulates agent interactions: protect actions, trust checks.
 * Actions are submitted on-chain, then analyzed by the CRE oracle.
 *
 * Usage:
 *   npx hardhat run demo/demo-loop.ts --network sepolia
 *   npx hardhat run demo/demo-loop.ts --network sepolia -- --min 60 --max 120
 *
 * Env: MIN_DELAY_S and MAX_DELAY_S (seconds between actions, default 300-900)
 */
import hre from "hardhat";
import { Wallet, JsonRpcProvider, keccak256, toUtf8Bytes } from "ethers";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { encryptForOracle, NETWORK_CONFIG, Network } from "@enshell/sdk";
import {
  SAFE_PROMPTS, SUSPICIOUS_PROMPTS, MALICIOUS_PROMPTS,
  pickRandom,
} from "./prompts.js";
import type { DemoPrompt } from "./prompts.js";

const CRE_SIMULATE = path.resolve(process.env.HOME || "~", "www/enshell-cre-workflow/simulate.sh");
const RELAY_URL = NETWORK_CONFIG[Network.SEPOLIA].relayUrl;
const ORACLE_PUBLIC_KEY = NETWORK_CONFIG[Network.SEPOLIA].oraclePublicKey;

// Configurable delays via env
const MIN_DELAY = parseInt(process.env.MIN_DELAY_S || "300", 10) * 1000;
const MAX_DELAY = parseInt(process.env.MAX_DELAY_S || "900", 10) * 1000;

function randomDelay(): number {
  return MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
}

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(11, 19);
}

const COLORS = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(color: string, msg: string) {
  console.log(`${COLORS.gray}[${timestamp()}]${COLORS.reset} ${color}${msg}${COLORS.reset}`);
}

async function main() {
  const connection = await hre.network.connect();
  const ethers = (connection as any).ethers;

  const demoDir = path.dirname(new URL(import.meta.url).pathname);
  const envPath = path.join(demoDir, ".env.demo");

  if (!fs.existsSync(envPath)) {
    console.error("demo/.env.demo not found. Run generate-wallets.ts first.");
    process.exit(1);
  }

  // Parse wallets
  const envContent = fs.readFileSync(envPath, "utf-8");
  const keys: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const match = line.match(/^ENSHELL_PRIVATE_KEY_(\w+)=(.+)$/);
    if (match) keys[match[1].toLowerCase()] = match[2];
  }

  const rpcUrl = envContent.match(/ENSHELL_RPC_URL=(.+)/)?.[1] || "https://ethereum-sepolia-rpc.publicnode.com";
  const provider = new JsonRpcProvider(rpcUrl);

  const contractAddress = NETWORK_CONFIG[Network.SEPOLIA].firewallAddress;
  const firewall = await ethers.getContractAt("AgentFirewall", contractAddress);

  // Build agent list from contract
  const agentCount = await firewall.getAgentCount();
  const agents: { id: string; walletName: string; signer: Wallet }[] = [];

  for (let i = 0n; i < agentCount; i++) {
    const agentId = await firewall.agentIds(i);
    const parts = agentId.split("-");
    const walletName = parts[0];
    const pk = keys[walletName];
    if (pk) {
      agents.push({ id: agentId, walletName, signer: new Wallet(pk, provider) });
    }
  }

  if (agents.length === 0) {
    console.error("No agents found. Run register-agents.ts first.");
    process.exit(1);
  }

  console.log(`\n${COLORS.bold}ENShell Demo Loop${COLORS.reset}`);
  console.log(`${COLORS.gray}Agents: ${agents.length} | Delay: ${MIN_DELAY / 1000}s-${MAX_DELAY / 1000}s | Ctrl+C to stop${COLORS.reset}\n`);

  let actionCount = 0;

  // Main loop
  while (true) {
    try {
      const roll = Math.random();

      if (roll < 0.15) {
        // 15% — Trust check
        const checker = pickRandom(agents);
        const target = pickRandom(agents.filter((a) => a.id !== checker.id));
        if (!target) continue;

        log(COLORS.cyan, `${checker.id} → trust check → ${target.id}`);

        const userFirewall = firewall.connect(checker.signer);
        const tx = await userFirewall.checkTrust(checker.id, target.id);
        const receipt = await tx.wait();

        // Parse TrustChecked event
        const iface = firewall.interface;
        let trusted = false;
        for (const logEntry of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: logEntry.topics, data: logEntry.data });
            if (parsed?.name === "TrustChecked") trusted = parsed.args[4];
          } catch { /* skip */ }
        }

        const color = trusted ? COLORS.green : COLORS.red;
        log(color, `  → ${trusted ? "TRUSTED" : "NOT TRUSTED"} (tx: ${tx.hash.slice(0, 14)}...)`);

      } else {
        // 85% — Protect action
        const agent = pickRandom(agents);
        let chosen: DemoPrompt;
        let category: string;

        const promptRoll = Math.random();
        if (promptRoll < 0.55) {
          chosen = pickRandom(SAFE_PROMPTS);
          category = "safe";
        } else if (promptRoll < 0.85) {
          chosen = pickRandom(SUSPICIOUS_PROMPTS);
          category = "suspicious";
        } else {
          chosen = pickRandom(MALICIOUS_PROMPTS);
          category = "malicious";
        }

        log(COLORS.gray, `${agent.id} → protect [${category}] "${chosen.instruction.slice(0, 50)}..."`);

        // Submit action on-chain
        const userFirewall = firewall.connect(agent.signer);
        const instructionHash = keccak256(toUtf8Bytes(chosen.instruction));

        const tx = await userFirewall.submitAction(
          agent.id,
          chosen.target,
          ethers.parseEther(chosen.value),
          "0x",
          instructionHash,
        );
        const receipt = await tx.wait();

        // Parse ActionSubmitted event for actionId
        let actionId = 0n;
        const iface = firewall.interface;
        for (const logEntry of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: logEntry.topics, data: logEntry.data });
            if (parsed?.name === "ActionSubmitted") actionId = parsed.args[0];
          } catch { /* skip */ }
        }

        log(COLORS.gray, `  → Action #${actionId} submitted (tx: ${tx.hash})`);

        // Encrypt instruction and store on relay for CRE to fetch
        try {
          const encrypted = encryptForOracle(chosen.instruction, ORACLE_PUBLIC_KEY);
          await fetch(`${RELAY_URL}/relay/${instructionHash}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ encryptedPayload: encrypted }),
          });
        } catch { /* relay optional */ }

        // Trigger CRE simulation
        try {
          log(COLORS.gray, `  → Running CRE simulation...`);
          const output = execSync(`${CRE_SIMULATE} ${tx.hash} 2>&1`, {
            timeout: 120000,
            cwd: path.resolve(process.env.HOME || "~", "www/enshell-cre-workflow"),
          }).toString();

          // Parse result
          if (output.includes("decision=1")) {
            log(COLORS.green, `  → APPROVED (Action #${actionId})`);
          } else if (output.includes("decision=2")) {
            log(COLORS.yellow, `  → ESCALATED (Action #${actionId})`);

            // Auto-approve safe, auto-reject bad
            if (category === "safe") {
              const approveTx = await userFirewall.approveAction(actionId);
              await approveTx.wait();
              log(COLORS.green, `  → Auto-approved`);
            } else {
              const rejectTx = await userFirewall.rejectAction(actionId);
              await rejectTx.wait();
              log(COLORS.red, `  → Auto-rejected`);
            }
          } else if (output.includes("decision=3")) {
            log(COLORS.red, `  → BLOCKED (Action #${actionId})`);
          } else {
            log(COLORS.yellow, `  → Unknown CRE result: ${output.slice(-200)}`);
          }
        } catch (err: any) {
          const stderr = err.stderr?.toString()?.trim() || "";
          const stdout = err.stdout?.toString()?.trim() || "";
          const fullOutput = stdout + "\n" + stderr;
          // Show last 500 chars which usually contains the actual error
          const tail = fullOutput.slice(-500).trim();
          log(COLORS.red, `  → CRE simulation failed:`);
          console.log(COLORS.gray + tail + COLORS.reset);
        }

        actionCount++;
      }
    } catch (err: any) {
      log(COLORS.red, `Error: ${err.message?.slice(0, 80)}`);
    }

    // Random delay before next action
    const delay = randomDelay();
    log(COLORS.gray, `Next action in ${(delay / 1000).toFixed(0)}s...`);
    await new Promise((r) => setTimeout(r, delay));
  }
}

main().catch(console.error);
