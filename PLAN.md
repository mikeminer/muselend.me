# MuseLend delivery plan

This plan tracks the reversible implementation work. Mainnet deployment, real-fund
transactions, paid services, final governance ownership, and legal launch remain
explicit owner gates.

## Phase 0 — foundations

- [x] Confirm `muselend.me` is already owner-controlled; do not purchase it.
- [x] Establish brand assets and PWA icons.
- [x] Pin the monorepo toolchain and dependencies.
- [x] Add CI, secret scanning, dependency updates, and repository policy files.

## Phase 1 — protocol specification and models

- [x] Write the initial accounting specification.
- [x] Write architecture, threat model, admin powers, and chain-address provenance.
- [x] Implement the TypeScript risk/accounting model and differential vectors.
- [x] Produce stress simulations and document assumptions.

## Phase 2 — contracts

- [x] Install and pin Foundry 1.7.1 and Solidity 0.8.35.
- [x] Implement rate model, risk manager, senior vault, hedge epoch vault, receipt,
      position manager, typed adapters, validator, treasury, mocks, and withdrawal queue.
- [x] Add unit, fuzz, invariant, differential, local-chain E2E, and static-analysis suites.
- [x] Add a read-only Base Mainnet fork test pinned to an official-factory Creator Coin,
      canonical USDC, implementation and hook; run it when `BASE_MAINNET_RPC_URL` is available.
- [x] Export deterministic ABIs and deployment configuration.

## Phase 3 — product

- [x] Build the Next.js App Router web application and bilingual content system.
- [x] Implement public, borrower, lender, underwriter, markets, position, docs, risk,
      legal, and status surfaces.
- [x] Connect the admin console to deployed role checks and pre-write simulations; it remains
      fail-closed until verified deployment addresses are supplied.
- [x] Add wallet connectivity, transaction lifecycle, direct-chain fallback, APIs,
      reorg-aware finalized-block indexing, rate limiting, and security headers.
- [x] Wire typed Base Sepolia test-adapter quotes to simulated full and capped position
      settlement, including explicit slippage and borrower-controlled top-up limits.
- [x] Wire the borrower UI through canonical-token validation, protected sell quote, token
      approval, on-chain risk accounting, fresh simulation and atomic position opening.
- [x] Require pre-wallet simulation for senior and junior writes; expose permissionless FIFO
      withdrawal claims and settled-epoch closure without adding any unbounded on-chain loop.
- [x] Expose verified roles, risk config and adapter status in admin; simulate typed governance
      targets as the timelock before proposer-only scheduling with the enforced minimum delay.
- [x] Complete the non-authoritative persistence schema and migrations; cache sanitized token
      metadata and quote outcomes without making chain responses depend on database availability.
- [x] Implement atomic distributed rate limiting with a lazy Upstash client and production
      fail-closed behavior.
- [ ] Connect production persistence and observability after the owner provisions the
      required Vercel/Neon/Upstash resources.
- [x] Add unit, accessibility, browser, and local-chain E2E coverage.

## Phase 4 — delivery

- [x] Pass clean install, lint, typecheck, builds, 38 Foundry tests plus the optional live fork
      integration, invariants,
      Slither with no high/medium findings, Axe browser checks, and Anvil lifecycle E2E in CI.
- [ ] Deploy and verify contracts on Base Sepolia only after a funded testnet signer is
      available and the owner approves signing transactions.
- [x] Simulate the complete guarded deployment against the public Base Sepolia RPC without
      broadcasting; verify canonical USDC, governance handoff and post-deployment invariants.
- [ ] Configure Vercel testnet mode, preview, production, and then connect the already
      owned domain after verifying the intended Vercel scope and DNS authority.
- [ ] Keep `MAINNET_ENABLED=false` until every documented launch gate is independently met.

## Explicit stop gates

- Any paid service or purchase.
- Any transaction involving funds with real value.
- Base Mainnet deployment or activation.
- Final Safe/timelock/admin ownership decisions.
- Registrar or DNS mutations not already authorized.
- Legal or regulatory launch conclusions.
