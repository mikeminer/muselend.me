# Risk simulation

The executable model lives in `packages/risk-engine`. For `S = 1,000 USDC`,
`K = 1,500 USDC`, and `H = 500 USDC`:

| Token multiple | Cost | Junior spent | Junior PnL | Full without top-up | Capped quantity |
| ---: | ---: | ---: | ---: | --- | ---: |
| 0× | 0 | 0 | 1,000 | yes | 100% |
| 0.1× | 100 | 0 | 900 | yes | 100% |
| 0.5× | 500 | 0 | 500 | yes | 100% |
| 1× | 1,000 | 0 | 0 | yes | 100% |
| 1.3× | 1,300 | 300 | 0 | yes | 100% |
| 2× | 2,000 | 500 | 0 | no; 500 top-up | 75% |
| 5× | 5,000 | 500 | 0 | no; 3,500 top-up | 30% |
| 10× | 10,000 | 500 | 0 | no; 8,500 top-up | 15% |

Vitest executes all eight scenarios and bounds junior spending by `H`. Foundry proves a
1.2× full redemption, 3× capped partial settlement and permissionless default.
Disappearing liquidity or extreme slippage reverts and preserves the open position.
At 100% senior utilization immediate withdrawal is unavailable and shares enter the
queue. At 100% junior allocation new positions revert. These are model properties, not
an endorsement of testnet parameters for mainnet.
