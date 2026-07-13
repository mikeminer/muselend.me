#!/usr/bin/env node

const targets = new Set(["base-sepolia", "vercel-production"]);
const targetArgument = process.argv.find((argument) =>
  argument.startsWith("--target="),
);
const target = targetArgument?.slice("--target=".length) ?? "vercel-production";

if (!targets.has(target)) {
  console.error(
    `Unknown target: ${target}. Use base-sepolia or vercel-production.`,
  );
  process.exit(2);
}

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const zeroAddress = /^0x0{40}$/i;
const failures = [];
const checks = [];

const record = (name, passed, reason) => {
  checks.push({ name, passed });
  if (!passed) failures.push(`${name}: ${reason}`);
};

const configured = (name) =>
  typeof process.env[name] === "string" && process.env[name].trim().length > 0;
const disabled = (name) => process.env[name] !== "true";
const validAddress = (name) =>
  configured(name) &&
  addressPattern.test(process.env[name]) &&
  !zeroAddress.test(process.env[name]);
const validUrl = (name, protocol = "https:") => {
  if (!configured(name)) return false;
  try {
    return new URL(process.env[name]).protocol === protocol;
  } catch {
    return false;
  }
};

record(
  "NEXT_PUBLIC_MAINNET_ENABLED disabled",
  process.env.NEXT_PUBLIC_MAINNET_ENABLED === "false",
  "must equal false",
);
record(
  "MAINNET_ENABLED disabled",
  process.env.MAINNET_ENABLED === "false",
  "must equal false",
);

for (const name of [
  "GEOFENCING_ENABLED",
  "ALLOWLIST_ENABLED",
  "KYC_ADAPTER_ENABLED",
  "JURISDICTION_RESTRICTIONS_ENABLED",
  "MAX_RETAIL_EXPOSURE_ENABLED",
]) {
  record(
    `${name} disabled`,
    disabled(name),
    "must not equal true before the documented legal decision",
  );
}

if (target === "base-sepolia") {
  record(
    "Base Sepolia RPC",
    validUrl("BASE_SEPOLIA_RPC_URL"),
    "must be a configured HTTPS URL",
  );
  for (const name of [
    "TESTNET_ADMIN",
    "TESTNET_TIMELOCK_PROPOSER",
    "TESTNET_PAUSE_GUARDIAN",
  ]) {
    record(name, validAddress(name), "must be a nonzero EVM address");
  }
} else {
  record(
    "production app URL",
    validUrl("NEXT_PUBLIC_APP_URL"),
    "must be a configured HTTPS URL",
  );
  record(
    "Base Sepolia RPC",
    validUrl("BASE_SEPOLIA_RPC_URL"),
    "must be a configured HTTPS URL",
  );
  record(
    "WalletConnect project",
    configured("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"),
    "is required",
  );
  record(
    "database",
    configured("DATABASE_URL"),
    "DATABASE_URL is required for durable acceptances and indexing",
  );
  record(
    "Redis URL",
    validUrl("KV_REST_API_URL") || validUrl("UPSTASH_REDIS_REST_URL"),
    "configure an HTTPS KV_REST_API_URL or UPSTASH_REDIS_REST_URL",
  );
  record(
    "Redis token",
    configured("KV_REST_API_TOKEN") || configured("UPSTASH_REDIS_REST_TOKEN"),
    "configure the token matching the Redis URL",
  );
  record(
    "session secret",
    (process.env.SESSION_SECRET?.length ?? 0) >= 32,
    "must contain at least 32 characters",
  );
  record(
    "indexer secret",
    (process.env.INDEXER_SYNC_SECRET?.length ?? 0) >= 32,
    "must contain at least 32 characters",
  );
  record(
    "deployment block",
    /^\d+$/.test(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ?? ""),
    "must be an integer",
  );

  for (const name of [
    "NEXT_PUBLIC_POSITION_MANAGER_ADDRESS",
    "NEXT_PUBLIC_SWAP_ADAPTER_ADDRESS",
    "NEXT_PUBLIC_INTEREST_RATE_MODEL_ADDRESS",
    "NEXT_PUBLIC_SENIOR_VAULT_ADDRESS",
    "NEXT_PUBLIC_HEDGE_EPOCH_VAULT_ADDRESS",
    "NEXT_PUBLIC_CREATOR_TOKEN_VALIDATOR_ADDRESS",
    "NEXT_PUBLIC_CREATOR_TOKEN_ADDRESS",
    "NEXT_PUBLIC_RISK_MANAGER_ADDRESS",
    "NEXT_PUBLIC_TIMELOCK_ADDRESS",
    "NEXT_PUBLIC_USDC_ADDRESS",
  ]) {
    record(name, validAddress(name), "must be a verified nonzero EVM address");
  }
}

for (const check of checks)
  console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);

if (failures.length > 0) {
  console.error(
    `\n${target} is not ready (${failures.length} blocker${failures.length === 1 ? "" : "s"}):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `\n${target} configuration is ready for the next operator-controlled step.`,
);
