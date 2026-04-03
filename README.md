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

The contract takes two constructor parameters:
- `ensResolver` - Sepolia ENS Public Resolver: `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5`
- `creOracle` - address authorized to update threat scores (use your deployer wallet until the CRE workflow is ready)

```bash
npx hardhat ignition deploy ignition/modules/AgentFirewall.ts --network sepolia \
  --parameters '{"AgentFirewall": {"ensResolver": "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5", "creOracle": "0x8970bc47d1dBE7A7A43eC35b9EcAbEA88667bf7e"}}'
```

### 4. Authorize the contract on ENS

The firewall writes threat scores to ENS text records. It needs operator approval on the ENS Registry to write under your ENS name.

Call `setApprovalForAll(firewallContractAddress, true)` on the ENS Registry (`0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`) from your deployer wallet.

## License

MIT
