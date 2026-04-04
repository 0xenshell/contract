# ENShell Contract

[![codecov](https://codecov.io/gh/0xenshell/contract/graph/badge.svg?token=1I0A2ULU69)](https://codecov.io/gh/0xenshell/contract)

Smart contract infrastructure for **ENShell**, an on-chain firewall for AI agents. The `AgentFirewall` contract stores agent registrations, enforces permission policies, queues risky actions for Ledger approval, tracks threat scores via Chainlink CRE, and emits events for the public threat feed.

## Setup

Requires Node.js >= 22.10.0.

```bash
npm install
```

## Build

```bash
npx hardhat compile
```

## Test

```bash
npx hardhat test
```

## Coverage

```bash
npx hardhat test --coverage
```

## Deploy

### 1. Configure keystore

```bash
npx hardhat keystore set ENSHELL_SEPOLIA_RPC
npx hardhat keystore set ENSHELL_DEPLOYER_PK
```

### 2. Register and wrap an ENS name

Register a parent name (e.g. `enshell.eth`) on https://sepolia.app.ens.domains. Agent subnames like `trader.enshell.eth` will be created under it.

After registration, wrap the name in the ENS NameWrapper. This is required so the ENS Public Resolver can authorize the firewall to write text records.

```bash
npx hardhat run scripts/wrap-ens.ts --network sepolia
```

### 3. Deploy the contract

Deploy parameters are stored in `ignition/parameters/sepolia.json`:
- `ensResolver` - Sepolia ENS Public Resolver
- `forwarder` - Chainlink KeystoneForwarder address (MockForwarder for simulation, KeystoneForwarder for production)

```bash
npx hardhat ignition deploy ignition/modules/AgentFirewall.ts --network sepolia \
  --parameters ignition/parameters/sepolia.json
```

### 4. Authorize the contract on ENS

The firewall writes threat scores to ENS text records. It needs operator approval on both the ENS Registry and NameWrapper to write under your ENS name.

```bash
FIREWALL_ADDRESS=0x... npx hardhat run scripts/approve-ens.ts --network sepolia
```

## License

MIT
