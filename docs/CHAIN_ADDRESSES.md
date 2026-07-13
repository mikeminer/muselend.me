# Chain addresses and provenance

Verified on 2026-07-12 from official documentation. Deployment code must also check
`chainid`, non-empty bytecode and expected token decimals before use.

| Network      | Chain ID | Native token | Native USDC                                  |
| ------------ | -------: | ------------ | -------------------------------------------- |
| Base         |     8453 | ETH          | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia |    84532 | ETH          | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

| Network      | Uniswap Universal Router v2.1.1              | Permit2                                      |
| ------------ | -------------------------------------------- | -------------------------------------------- |
| Base         | `0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Base Sepolia | `0x8B844f885672f333Bc0042cB669255f93a4C1E6b` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

| Network      | Zora factory                                 | Zora V4 coin hook                            | Creator Coin implementation                   |
| ------------ | -------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| Base         | `0x777777751622c0d3258f214F9DF38E35BF45baF3` | `0x0469a4Bd3724DC86C9542F4694c976DA13C450c0` | `0x2c800c1CE59DC8DCeBf3FE3978E5FeEfC538f51F`  |
| Base Sepolia | `0xaF88840cb637F2684A9E460316b1678AD6245e4a` | `0xe0eC17Ab9f7ce52cC60DFB64E0A0A705d02Bd040` | Not published in the official deployment file |

Sources: [Base network documentation](https://docs.base.org/base-chain/quickstart/connecting-to-base)
and [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).
Uniswap router addresses and action encoding were verified against the official
[`universal-router` deployment files](https://github.com/Uniswap/universal-router/tree/cb222d358a2ea780feedee6990ff8a3c185301bf/deploy-addresses)
at commit `cb222d358a2ea780feedee6990ff8a3c185301bf`; Permit2 is the canonical deployment
documented by official Uniswap repositories.
Zora addresses were verified against the official
[`ourzora/zora-protocol` deployment files](https://github.com/ourzora/zora-protocol/tree/0b6229d7fac875084477de78aa5e41ba96cec96a/packages/coins-deployments/addresses)
at commit `0b6229d7fac875084477de78aa5e41ba96cec96a`. The Base Sepolia file publishes
Content Coin V3/V4 implementations but no Creator Coin implementation, so this repository
does not treat that network as canonical Creator Coin support.

The MuseLend testnet mirror factory at
`0x9e1Dbdebd28F104fF1D534055597dF03A92a4199` is therefore deliberately not listed as a
canonical Zora deployment. It creates disclosed Base Sepolia faucet tokens after an attested
Base balance read; these mirrors are not bridged assets. On Base Sepolia only, the validator
checks factory provenance dynamically and the risk manager applies bounded mirror defaults.
An explicit per-token governance setting always overrides those defaults, including disabling
a mirror. This path is rejected when `mainnetEnabled == true`.

No Zora Creator Coin V4 factory/validator or concrete V4 pool route is approved for Base
Sepolia in this repository. `UniswapV4SwapAdapter` is implemented and tested against the
official v2.1.1 action encoding, but remains undeployed and cannot trade until governance
allowlists a fully verified `PoolKey`. Base Sepolia uses Circle's canonical testnet USDC at
`0x036CbD53842c5426634e7929541eC2318f3dCF7e` with a funded `MockSwapAdapter`. Circle testnet
USDC has no economic value. Mainnet swap execution remains disabled; no pool address or hook may be
inferred from a blog, social post or unrelated deployment list.

## Pinned Base Mainnet fork fixture

The read-only integration test pins Base block `48,546,235` and Creator Coin
`0xf774d7Fb286265B4359773c557E9E5DD4910474d`. The address is decoded from the official
factory's `CreatorCoinCreated` event in transaction
[`0x2b0e…2b2a`](https://basescan.org/tx/0x2b0e2f6e9ae3af8b22d9efc4259b1886eecf721dd3187964aeb54576d0ce2b2a).
At that block the coin is an EIP-1167 proxy to the documented Creator Coin implementation,
reports `coinType() == 0` and version `2.6.0`, and returns the documented Zora Creator Coin
hook in its live Uniswap V4 pool key. `test/fork/BaseMainnetFork.t.sol` rechecks those facts,
canonical Base USDC decimals, factory hook state and MuseLend validator acceptance whenever
`BASE_MAINNET_RPC_URL` is available. The test never broadcasts a transaction.
It was executed successfully against `https://mainnet.base.org` on 2026-07-13; the ordinary
credential-free suite intentionally skips this one test and still compiles the fixture.
