CREATE TABLE "hedge_epoch_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"epoch_id" bigint NOT NULL,
	"block_number" bigint NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexed_blocks" (
	"chain_id" integer NOT NULL,
	"number" bigint NOT NULL,
	"hash" text NOT NULL,
	"parent_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indexed_blocks_chain_id_number_pk" PRIMARY KEY("chain_id","number")
);
--> statement-breakpoint
CREATE TABLE "indexed_events" (
	"chain_id" integer NOT NULL,
	"transaction_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"contract_address" text NOT NULL,
	"event_name" text NOT NULL,
	"args" jsonb NOT NULL,
	"removed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "indexed_events_chain_id_transaction_hash_log_index_pk" PRIMARY KEY("chain_id","transaction_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "indexer_cursors" (
	"chain_id" integer PRIMARY KEY NOT NULL,
	"next_block" bigint NOT NULL,
	"last_finalized_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet" text NOT NULL,
	"document" text NOT NULL,
	"version" text NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"wallet" text PRIMARY KEY NOT NULL,
	"channels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions_cache" (
	"chain_id" integer NOT NULL,
	"position_id" bigint NOT NULL,
	"owner" text NOT NULL,
	"creator_token" text NOT NULL,
	"state" text NOT NULL,
	"derived_data" jsonb NOT NULL,
	"source_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_cache_chain_id_position_id_pk" PRIMARY KEY("chain_id","position_id")
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet" text,
	"kind" text NOT NULL,
	"sanitized_request" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_requests_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "risk_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"wallet" text NOT NULL,
	"version" text NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senior_pool_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_metadata" (
	"chain_id" integer NOT NULL,
	"address" text NOT NULL,
	"name" text,
	"symbol" text,
	"decimals" integer,
	"canonical_version" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "token_metadata_chain_id_address_pk" PRIMARY KEY("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"address" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "indexed_blocks_chain_hash_idx" ON "indexed_blocks" USING btree ("chain_id","hash");--> statement-breakpoint
CREATE INDEX "indexed_events_block_idx" ON "indexed_events" USING btree ("chain_id","block_number");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_acceptance_wallet_version_idx" ON "legal_acceptances" USING btree ("chain_id","wallet","document","version");--> statement-breakpoint
CREATE INDEX "positions_owner_idx" ON "positions_cache" USING btree ("chain_id","owner");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_ack_wallet_version_idx" ON "risk_acknowledgements" USING btree ("chain_id","wallet","version");