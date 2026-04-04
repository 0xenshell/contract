#!/bin/bash
set -e

echo "=== ENShell AgentFirewall Deployment ==="
echo ""

# Step 1: Clean previous deployment
echo "Step 1: Cleaning previous deployment state..."
rm -rf ignition/deployments/chain-11155111
echo "  Done."
echo ""

# Step 2: Deploy the contract
echo "Step 2: Deploying AgentFirewall to Sepolia..."
npx hardhat ignition deploy ignition/modules/AgentFirewall.ts --network sepolia --parameters ignition/parameters/sepolia.json
echo ""

# Step 3: Extract the deployed address
DEPLOYED_ADDRESS=$(cat ignition/deployments/chain-11155111/deployed_addresses.json 2>/dev/null | grep -o '"AgentFirewall#AgentFirewall": "[^"]*"' | cut -d'"' -f4)

if [ -z "$DEPLOYED_ADDRESS" ]; then
  echo "ERROR: Could not extract deployed address. Check the deployment output above."
  exit 1
fi

echo "Deployed at: $DEPLOYED_ADDRESS"
echo ""

# Step 4: Approve the contract on ENS
echo "Step 3: Running ENS approval script..."
FIREWALL_ADDRESS=$DEPLOYED_ADDRESS npx hardhat run scripts/approve-ens.ts --network sepolia
echo ""

echo "=== Deployment Complete ==="
echo ""
echo "Contract address: $DEPLOYED_ADDRESS"
echo ""
echo "Next steps:"
echo "  1. Update SDK network config with the new address"
echo "  2. Update CLI .env with the new address"
echo "  3. Test: node dist/index.js register --id test-agent --agent-wallet 0x... --spend-limit 0.1"
