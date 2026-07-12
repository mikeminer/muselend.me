"use client";

import { MuseLendPositionManagerAbi } from "@muselend/abis";
import Link from "next/link";
import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PositionTuple = readonly [
  `0x${string}`, `0x${string}`, `0x${string}`,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  number, number, number, number, bigint, number,
];

const states = ["None", "Open", "Settling", "Closed", "Defaulted", "Settlement pending"];
const pageSize = 25n;

export function PositionsPanel() {
  const [page, setPage] = useState(0n);
  const [stateFilter, setStateFilter] = useState("All");
  const { address, chainId, isConnected } = useAccount();
  const manager = contracts.positionManager;
  const enabled = deploymentConfigured && Boolean(manager) && Boolean(address) && chainId === 84532;
  const next = useReadContract({
    address: manager,
    abi: MuseLendPositionManagerAbi,
    functionName: "nextPositionId",
    query: { enabled },
  });
  const nextId = typeof next.data === "bigint" ? next.data : 1n;
  const newestExclusive = nextId > page * pageSize ? nextId - page * pageSize : 1n;
  const firstId = newestExclusive > pageSize ? newestExclusive - pageSize : 1n;
  const ids = Array.from({ length: Number(newestExclusive - firstId) }, (_, index) => firstId + BigInt(index));
  const reads = useReadContracts({
    contracts: manager ? ids.map((id) => ({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "positions" as const, args: [id] as const })) : [],
    query: { enabled: enabled && ids.length > 0 },
  });
  const ownedPositions = reads.data?.flatMap((result, index) => {
    if (result.status !== "success") return [];
    const position = result.result as unknown as PositionTuple;
    if (!address || position[0].toLowerCase() !== address.toLowerCase()) return [];
    return [{ id: ids[index], position }];
  }).reverse() ?? [];
  const positions = stateFilter === "All"
    ? ownedPositions
    : ownedPositions.filter(({ position }) => states[position[16]] === stateFilter);
  const hasOlder = firstId > 1n;
  const hasNewer = page > 0n;

  if (!deploymentConfigured) return <EmptyState title="Contracts not configured" text="Verified Base Sepolia addresses must be published before on-chain positions can be read." />;
  if (!isConnected) return <EmptyState title="Connect your wallet" text="Positions are read directly from the PositionManager and filtered by the connected owner." />;
  if (chainId !== 84532) return <EmptyState title="Switch to Base Sepolia" text="MuseLend testnet positions are available on chain 84532." />;
  if (next.isLoading || reads.isLoading) return <p className="text-sm text-muted-foreground">Loading positions from Base Sepolia…</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <label className="flex items-center gap-2 text-sm">State
        <select className="h-8 rounded-lg border bg-background px-2" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
          {["All", ...states.slice(1)].map((state) => <option key={state}>{state}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setPage((value) => value + 1n)} disabled={!hasOlder}>Older</Button>
        <span className="min-w-16 text-center text-sm text-muted-foreground">Page {Number(page + 1n)}</span>
        <Button variant="outline" onClick={() => setPage((value) => value > 0n ? value - 1n : 0n)} disabled={!hasNewer}>Newer</Button>
      </div>
    </div>
    {positions.length === 0 ? <EmptyState title="No positions on this page" text="Change the state filter or inspect older protocol position batches." /> : null}
    <div className="grid gap-4 lg:grid-cols-2">{positions.map(({ id, position }) => {
    const state = states[position[16]] ?? "Unknown";
    return <Link key={id.toString()} href={`/app/positions/${id}`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="flex-row items-center justify-between"><CardTitle className="font-mono">Position #{id.toString()}</CardTitle><Badge variant="outline">{state}</Badge></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <Metric label="Principal" value={usdc(position[5])} />
          <Metric label="Sale proceeds" value={usdc(position[4])} />
          <Metric label="Coverage cap" value={usdc(position[7])} />
          <Metric label="Maturity" value={new Date(Number(position[12]) * 1000).toLocaleDateString()} />
        </CardContent>
      </Card>
    </Link>;
    })}</div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-muted-foreground">{label}</p><p className="mt-1 font-mono">{value}</p></div>;
}

function usdc(value: bigint) { return `${Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`; }
