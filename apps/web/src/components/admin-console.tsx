"use client";

import { MuseLendRiskManagerAbi } from "@muselend/abis";
import { keccak256, toBytes } from "viem";
import {
  useAccount,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from "wagmi";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { TransactionStatus } from "@/components/transaction-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const riskAdminRole = keccak256(toBytes("RISK_ADMIN_ROLE"));
const pauseGuardianRole = keccak256(toBytes("PAUSE_GUARDIAN_ROLE"));

export function AdminConsole() {
  const { address, chainId, isConnected } = useAccount();
  const riskManager = contracts.riskManager;
  const enabled = deploymentConfigured && Boolean(address) && chainId === 84532 && Boolean(riskManager);
  const reads = useReadContracts({
    contracts: enabled && address && riskManager ? [
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "hasRole", args: [riskAdminRole, address] },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "hasRole", args: [pauseGuardianRole, address] },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "openingsPaused" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "depositsPaused" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "mainnetEnabled" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "globalSeniorDebtCap" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "globalJuniorCoverageCap" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "originationFeeBps" },
    ] : [],
    query: { enabled },
  });
  const value = (index: number) => reads.data?.[index]?.status === "success" ? reads.data[index].result : undefined;
  const isRiskAdmin = value(0) === true;
  const isGuardian = value(1) === true;
  const openingsPaused = value(2) === true;
  const depositsPaused = value(3) === true;
  const mainnetEnabled = value(4) === true;
  const seniorCap = typeof value(5) === "bigint" ? value(5) as bigint : 0n;
  const juniorCap = typeof value(6) === "bigint" ? value(6) as bigint : 0n;
  const feeBps = typeof value(7) === "number" ? value(7) as number : 0;
  const pauseSimulation = useSimulateContract({
    address: riskManager,
    abi: MuseLendRiskManagerAbi,
    functionName: "pauseRisk",
    account: address,
    query: { enabled: enabled && isGuardian && !openingsPaused },
  });
  const unpauseSimulation = useSimulateContract({
    address: riskManager,
    abi: MuseLendRiskManagerAbi,
    functionName: "unpauseRisk",
    account: address,
    query: { enabled: enabled && isRiskAdmin && openingsPaused },
  });
  const transaction = useWriteContract();
  const receipt = useTrackedTransaction(transaction.data);
  const busy = transaction.isPending || receipt.status === "confirming";

  if (!deploymentConfigured) return <Alert><AlertTitle>Testnet deployment not configured</AlertTitle><AlertDescription>The console is fail-closed until every verified address, including RiskManager and timelock, is published.</AlertDescription></Alert>;
  if (!isConnected) return <Alert><AlertTitle>Connect a wallet</AlertTitle><AlertDescription>Role checks are performed directly against the deployed AccessControl contracts.</AlertDescription></Alert>;
  if (chainId !== 84532) return <Alert><AlertTitle>Wrong network</AlertTitle><AlertDescription>Switch to Base Sepolia. Mainnet administrative actions are disabled.</AlertDescription></Alert>;

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      <StatusCard title="Openings" active={!openingsPaused} />
      <StatusCard title="Deposits" active={!depositsPaused} />
      <StatusCard title="Mainnet" active={mainnetEnabled} danger />
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Verified wallet roles</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <Role label="Risk admin / timelock" active={isRiskAdmin} />
        <Role label="Pause guardian" active={isGuardian} />
        {!isRiskAdmin && !isGuardian ? <p className="text-muted-foreground">This wallet has read-only access.</p> : null}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Current risk envelope</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <Row label="Senior debt cap" value={`${formatUsdc(seniorCap)} USDC`} />
        <Row label="Junior coverage cap" value={`${formatUsdc(juniorCap)} USDC`} />
        <Row label="Origination fee" value={`${feeBps / 100}%`} />
        <Row label="Timelock" value={short(contracts.timelock)} />
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Emergency controls</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Every enabled write is simulated with the connected account before the wallet receives a request.</p>
      {!openingsPaused && isGuardian ? <Button variant="destructive" disabled={!pauseSimulation.data?.request || busy} onClick={() => pauseSimulation.data?.request && transaction.writeContract(pauseSimulation.data.request)}>{busy ? "Confirming…" : "Pause new risk"}</Button> : null}
      {openingsPaused && isRiskAdmin ? <Button disabled={!unpauseSimulation.data?.request || busy} onClick={() => unpauseSimulation.data?.request && transaction.writeContract(unpauseSimulation.data.request)}>{busy ? "Confirming…" : "Unpause after review"}</Button> : null}
      <TransactionStatus hash={receipt.finalHash} walletPending={transaction.isPending} confirming={receipt.status === "confirming"} confirmed={receipt.status === "confirmed"} error={transaction.error ?? receipt.error} replacementReason={receipt.replacementReason} label="Governance transaction" />
    </CardContent></Card>
  </div>;
}

function StatusCard({ title, active, danger = false }: { title: string; active: boolean; danger?: boolean }) { return <Card><CardContent className="flex items-center justify-between pt-6"><span>{title}</span><Badge variant={active && danger ? "destructive" : "outline"}>{active ? "Enabled" : "Disabled"}</Badge></CardContent></Card>; }
function Role({ label, active }: { label: string; active: boolean }) { return <div className="flex items-center justify-between"><span>{label}</span><Badge variant="outline">{active ? "Granted" : "Not granted"}</Badge></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="break-all text-right font-mono">{value}</span></div>; }
function formatUsdc(value: bigint) { return (Number(value) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function short(value: string | undefined) { return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "Not configured"; }
