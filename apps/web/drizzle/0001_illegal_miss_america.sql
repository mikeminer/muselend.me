CREATE TABLE "analytics_aggregates" (
	"chain_id" integer NOT NULL,
	"bucket" timestamp with time zone NOT NULL,
	"metric" text NOT NULL,
	"dimension_key" text DEFAULT 'global' NOT NULL,
	"value" bigint NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_block" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_aggregates_chain_id_bucket_metric_dimension_key_pk" PRIMARY KEY("chain_id","bucket","metric","dimension_key")
);
