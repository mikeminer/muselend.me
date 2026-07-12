import { getDatabase } from "@/db/client";
import { hedgeEpochSnapshots, quoteRequests, seniorPoolSnapshots, tokenMetadata } from "@/db/schema";
import { withTimeout } from "@/lib/api";

type QuoteLog = {
  requestId: string;
  kind: "sell" | "buy-exact-output" | "buy-exact-input";
  creatorToken: string;
  amount: string;
  slippageBps: number;
  deadline: number;
  outcome: string;
};

export async function recordQuoteRequest(log: QuoteLog) {
  await optionalWrite(async () => {
    await getDatabase().insert(quoteRequests).values({
      requestId: log.requestId,
      chainId: 84532,
      kind: log.kind,
      sanitizedRequest: {
        creatorToken: log.creatorToken.toLowerCase(),
        amount: log.amount,
        slippageBps: log.slippageBps,
        deadline: log.deadline,
      },
      outcome: log.outcome,
    }).onConflictDoNothing();
  });
}

export async function cacheTokenMetadata(entry: { address: string; name: string; symbol: string; decimals: number }) {
  await optionalWrite(async () => {
    await getDatabase().insert(tokenMetadata).values({
      chainId: 84532,
      address: entry.address.toLowerCase(),
      name: entry.name,
      symbol: entry.symbol,
      decimals: entry.decimals,
      metadata: { source: "base-sepolia" },
    }).onConflictDoUpdate({
      target: [tokenMetadata.chainId, tokenMetadata.address],
      set: { name: entry.name, symbol: entry.symbol, decimals: entry.decimals, metadata: { source: "base-sepolia" }, updatedAt: new Date() },
    });
  });
}

export async function cachePoolSnapshots(entry: { blockNumber: bigint; senior: Record<string, string>; epochs: Array<{ epochId: string } & Record<string, string>> }) {
  await optionalWrite(async () => {
    const db = getDatabase();
    await db.insert(seniorPoolSnapshots).values({ chainId: 84532, blockNumber: entry.blockNumber, snapshot: entry.senior }).onConflictDoNothing();
    if (entry.epochs.length) await db.insert(hedgeEpochSnapshots).values(entry.epochs.map((epoch) => ({ chainId: 84532, epochId: BigInt(epoch.epochId), blockNumber: entry.blockNumber, snapshot: epoch }))).onConflictDoNothing();
  });
}

async function optionalWrite(operation: () => Promise<void>) {
  if (!process.env.DATABASE_URL) return;
  try {
    await withTimeout(operation(), 1_000);
  } catch {
    // Cache and analytics writes must never replace authoritative chain responses.
  }
}
