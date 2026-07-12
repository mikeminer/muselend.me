# Chain addresses and provenance

Verified on 2026-07-12 from official documentation. Deployment code must also check
`chainid`, non-empty bytecode and expected token decimals before use.

| Network | Chain ID | Native token | Native USDC |
| --- | ---: | --- | --- |
| Base | 8453 | ETH | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | ETH | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Sources: [Base network documentation](https://docs.base.org/base-chain/quickstart/connecting-to-base)
and [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).

No Zora Creator Coin V4 factory/validator or Uniswap V4 route is approved for Base
Sepolia in this repository. Until official versioned deployments, bytecode and route
constraints are recorded and tested, Sepolia uses `MockERC20` and `MockSwapAdapter`.
Mainnet swap execution remains absent and disabled; no address may be inferred from a
blog, social post or unrelated deployment list.
