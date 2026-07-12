"use client";

import { MuseLendPositionManagerAbi } from "@muselend/abis";
import Link from "next/link";
import { formatUnits } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PositionTuple = readonly [
  `0x${string}`, `0x${string}`, `0x${string}`,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  number, number, number, number, bigint, number,
];

const states = ["Open", "Settling", "Closed", "Defaulted"];

export function PositionsPanel() {
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
  const firstId = nextId > 25n ? nextId - 25n : 1n;
  const ids = Array.from({ length: Number(nextId - firstId) }, (_, index) => firstId + BigInt(index));
  const reads = useReadContracts({
    contracts: manager ? ids.map((id) => ({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "positions" as const, args: [id] as const })) : [],
    query: { enabled: enabled && ids.length > 0 },
  });
  const positions = reads.data?.flatMap((result, index) => {
    if (result.status !== "success") return [];
    const position = result.result as unknown as PositionTuple;
    if (!address || position[0].toLowerCase() !== address.toLowerCase()) return [];
    return [{ id: ids[index], position }];
  }).reverse() ?? [];

  if (!deploymentConfigured) return <EmptyState title="Contracts not configured" text="Verified Base Sepolia addresses must be published before on-chain positions can be read." />;
  if (!isConnected) return <EmptyState title="Connect your wallet" text="Positions are read directly from the PositionManager and filtered by the connected owner." />;
  if (chainId !== 84532) return <EmptyState title="Switch to Base Sepolia" text="MuseLend testnet positions are available on chain 84532." />;
  if (next.isLoading || reads.isLoading) return <p className="text-sm text-muted-foreground">Loading positions from Base Sepolia…</p>;
  if (positions.length === 0) return <EmptyState title="No positions found" text="The latest 25 protocol positions contain no receipt owned by this wallet." />;

  return <div className="grid gap-4 lg:grid-cols-2">{positions.map(({ id, position }) => {
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
  })}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-muted-foreground">{label}</p><p className="mt-1 font-mono">{value}</p></div>;
}

function usdc(value: bigint) { return `${Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`; }
