# MuseLend web

Next.js App Router frontend for the MuseLend Base Sepolia product. Run from the
repository root with `pnpm --filter @muselend/web dev`. Production builds require no
database or Redis credentials; external clients initialize lazily when configured.

## Event indexer

`POST /api/indexer/sync` advances the Base Sepolia event cursor through finalized
blocks only. It requires `Authorization: Bearer <INDEXER_SYNC_SECRET>`, a secret of at
least 32 characters, `BASE_SEPOLIA_RPC_URL`, `DATABASE_URL`, `NEXT_PUBLIC_DEPLOYMENT_BLOCK`, and at
least one verified deployment address. The route fails closed if any of these are absent.

Invoke it from an authenticated scheduler no more than once per minute. Each run uses
five confirmations, bounded 2,000-block pages, idempotent event inserts, and a 25-second
work timeout. Stored block hashes are checked before advancing; a detected reorg deletes
events and derived snapshots from the fork point before replaying canonical logs. Never
expose the sync secret through a `NEXT_PUBLIC_` variable or a browser request.
