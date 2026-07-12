import type { Block, ChainLog, Hex, IndexStore, ReadClient } from "@muselend/indexer";
import { and, eq, gte } from "drizzle-orm";
import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { getDatabase } from "@/db/client";
import {
  hedgeEpochSnapshots,
  indexedBlocks,
  indexedEvents,
  indexerCursors,
  positionsCache,
  seniorPoolSnapshots,
} from "@/db/schema";

export function createReadClient(rpcUrl: string): ReadClient {
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  return {
    async getBlock({ blockNumber }) {
      const block = await client.getBlock({ blockNumber });
      if (!block.hash) throw new Error("Canonical block has no hash");
      return { number: block.number, hash: block.hash, parentHash: block.parentHash };
    },
    async getLogs({ fromBlock, toBlock, address }) {
      const logs = await client.getLogs({ fromBlock, toBlock, address: address as Address[] | undefined });
      return logs.map((log) => {
        if (log.blockNumber === null || !log.blockHash || !log.transactionHash || log.logIndex === null) {
          throw new Error("Unmined log returned by finalized range");
        }
        return {
          blockNumber: log.blockNumber,
          blockHash: log.blockHash,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
          address: log.address,
          topics: [...log.topics],
          data: log.data,
          removed: log.removed,
        } satisfies ChainLog;
      });
    },
  };
}

export async function getLatestBlockNumber(rpcUrl: string) {
  return createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }).getBlockNumber();
}

export function createIndexStore(): IndexStore {
  const db = getDatabase();
  return {
    async cursor(chainId) {
      const [cursor] = await db.select().from(indexerCursors).where(eq(indexerCursors.chainId, chainId)).limit(1);
      if (!cursor?.lastFinalizedHash || cursor.nextBlock === 0n) return null;
      return { blockNumber: cursor.nextBlock - 1n, blockHash: cursor.lastFinalizedHash as Hex };
    },
    async blockHash(chainId, blockNumber) {
      const [block] = await db.select({ hash: indexedBlocks.hash }).from(indexedBlocks)
        .where(and(eq(indexedBlocks.chainId, chainId), eq(indexedBlocks.number, blockNumber))).limit(1);
      return block?.hash ? block.hash as Hex : null;
    },
    async rollback(chainId, fromBlock) {
      await db.delete(indexedEvents).where(and(eq(indexedEvents.chainId, chainId), gte(indexedEvents.blockNumber, fromBlock)));
      await db.delete(positionsCache).where(and(eq(positionsCache.chainId, chainId), gte(positionsCache.sourceBlock, fromBlock)));
      await db.delete(seniorPoolSnapshots).where(and(eq(seniorPoolSnapshots.chainId, chainId), gte(seniorPoolSnapshots.blockNumber, fromBlock)));
      await db.delete(hedgeEpochSnapshots).where(and(eq(hedgeEpochSnapshots.chainId, chainId), gte(hedgeEpochSnapshots.blockNumber, fromBlock)));
      await db.delete(indexedBlocks).where(and(eq(indexedBlocks.chainId, chainId), gte(indexedBlocks.number, fromBlock)));
      await db.insert(indexerCursors).values({ chainId, nextBlock: fromBlock, lastFinalizedHash: null })
        .onConflictDoUpdate({ target: indexerCursors.chainId, set: { nextBlock: fromBlock, lastFinalizedHash: null, updatedAt: new Date() } });
    },
    async insertLogs(chainId, logs) {
      if (logs.length === 0) return;
      await db.insert(indexedEvents).values(logs.map((log) => ({
        chainId,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        contractAddress: log.address.toLowerCase(),
        eventName: log.topics[0] ?? "anonymous",
        args: { blockHash: log.blockHash, topics: log.topics, data: log.data },
        removed: log.removed ?? false,
      }))).onConflictDoNothing();
    },
    async saveCursor(chainId, block: Block) {
      await db.insert(indexedBlocks).values({ chainId, number: block.number, hash: block.hash, parentHash: block.parentHash })
        .onConflictDoUpdate({ target: [indexedBlocks.chainId, indexedBlocks.number], set: { hash: block.hash, parentHash: block.parentHash } });
      await db.insert(indexerCursors).values({ chainId, nextBlock: block.number + 1n, lastFinalizedHash: block.hash })
        .onConflictDoUpdate({ target: indexerCursors.chainId, set: { nextBlock: block.number + 1n, lastFinalizedHash: block.hash, updatedAt: new Date() } });
    },
  };
}

export function configuredIndexerAddresses(): Hex[] {
  return [
    process.env.NEXT_PUBLIC_POSITION_MANAGER_ADDRESS,
    process.env.NEXT_PUBLIC_SENIOR_VAULT_ADDRESS,
    process.env.NEXT_PUBLIC_HEDGE_EPOCH_VAULT_ADDRESS,
    process.env.NEXT_PUBLIC_CREATOR_TOKEN_VALIDATOR_ADDRESS,
    process.env.NEXT_PUBLIC_RISK_MANAGER_ADDRESS,
    process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS,
  ].filter((value): value is Hex => Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value)));
}
