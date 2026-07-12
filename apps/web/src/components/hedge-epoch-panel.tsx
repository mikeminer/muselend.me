"use client";

import { MuseLendHedgeEpochVaultAbi } from "@muselend/abis";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, maxUint256, parseAbi, parseUnits } from "viem";
import { useAccount, useBlock, useReadContracts, useSimulateContract, useWriteContract } from "wagmi";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { MetricCard } from "@/components/metric-card";
import { TransactionStatus } from "@/components/transaction-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const erc20Abi = parseAbi([
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

export function HedgeEpochPanel() {
  const { address, chainId } = useAccount();
  const [epoch, setEpoch] = useState("1");
  const [amount, setAmount] = useState("");
  const epochId = /^\d+$/.test(epoch) ? BigInt(epoch) : 0n;
  const assets = useMemo(() => safeParse(amount), [amount]);
  const vault = contracts.hedgeEpochVault;
  const usdc = contracts.usdc;
  const enabled = deploymentConfigured && Boolean(address) && chainId === 84532 && epochId > 0n;
  const reads = useReadContracts({
    contracts:
      enabled && address && vault && usdc
        ? [
            { address: usdc, abi: erc20Abi, functionName: "allowance", args: [address, vault] },
            { address: vault, abi: MuseLendHedgeEpochVaultAbi, functionName: "epochs", args: [epochId] },
            { address: vault, abi: MuseLendHedgeEpochVaultAbi, functionName: "availableCoverage", args: [epochId] },
            { address: vault, abi: MuseLendHedgeEpochVaultAbi, functionName: "balanceOf", args: [address, epochId] },
          ]
        : [],
    query: { enabled },
  });
  const allowance = resultBigInt(reads.data?.[0]);
  const epochData = reads.data?.[1]?.status === "success" ? (reads.data[1].result as readonly unknown[]) : undefined;
  const available = resultBigInt(reads.data?.[2]);
  const shares = resultBigInt(reads.data?.[3]);
  const deposited = (epochData?.[5] as bigint | undefined) ?? 0n;
  const locked = (epochData?.[6] as bigint | undefined) ?? 0n;
  const premium = (epochData?.[7] as bigint | undefined) ?? 0n;
  const closed = (epochData?.[10] as boolean | undefined) ?? false;
  const realizedPnl = (epochData?.[8] as bigint | undefined) ?? 0n;
  const openPositions = (epochData?.[9] as bigint | undefined) ?? 0n;
  const settlementDeadline = (epochData?.[4] as number | undefined) ?? 0;
  const refetchReads = reads.refetch;
  const block = useBlock({ query: { enabled } });
  const approveSimulation = useSimulateContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: vault ? [vault, maxUint256] : undefined, account: address, query: { enabled: enabled && assets > allowance } });
  const depositSimulation = useSimulateContract({ address: vault, abi: MuseLendHedgeEpochVaultAbi, functionName: "deposit", args: address ? [epochId, assets, address] : undefined, account: address, query: { enabled: enabled && assets > 0n && allowance >= assets } });
  const redeemSimulation = useSimulateContract({ address: vault, abi: MuseLendHedgeEpochVaultAbi, functionName: "redeem", args: address ? [epochId, shares, address] : undefined, account: address, query: { enabled: enabled && closed && shares > 0n } });
  const closeSimulation = useSimulateContract({ address: vault, abi: MuseLendHedgeEpochVaultAbi, functionName: "closeEpoch", args: [epochId], account: address, query: { enabled: enabled && !closed && openPositions === 0n && Boolean(block.data && block.data.timestamp >= BigInt((epochData?.[3] as number | undefined) ?? 0)) } });
  const transaction = useWriteContract();
  const receipt = useTrackedTransaction(transaction.data);
  const busy = transaction.isPending || receipt.status === "confirming";

  useEffect(() => { if (receipt.status === "confirmed") void refetchReads(); }, [receipt.status, refetchReads]);
  const approve = () => { if (approveSimulation.data?.request) transaction.writeContract(approveSimulation.data.request); };
  const deposit = () => { if (depositSimulation.data?.request) transaction.writeContract(depositSimulation.data.request); };
  const redeem = () => { if (redeemSimulation.data?.request) transaction.writeContract(redeemSimulation.data.request); };
  const close = () => { if (closeSimulation.data?.request) transaction.writeContract(closeSimulation.data.request); };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Epoch capital" value={format(deposited)} detail={`Epoch #${epoch || "—"}`} />
        <MetricCard label="Locked coverage" value={format(locked)} detail={`${format(available)} available`} />
        <MetricCard label="Premium realized" value={format(premium)} detail="Before protocol fees" />
        <MetricCard label="Your epoch shares" value={format(shares)} detail={closed ? "Redeemable" : "Locked until close"} />
        <MetricCard label="Realized PnL" value={format(realizedPnl)} detail="After settled position losses" />
        <MetricCard label="Settlement deadline" value={settlementDeadline ? new Date(settlementDeadline * 1000).toLocaleDateString() : "—"} detail={`${openPositions} linked positions · max allocated loss ${format(locked)}`} />
      </div>
      {!deploymentConfigured ? (
        <Alert className="mt-6 border-amber-300/20 bg-amber-300/5">
          <AlertTitle>Base Sepolia deployment not configured</AlertTitle>
          <AlertDescription>Epoch transactions activate only after verified addresses are published.</AlertDescription>
        </Alert>
      ) : null}
      <Card className="mt-8 max-w-xl">
        <CardHeader><CardTitle>Epoch position</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="epoch-id">Epoch ID</Label>
            <Input id="epoch-id" inputMode="numeric" value={epoch} onChange={(event) => setEpoch(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="epoch-assets">USDC to allocate</Label>
            <Input id="epoch-assets" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!enabled} />
          </div>
          {assets > allowance ? (
            <Button className="w-full" onClick={approve} disabled={busy || !approveSimulation.data?.request}>
              {busy ? "Confirming…" : "Approve USDC"}
            </Button>
          ) : (
            <Button className="w-full" onClick={deposit} disabled={busy || !depositSimulation.data?.request}>
              {busy ? "Confirming…" : "Deposit into epoch"}
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={close} disabled={busy || !closeSimulation.data?.request}>Close settled epoch</Button>
          <Button variant="outline" className="w-full" onClick={redeem} disabled={busy || !redeemSimulation.data?.request}>
            {busy ? "Confirming…" : "Redeem all epoch shares"}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            Junior capital can lose value and cannot exit while linked positions remain open.
          </p>
        </CardContent>
      </Card>
      <TransactionStatus hash={receipt.finalHash} walletPending={transaction.isPending} confirming={receipt.status === "confirming"} confirmed={receipt.status === "confirmed"} error={transaction.error ?? receipt.error} replacementReason={receipt.replacementReason} label="Epoch transaction" />
    </>
  );
}

function resultBigInt(result: { status: string; result?: unknown } | undefined) {
  return result?.status === "success" && typeof result.result === "bigint" ? result.result : 0n;
}

function safeParse(value: string) {
  try {
    return value && /^\d+(\.\d{0,6})?$/.test(value) ? parseUnits(value, 6) : 0n;
  } catch {
    return 0n;
  }
}

function format(value: bigint) {
  return `${Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
}
