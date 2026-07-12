-- Rebuildable cache only. On-chain contracts remain authoritative.
create table if not exists wallets (address bytea primary key, first_seen_at timestamptz not null default now());
create table if not exists token_metadata (chain_id integer not null, token bytea not null, name text, symbol text, decimals smallint, metadata jsonb not null default '{}', updated_at timestamptz not null, primary key(chain_id,token));
create table if not exists indexed_blocks (chain_id integer not null, block_number bigint not null, block_hash bytea not null, parent_hash bytea not null, primary key(chain_id,block_number));
create table if not exists indexed_events (chain_id integer not null, block_number bigint not null, block_hash bytea not null, transaction_hash bytea not null, log_index integer not null, contract bytea not null, topic0 bytea, payload jsonb not null, primary key(chain_id,transaction_hash,log_index));
create table if not exists positions_cache (chain_id integer not null, position_id numeric(78) not null, owner bytea not null, state text not null, derived jsonb not null, block_number bigint not null, primary key(chain_id,position_id));
create table if not exists senior_pool_snapshots (chain_id integer not null, block_number bigint not null, snapshot jsonb not null, primary key(chain_id,block_number));
create table if not exists hedge_epoch_snapshots (chain_id integer not null, epoch_id numeric(78) not null, block_number bigint not null, snapshot jsonb not null, primary key(chain_id,epoch_id,block_number));
create table if not exists quote_requests (id uuid primary key, wallet bytea, token bytea not null, kind text not null, inputs jsonb not null, result jsonb, created_at timestamptz not null default now());
create table if not exists risk_acknowledgements (chain_id integer not null, wallet bytea not null, version text not null, signature bytea not null, accepted_at timestamptz not null, primary key(chain_id,wallet,version));
create table if not exists legal_acceptances (chain_id integer not null, wallet bytea not null, version text not null, signature bytea not null, accepted_at timestamptz not null, primary key(chain_id,wallet,version));
create table if not exists notification_preferences (wallet bytea primary key, preferences jsonb not null default '{}', updated_at timestamptz not null);
create table if not exists indexer_cursor (chain_id integer primary key, block_number bigint not null, block_hash bytea not null, updated_at timestamptz not null default now());
create index if not exists indexed_events_block_idx on indexed_events(chain_id,block_number);
create index if not exists positions_owner_idx on positions_cache(chain_id,owner,state);
