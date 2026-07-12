# MuseLend decision log

## D-001 — canonical product identity

- **Status:** accepted
- **Decision:** `MuseLend` is the product name, `muselend` is the repository/deployment
  slug, and `https://muselend.me` is the canonical public origin.
- **Context:** The owner confirmed on 2026-07-12 that `muselend.me` has already been
  purchased.
- **Consequence:** Do not check out or purchase the domain. Connecting it to Vercel and
  changing DNS remain separate future operations requiring verified account context.

## D-002 — network rollout

- **Status:** accepted
- **Decision:** local chain and Base Sepolia first; Base Mainnet remains disabled behind
  `MAINNET_ENABLED=false` until launch gates pass.

## D-003 — protocol releases

- **Status:** accepted
- **Decision:** V1 core contracts are non-upgradeable. Future releases use explicit new
  deployments and migration rather than proxies.

## D-004 — authoritative state

- **Status:** accepted
- **Decision:** on-chain state is authoritative for balances, debt, position ownership,
  reserves, and vault shares. Postgres is a rebuildable cache and analytics store.

## D-005 — synthetic representation

- **Status:** accepted
- **Decision:** the synthetic right is a non-transferable position receipt, limited by
  term and coverage cap. It is not a fungible token and does not promise uncapped 1:1
  redemption.

## D-006 — liquidity integration

- **Status:** accepted
- **Decision:** swaps use typed, allowlisted adapters with constrained routes and
  recipients. The protocol never accepts arbitrary call targets or calldata.

## D-007 — current local limitation

- **Status:** active
- **Decision:** Foundry must be installed and pinned before contract builds can be
  reproduced; `forge` was not present during the initial inspection.
