# MuseLend delivery plan

This plan tracks the reversible implementation work. Mainnet deployment, real-fund
transactions, paid services, final governance ownership, and legal launch remain
explicit owner gates.

## Phase 0 — foundations

- [x] Confirm `muselend.me` is already owner-controlled; do not purchase it.
- [x] Establish brand assets and PWA icons.
- [ ] Pin the monorepo toolchain and dependencies.
- [ ] Add CI, secret scanning, dependency updates, and repository policy files.

## Phase 1 — protocol specification and models

- [x] Write the initial accounting specification.
- [ ] Write architecture, threat model, admin powers, and chain-address provenance.
- [ ] Implement the TypeScript risk/accounting model and differential vectors.
- [ ] Produce stress simulations and document assumptions.

## Phase 2 — contracts

- [ ] Install a pinned Foundry toolchain (not currently present on this machine).
- [ ] Implement rate model, risk manager, senior vault, hedge epoch vault, receipt,
  position manager, typed adapters, validator, treasury, mocks, and withdrawal queue.
- [ ] Add unit, fuzz, invariant, differential, fork, and static-analysis suites.
- [ ] Export deterministic ABIs and deployment configuration.

## Phase 3 — product

- [ ] Build the Next.js App Router web application and bilingual content system.
- [ ] Implement public, borrower, lender, underwriter, markets, position, docs, risk,
  legal, status, and gated admin surfaces.
- [ ] Add wallet connectivity, transaction simulation/lifecycle, direct-chain fallback,
  APIs, indexer, schema, rate limiting, security headers, and observability.
- [ ] Add unit, component, accessibility, browser, and local-chain E2E coverage.

## Phase 4 — delivery

- [ ] Pass clean install, lint, typecheck, builds, tests, invariants, Slither, and E2E.
- [ ] Deploy and verify contracts on Base Sepolia only after a funded testnet signer is
  available and the owner approves signing transactions.
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
