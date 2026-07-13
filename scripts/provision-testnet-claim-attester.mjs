import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { privateKeyToAccount } = require("viem/accounts");

let privateKey;
let account;
while (!account) {
  privateKey = `0x${randomBytes(32).toString("hex")}`;
  try {
    account = privateKeyToAccount(privateKey);
  } catch {
    // Retry the vanishingly unlikely invalid secp256k1 scalar.
  }
}

const executable = process.platform === "win32" ? "vercel.cmd" : "vercel";
const result = spawnSync(
  executable,
  [
    "env",
    "add",
    "TESTNET_CLAIM_ATTESTER_PRIVATE_KEY",
    "production",
    "--sensitive",
    "--yes",
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    input: `${privateKey}\n`,
  },
);

if (result.status !== 0) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.replaceAll(privateKey, "[REDACTED]");
  throw new Error(`Vercel secret provisioning failed: ${output.trim()}`);
}

process.stdout.write(`${JSON.stringify({ attester: account.address })}\n`);
