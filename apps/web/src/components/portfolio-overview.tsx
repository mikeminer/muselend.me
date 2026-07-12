"use client";

import { MuseLendHedgeEpochVaultAbi, MuseLendPositionManagerAbi, MuseLendUSDCVaultAbi } from "@muselend/abis";
import Link from "next/link";
import { formatUnits } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { contracts, deploymentConfigured } from "@/lib/contracts";

type PositionTuple = readonly [
  `0x${string}`, `0x${string}`, `0x${string}`,
  bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
  number, number, number, number, bigint, number,
];

const positionWindow = 50n;
const epochWindow = 5n;

export function PortfolioOverview() {
  const { address, chainId, isConnected } = useAccount();
  const manager = contracts.positionManager;
  const senior = contracts.seniorVault;
  const hedge = contracts.hedgeEpochVault;
  const enabled = deploymentConfigured && Boolean(address) && chainId === 84532;
  const nextPosition = useReadContract({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "nextPositionId", query: { enabled } });
  const nextEpoch = useReadContract({ address: hedge, abi: MuseLendHedgeEpochVaultAbi, functionName: "nextEpochId", query: { enabled } });
  const nextPositionId = typeof nextPosition.data === "bigint" ? nextPosition.data : 1n;
  const firstPositionId = nextPositionId > positionWindow ? nextPositionId - positionWindow : 1n;
  const positionIds = range(firstPositionId, nextPositionId);
  const nextEpochId = typeof nextEpoch.data === "bigint" ? nextEpoch.data : 1n;
  const firstEpochId = nextEpochId > epochWindow ? nextEpochId - epochWindow : 1n;
  const epochIds = range(firstEpochId, nextEpochId);
  const seniorSharesRead = useReadContract({ address: senior, abi: MuseLendUSDCVaultAbi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled } });
  const positionReads = useReadContracts({
    contracts: manager ? positionIds.map((id) => ({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "positions" as const, args: [id] as const })) : [],
    query: { enabled },
  });
  const epochReads = useReadContracts({
    contracts: hedge && address ? epochIds.map((id) => ({ address: hedge, abi: MuseLendHedgeEpochVaultAbi, functionName: "balanceOf" as const, args: [address, id] as const })) : [],
    query: { enabled },
  });

  if (!deploymentConfigured) return <EmptyState title="Contracts not configured" text="Verified Base Sepolia addresses must be published before the portfolio can be loaded." />;
  if (!isConnected) return <EmptyState title="Connect your wallet" text="Your portfolio is assembled from verified Base Sepolia contracts without custody or off-chain balances." />;
  if (chainId !== 84532) return <EmptyState title="Switch to Base Sepolia" text="MuseLend testnet portfolio data is available on chain 84532." />;
  if (nextPosition.isLoading || nextEpoch.isLoading || seniorSharesRead.isLoading || positionReads.isLoading || epochReads.isLoading) return <p className="text-sm text-muted-foreground" role="status">Loading portfolio from Base Sepolia…</p>;
  if (nextPosition.isError || nextEpoch.isError || seniorSharesRead.isError || positionReads.isError || epochReads.isError) return <EmptyState title="Portfolio temporarily unavailable" text="The verified Base Sepolia RPC did not return a complete portfolio. Retry after the connection recovers." />;

  const seniorShares = typeof seniorSharesRead.data === "bigint" ? seniorSharesRead.data : 0n;
  const owned = (positionReads.data ?? []).flatMap((result, index) => {
    if (result.status !== "success") return [];
    const position = result.result as unknown as PositionTuple;
    return address && position[0].toLowerCase() === address.toLowerCase() ? [{ id: positionIds[index], position }] : [];
  });
  const active = owned.filter(({ position }) => position[16] === 1 || position[16] === 2 || position[16] === 5);
  const principal = active.reduce((total, { position }) => total + position[5], 0n);
  const juniorShares = (epochReads.data ?? []).reduce((total, result) => total + readBigInt(result), 0n);
  const recent = [...owned].reverse().slice(0, 3);

  return <div className="space-y-8">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Active positions" value={active.length.toLocaleString()} detail={`Newest ${positionWindow} protocol positions scanned`} />
      <MetricCard label="Originated principal" value={usdc(principal)} detail="Across your active positions" />
      <MetricCard label="Senior shares" value={units(seniorShares)} detail="ERC-4626 vault balance" />
      <MetricCard label="Junior shares" value={units(juniorShares)} detail={`Across the latest ${epochWindow} epochs`} />
    </div>
    {owned.length === 0 && seniorShares === 0n && juniorShares === 0n ? <EmptyState title="No on-chain activity yet" text="Open a capped position or allocate Base Sepolia USDC to a MuseLend vault." /> : null}
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4"><CardTitle>Recent positions</CardTitle><Button asChild variant="outline"><Link href="/app/positions">View all</Link></Button></CardHeader>
      <CardContent>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">No owned positions in the latest protocol window.</p> : <ul className="divide-y">{recent.map(({ id, position }) => <li key={id.toString()}><Link href={`/app/positions/${id}`} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-primary"><span className="font-mono">Position #{id.toString()}</span><span>{usdc(position[5])} · {stateName(position[16])}</span></Link></li>)}</ul>}
      </CardContent>
    </Card>
    <div className="flex flex-wrap gap-3"><Button asChild><Link href="/app/borrow">Review a borrow quote</Link></Button><Button asChild variant="outline"><Link href="/app/lend">Manage senior vault</Link></Button><Button asChild variant="outline"><Link href="/app/underwrite">Manage hedge epochs</Link></Button></div>
  </div>;
}

function range(first: bigint, exclusiveEnd: bigint) { return Array.from({ length: Number(exclusiveEnd - first) }, (_, index) => first + BigInt(index)); }
function readBigInt(result: { status: string; result?: unknown } | undefined) { return result?.status === "success" && typeof result.result === "bigint" ? result.result : 0n; }
function units(value: bigint) { return Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function usdc(value: bigint) { return `${units(value)} USDC`; }
function stateName(state: number) { return ["None", "Open", "Settling", "Closed", "Defaulted", "Settlement pending"][state] ?? "Unknown"; }
