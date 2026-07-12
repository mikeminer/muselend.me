"use client";

import { MuseLendPositionManagerAbi } from "@muselend/abis";
import { useQuery } from "@tanstack/react-query";
import type { Address, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { contracts, deploymentBlock } from "@/lib/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const pageSize = 10_000n;
const maximumPages = 250;
const historyEvents = ["PositionOpened", "PositionRepaid", "PositionSettlementPending", "PositionClosed", "PositionDefaulted"] as const;

export function PositionHistory({ id, enabled }: { id: bigint; enabled: boolean }) {
  const client = usePublicClient({ chainId: 84532 });
  const manager = contracts.positionManager;
  const history = useQuery({
    queryKey: ["position-history", manager, id.toString(), deploymentBlock?.toString()],
    queryFn: () => loadPositionHistory(client!, manager!, id, deploymentBlock!),
    enabled: enabled && Boolean(client && manager && deploymentBlock !== undefined),
    staleTime: 15_000,
  });

  if (deploymentBlock === undefined) return <Card><CardHeader><CardTitle>Transaction history</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">History activates only after the verified deployment block is published.</p></CardContent></Card>;
  if (history.isLoading) return <Card><CardHeader><CardTitle>Transaction history</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Loading canonical Base Sepolia events…</p></CardContent></Card>;
  if (history.isError) return <Card><CardHeader><CardTitle>Transaction history</CardTitle></CardHeader><CardContent><p className="text-sm text-destructive">On-chain history is temporarily unavailable. Position accounting above remains a direct contract read.</p></CardContent></Card>;
  if (!history.data?.length) return <Card><CardHeader><CardTitle>Transaction history</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">No canonical event was returned for this position.</p></CardContent></Card>;

  return <Card className="lg:col-span-2"><CardHeader><CardTitle>Transaction history</CardTitle></CardHeader><CardContent><ol className="space-y-4">{history.data.map((event) => (
    <li key={`${event.transactionHash}-${event.logIndex}`} className="border-l border-primary/40 pl-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{eventLabel(event.eventName)}</p><p className="font-mono text-xs text-muted-foreground">Block {event.blockNumber.toString()}</p></div>
      <a className="mt-1 inline-flex break-all font-mono text-xs text-primary underline underline-offset-4" href={`https://sepolia.basescan.org/tx/${event.transactionHash}`} target="_blank" rel="noreferrer">{event.transactionHash}</a>
    </li>
  ))}</ol></CardContent></Card>;
}

export async function loadPositionHistory(client: PublicClient, manager: Address, positionId: bigint, fromBlock: bigint) {
  const latest = await client.getBlockNumber();
  const results: HistoryEvent[] = [];
  for (const { start, end } of historyRanges(fromBlock, latest)) {
    for (const eventName of historyEvents) {
      const logs = await client.getContractEvents({ address: manager, abi: MuseLendPositionManagerAbi, eventName, args: { positionId }, fromBlock: start, toBlock: end });
      for (const log of logs) {
        if (log.blockNumber === null || !log.transactionHash || log.logIndex === null) continue;
        results.push({ eventName, blockNumber: log.blockNumber, transactionHash: log.transactionHash, logIndex: log.logIndex });
      }
    }
  }
  return results.sort((a, b) => a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1);
}

export function historyRanges(fromBlock: bigint, latest: bigint) {
  if (fromBlock > latest) return [];
  const pages = Number((latest - fromBlock) / pageSize) + 1;
  if (pages > maximumPages) throw new Error("Deployment history exceeds bounded browser scan");
  return Array.from({ length: pages }, (_, index) => {
    const start = fromBlock + BigInt(index) * pageSize;
    return { start, end: start + pageSize - 1n > latest ? latest : start + pageSize - 1n };
  });
}

export function eventLabel(eventName: typeof historyEvents[number]) {
  return ({ PositionOpened: "Position opened and token sold", PositionRepaid: "Senior debt repaid", PositionSettlementPending: "Settlement marked pending", PositionClosed: "Position closed", PositionDefaulted: "Position defaulted" } as const)[eventName];
}

type HistoryEvent = { eventName: typeof historyEvents[number]; blockNumber: bigint; transactionHash: `0x${string}`; logIndex: number };
