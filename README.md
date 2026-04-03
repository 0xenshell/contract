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

### 2. Register an ENS name

Register a parent name (e.g. `enshell.eth`) on https://sepolia.app.ens.domains. Agent subnames like `trader.enshell.eth` will be created under it.

### 3. Deploy the contract

Deploy parameters are stored in `ignition/parameters/sepolia.json`:
- `ensResolver` - Sepolia ENS Public Resolver
- `creOracle` - address authorized to update threat scores (use your deployer wallet until the CRE workflow is ready)

```bash
npx hardhat ignition deploy ignition/modules/AgentFirewall.ts --network sepolia \
  --parameters ignition/parameters/sepolia.json
```

### 4. Authorize the contract on ENS

The firewall writes threat scores to ENS text records. It needs operator approval on both the ENS Registry and NameWrapper to write under your ENS name.

Run the approval script with the deployed firewall address:

```bash
FIREWALL_ADDRESS=0x... npx hardhat run scripts/approve-ens.ts --network sepolia
```

This calls `setApprovalForAll` on:
- ENS Registry (`0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`)
- NameWrapper (`0x0635513f179D50A207757E05759CbD106d7dFcE8`)

## License

MIT
