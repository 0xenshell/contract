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

## License

MIT
