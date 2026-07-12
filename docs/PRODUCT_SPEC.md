# Product specification

MuseLend serves three actors on Base: borrowers sell canonical Creator Tokens to create
an isolated USDC reserve and borrow separately; senior lenders supply ERC-4626 liquidity;
junior underwriters allocate fixed-epoch capital to capped synthetic upside.

V1 supports 7, 14 and 30-day terms, native USDC, non-transferable position receipts,
full redemption with bounded top-up, exact-input capped settlement and permissionless
default. It explicitly excludes arbitrary swap calls, uncapped synthetic promises,
transferable synthetics, mainnet activation and admin reserve sweeps.

Success requires users to see sale proceeds, principal, deductions, net proceeds, debt,
maturity, cap, junior coverage and settlement consequences before signing. English is
the default; Italian copy mirrors all financial and legal disclosures.
