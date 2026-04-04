# ENShell Demo Setup

Simulates a live ENShell ecosystem with 15 users, 60 agents, and continuous activity.

## Prerequisites

- Deployer wallet funded with ~5 Sepolia ETH
- CRE workflow configured at `~/www/enshell-cre-workflow`
- `cre` CLI installed and configured

## Step 1: Generate & Fund Wallets

Creates 15 demo wallets and funds each with 0.2 ETH (3 ETH total).

```bash
npx hardhat run demo/generate-wallets.ts --network sepolia
```

Outputs:
- `demo/.env.demo` — private keys for all wallets
- `demo/wallets.json` — address/name mapping

## Step 2: Register Agents

Registers 4 agents per wallet (60 total).

```bash
npx hardhat run demo/register-agents.ts --network sepolia
```

## Step 3: Run the Demo Loop

Continuously generates random agent interactions (protect actions + trust checks).

```bash
# Default: 300-900 second intervals
npx hardhat run demo/demo-loop.ts --network sepolia

# Faster for testing: 10-30 second intervals
MIN_DELAY_S=10 MAX_DELAY_S=30 npx hardhat run demo/demo-loop.ts --network sepolia

# Custom range
MIN_DELAY_S=60 MAX_DELAY_S=120 npx hardhat run demo/demo-loop.ts --network sepolia
```

The loop runs until Ctrl+C. Each iteration:
- **70%**: Safe action (DeFi operations, governance, staking)
- **20%**: Suspicious action (unknown targets, social engineering)
- **10%**: Malicious action (prompt injection, burn addresses)
- **15%**: Trust check between random agents

After each protect action, the CRE simulation runs automatically via `~/www/enshell-cre-workflow/simulate.sh`.

## Using Named Keys with the CLI

The demo wallets work with the `--key` flag:

```bash
# Copy demo env
cp demo/.env.demo .env

# Use a specific wallet
enshell --wallet env --key alice register --id alice-custom --agent-wallet 0x... --spend-limit 1.0
enshell --wallet env --key bob trust --id bob-oracle --check alice-trader
```

## Architecture

```
demo-loop.ts → picks random agent → submits protect/trust action on-chain
             → triggers CRE simulation (~/www/enshell-cre-workflow/simulate.sh)
             → CRE decrypts + Claude analyzes + writes onReport
             → auto-approves safe escalations, auto-rejects bad ones
             → trust mesh + feed + registry update in real-time on enshell.xyz
```
