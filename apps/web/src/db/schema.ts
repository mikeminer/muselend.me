import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const wallets = pgTable("wallets", {
  address: text("address").primaryKey(),
  firstSeenAt: createdAt,
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tokenMetadata = pgTable(
  "token_metadata",
  {
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    name: text("name"),
    symbol: text("symbol"),
    decimals: integer("decimals"),
    canonicalVersion: integer("canonical_version"),
    metadata: jsonb("metadata").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.chainId, table.address] })],
);

export const indexedBlocks = pgTable(
  "indexed_blocks",
  {
    chainId: integer("chain_id").notNull(),
    number: bigint("number", { mode: "bigint" }).notNull(),
    hash: text("hash").notNull(),
    parentHash: text("parent_hash").notNull(),
    observedAt: createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.number] }),
    uniqueIndex("indexed_blocks_chain_hash_idx").on(table.chainId, table.hash),
  ],
);

export const indexedEvents = pgTable(
  "indexed_events",
  {
    chainId: integer("chain_id").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    contractAddress: text("contract_address").notNull(),
    eventName: text("event_name").notNull(),
    args: jsonb("args").notNull(),
    removed: boolean("removed").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.transactionHash, table.logIndex] }),
    index("indexed_events_block_idx").on(table.chainId, table.blockNumber),
  ],
);

export const positionsCache = pgTable(
  "positions_cache",
  {
    chainId: integer("chain_id").notNull(),
    positionId: bigint("position_id", { mode: "bigint" }).notNull(),
    owner: text("owner").notNull(),
    creatorToken: text("creator_token").notNull(),
    state: text("state").notNull(),
    derivedData: jsonb("derived_data").notNull(),
    sourceBlock: bigint("source_block", { mode: "bigint" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chainId, table.positionId] }),
    index("positions_owner_idx").on(table.chainId, table.owner),
  ],
);

export const seniorPoolSnapshots = pgTable("senior_pool_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  chainId: integer("chain_id").notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt,
});

export const hedgeEpochSnapshots = pgTable("hedge_epoch_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  chainId: integer("chain_id").notNull(),
  epochId: bigint("epoch_id", { mode: "bigint" }).notNull(),
  blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt,
});

export const quoteRequests = pgTable("quote_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: text("request_id").notNull().unique(),
  chainId: integer("chain_id").notNull(),
  wallet: text("wallet"),
  kind: text("kind").notNull(),
  sanitizedRequest: jsonb("sanitized_request").notNull(),
  outcome: text("outcome").notNull(),
  createdAt,
});

export const riskAcknowledgements = pgTable(
  "risk_acknowledgements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    wallet: text("wallet").notNull(),
    version: text("version").notNull(),
    signature: text("signature").notNull(),
    acceptedAt: createdAt,
  },
  (table) => [
    uniqueIndex("risk_ack_wallet_version_idx").on(table.chainId, table.wallet, table.version),
  ],
);

export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: integer("chain_id").notNull(),
    wallet: text("wallet").notNull(),
    document: text("document").notNull(),
    version: text("version").notNull(),
    signature: text("signature").notNull(),
    acceptedAt: createdAt,
  },
  (table) => [
    uniqueIndex("legal_acceptance_wallet_version_idx").on(
      table.chainId,
      table.wallet,
      table.document,
      table.version,
    ),
  ],
);

export const notificationPreferences = pgTable("notification_preferences", {
  wallet: text("wallet").primaryKey(),
  channels: jsonb("channels").notNull().default({}),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const indexerCursors = pgTable("indexer_cursors", {
  chainId: integer("chain_id").primaryKey(),
  nextBlock: bigint("next_block", { mode: "bigint" }).notNull(),
  lastFinalizedHash: text("last_finalized_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
