import { MuseLendHedgeEpochVaultAbi, MuseLendUSDCVaultAbi } from "@muselend/abis";
import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { apiError, completeRequest, rateLimitResponse, requestContext, withTimeout } from "@/lib/api";
import { poolSnapshotQuery } from "@/lib/api-schemas";
import { cachePoolSnapshots } from "@/lib/optional-persistence";

export async function GET(request: Request) {
  const context = await requestContext(request);
  if (context.limited) return rateLimitResponse(context.requestId);
  const parsed = poolSnapshotQuery.safeParse({ epochLimit: new URL(request.url).searchParams.get("epochLimit") ?? undefined });
  if (!parsed.success) return apiError(context.requestId, 400, "INVALID_REQUEST", "Snapshot query validation failed", parsed.error.issues);
  const seniorAddress = process.env.NEXT_PUBLIC_SENIOR_VAULT_ADDRESS;
  const hedgeAddress = process.env.NEXT_PUBLIC_HEDGE_EPOCH_VAULT_ADDRESS;
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
  if (!rpcUrl || !isAddress(seniorAddress ?? "") || !isAddress(hedgeAddress ?? "")) {
    return apiError(context.requestId, 503, "DEPLOYMENT_MISSING", "Verified Base Sepolia pool addresses are not configured");
  }
  try {
    const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
    const senior = seniorAddress as Address;
    const hedge = hedgeAddress as Address;
    const [blockNumber, availableCash, totalAssets, principal, debtShares, borrowIndex, nextEpochId] = await withTimeout(Promise.all([
      client.getBlockNumber(),
      client.readContract({ address: senior, abi: MuseLendUSDCVaultAbi, functionName: "availableCash" }),
      client.readContract({ address: senior, abi: MuseLendUSDCVaultAbi, functionName: "totalAssets" }),
      client.readContract({ address: senior, abi: MuseLendUSDCVaultAbi, functionName: "totalPrincipalOutstanding" }),
      client.readContract({ address: senior, abi: MuseLendUSDCVaultAbi, functionName: "totalDebtShares" }),
      client.readContract({ address: senior, abi: MuseLendUSDCVaultAbi, functionName: "previewBorrowIndex" }),
      client.readContract({ address: hedge, abi: MuseLendHedgeEpochVaultAbi, functionName: "nextEpochId" }),
    ]));
    const firstEpoch = nextEpochId > BigInt(parsed.data.epochLimit) ? nextEpochId - BigInt(parsed.data.epochLimit) : 1n;
    const epochIds = Array.from({ length: Number(nextEpochId - firstEpoch) }, (_, index) => firstEpoch + BigInt(index));
    const epochs = await withTimeout(Promise.all(epochIds.map(async (epochId) => {
      const [epoch, coverage, shares] = await Promise.all([
        client.readContract({ address: hedge, abi: MuseLendHedgeEpochVaultAbi, functionName: "epochs", args: [epochId] }),
        client.readContract({ address: hedge, abi: MuseLendHedgeEpochVaultAbi, functionName: "availableCoverage", args: [epochId] }),
        client.readContract({ address: hedge, abi: MuseLendHedgeEpochVaultAbi, functionName: "totalShares", args: [epochId] }),
      ]);
      return epochSnapshot(epochId, epoch, coverage, shares);
    })));
    const seniorSnapshot = { availableCash: availableCash.toString(), totalAssets: totalAssets.toString(), totalPrincipalOutstanding: principal.toString(), totalDebtShares: debtShares.toString(), borrowIndex: borrowIndex.toString() };
    await cachePoolSnapshots({ blockNumber, senior: seniorSnapshot, epochs });
    completeRequest(context, 200);
    return NextResponse.json({ chainId: 84532, blockNumber: blockNumber.toString(), senior: seniorSnapshot, epochs, source: "base-sepolia", requestId: context.requestId }, { headers: { "cache-control": "public, max-age=10, stale-while-revalidate=30", "x-request-id": context.requestId } });
  } catch {
    return apiError(context.requestId, 503, "SNAPSHOT_UNAVAILABLE", "Base Sepolia pool snapshots are temporarily unavailable");
  }
}

type EpochTuple = readonly [number, number, number, number, number, bigint, bigint, bigint, bigint, bigint, boolean];
export function epochSnapshot(epochId: bigint, value: EpochTuple, coverage: bigint, shares: bigint) {
  return { epochId: epochId.toString(), depositStart: value[0].toString(), depositEnd: value[1].toString(), start: value[2].toString(), end: value[3].toString(), settlementDeadline: value[4].toString(), depositedCapital: value[5].toString(), lockedCoverage: value[6].toString(), premium: value[7].toString(), realizedPnl: value[8].toString(), openPositions: value[9].toString(), closed: String(value[10]), availableCoverage: coverage.toString(), totalShares: shares.toString() };
}
