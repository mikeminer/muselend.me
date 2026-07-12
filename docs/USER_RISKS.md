# User risks

Creator tokens are sold at opening. Sale USDC remains locked as position reserve; the
loan is separate senior-vault USDC. Synthetic exposure is capped and time-limited. Above
the cap, full recovery may require top-up, while capped settlement can return fewer
tokens. Default cancels the synthetic right. Liquidity, slippage, fees, smart contracts,
USDC, Base, Zora, swap venues and administration can all fail. Senior withdrawals depend
on cash. Junior capital can incur a total loss within an epoch.
