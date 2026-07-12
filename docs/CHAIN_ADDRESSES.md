# Chain addresses and provenance

Verified on 2026-07-12 from official documentation. Deployment code must also check
`chainid`, non-empty bytecode and expected token decimals before use.

| Network | Chain ID | Native token | Native USDC |
| --- | ---: | --- | --- |
| Base | 8453 | ETH | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | 84532 | ETH | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

| Network | Uniswap Universal Router v2.1.1 | Permit2 |
| --- | --- | --- |
| Base | `0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Base Sepolia | `0x8B844f885672f333Bc0042cB669255f93a4C1E6b` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

Sources: [Base network documentation](https://docs.base.org/base-chain/quickstart/connecting-to-base)
and [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
Uniswap router addresses and action encoding were verified against the official
[`universal-router` deployment files](https://github.com/Uniswap/universal-router/tree/cb222d358a2ea780feedee6990ff8a3c185301bf/deploy-addresses)
at commit `cb222d358a2ea780feedee6990ff8a3c185301bf`; Permit2 is the canonical deployment
documented by official Uniswap repositories.

No Zora Creator Coin V4 factory/validator or concrete V4 pool route is approved for Base
Sepolia in this repository. `UniswapV4SwapAdapter` is implemented and tested against the
official v2.1.1 action encoding, but remains undeployed and cannot trade until governance
allowlists a fully verified `PoolKey`. Sepolia therefore uses `MockERC20` and
`MockSwapAdapter`. Mainnet swap execution remains disabled; no pool address or hook may be
inferred from a blog, social post or unrelated deployment list.
