"use client";

import { MuseLendUSDCVaultAbi } from "@muselend/abis";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, maxUint256, parseAbi, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from "wagmi";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { MetricCard } from "@/components/metric-card";
import { TransactionStatus } from "@/components/transaction-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

export function SeniorVaultPanel() {
  const { address, chainId, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [queueShares, setQueueShares] = useState("");
  const enabled = deploymentConfigured && Boolean(address) && chainId === 84532;
  const vault = contracts.seniorVault;
  const usdc = contracts.usdc;
  const reads = useReadContracts({
    contracts:
      enabled && address && vault && usdc
        ? [
            { address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [address] },
            { address: usdc, abi: erc20Abi, functionName: "allowance", args: [address, vault] },
            { address: vault, abi: MuseLendUSDCVaultAbi, functionName: "balanceOf", args: [address] },
            { address: vault, abi: MuseLendUSDCVaultAbi, functionName: "availableCash" },
            { address: vault, abi: MuseLendUSDCVaultAbi, functionName: "totalAssets" },
            { address: vault, abi: MuseLendUSDCVaultAbi, functionName: "totalPrincipalOutstanding" },
            { address: vault, abi: MuseLendUSDCVaultAbi, functionName: "maxWithdraw", args: [address] },
          ]
        : [],
    query: { enabled },
  });
  const values = reads.data?.map((result) => (result.status === "success" ? result.result : 0n));
  const refetchReads = reads.refetch;
  const [walletBalance = 0n, allowance = 0n, shares = 0n, cash = 0n, totalAssets = 0n, debt = 0n, maxWithdraw = 0n] =
    (values ?? []) as bigint[];
  const parsedAmount = useMemo(() => safeParse(amount), [amount]);
  const parsedShares = useMemo(() => safeParse(queueShares), [queueShares]);
  const nextRequest = useReadContract({ address: vault, abi: MuseLendUSDCVaultAbi, functionName: "nextRequestToProcess", query: { enabled } });
  const queuedRequest = useReadContract({ address: vault, abi: MuseLendUSDCVaultAbi, functionName: "withdrawalRequests", args: typeof nextRequest.data === "bigint" ? [nextRequest.data] : undefined, query: { enabled: enabled && typeof nextRequest.data === "bigint" } });
  const queued = queuedRequest.data as readonly [`0x${string}`, `0x${string}`, bigint, boolean] | undefined;
  const queuedAssets = useReadContract({ address: vault, abi: MuseLendUSDCVaultAbi, functionName: "previewRedeem", args: queued ? [queued[2]] : undefined, query: { enabled: enabled && Boolean(queued && !queued[3]) } });
  const refetchNextRequest = nextRequest.refetch;
  const refetchQueuedRequest = queuedRequest.refetch;
  const refetchQueuedAssets = queuedAssets.refetch;
  const approveSimulation = useSimulateContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: vault ? [vault, maxUint256] : undefined, account: address, query: { enabled: enabled && parsedAmount > allowance } });
  const depositSimulation = useSimulateContract({ address: vault, abi: MuseLendUSDCVaultAbi, functionName: "deposit", args: address ? [parsedAmount, address] : undefined, account: address, query: { enabled: enabled && parsedAmount > 0n && parsedAmount <= walletBalance && allowance >= parsedAmount } });
  const withdrawSimulation = useSimulateContract({ address: vault, abi: MuseLendUSDCVaultAbi, functionName: "withdraw", args: address ? [parsedAmount, address, address] : undefined, account: address, query: { enabled: enabled && parsedAmount > 0n && parsedAmount <= maxWithdraw } });
  const queueSimulation = useSimulateContract({ address: vault, abi: MuseLendUSDCVaultAbi, functionName: "requestRedeem", args: address ? [parsedShares, address] : undefined, account: address, query: { enabled: enabled && parsedShares > 0n && parsedShares <= shares } });
  const claimSimulation = useSimulateContract({ address: vault, abi: MuseLendUSDCVaultAbi, functionName: "claimNextWithdrawal", account: address, query: { enabled: enabled && Boolean(queued && !queued[3]) } });
  const transaction = useWriteContract();
  const receipt = useTrackedTransaction(transaction.data);
  const busy = transaction.isPending || receipt.status === "confirming";

  useEffect(() => {
    if (receipt.status === "confirmed") void Promise.all([refetchReads(), refetchNextRequest(), refetchQueuedRequest(), refetchQueuedAssets()]);
  }, [receipt.status, refetchReads, refetchNextRequest, refetchQueuedRequest, refetchQueuedAssets]);
  const approve = () => { if (approveSimulation.data?.request) transaction.writeContract(approveSimulation.data.request); };
  const deposit = () => { if (depositSimulation.data?.request) transaction.writeContract(depositSimulation.data.request); };
  const withdraw = () => { if (withdrawSimulation.data?.request) transaction.writeContract(withdrawSimulation.data.request); };
  const queue = () => { if (queueSimulation.data?.request) transaction.writeContract(queueSimulation.data.request); };
  const claim = () => { if (claimSimulation.data?.request) transaction.writeContract(claimSimulation.data.request); };

  const actionDisabled = !enabled || !parsedAmount || parsedAmount <= 0n || busy;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Wallet USDC" value={format(walletBalance)} detail="Native Base Sepolia USDC" />
        <MetricCard label="Vault shares" value={format(shares)} detail="ERC-4626 balance" />
        <MetricCard label="Available" value={format(cash)} detail="Immediately liquid" />
        <MetricCard label="Outstanding debt" value={format(debt)} detail={`${format(totalAssets)} total assets`} />
      </div>
      {!deploymentConfigured ? (
        <Alert className="mt-6 border-amber-300/20 bg-amber-300/5">
          <AlertTitle>Base Sepolia deployment not configured</AlertTitle>
          <AlertDescription>No transaction is enabled until verified contract addresses are published.</AlertDescription>
        </Alert>
      ) : null}
      <Tabs defaultValue="deposit" className="mt-8">
        <TabsList>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>
        <TabsContent value="deposit">
          <ActionCard title="Deposit USDC">
            <Label htmlFor="lend-amount">Amount</Label>
            <Input
              id="lend-amount"
              inputMode="decimal"
              placeholder="0.00 USDC"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={!enabled}
            />
            {parsedAmount && allowance < parsedAmount ? (
              <Button className="w-full" onClick={approve} disabled={actionDisabled || !approveSimulation.data?.request}>
                {busy ? "Confirming…" : "Approve USDC"}
              </Button>
            ) : (
              <Button className="w-full" onClick={deposit} disabled={actionDisabled || !depositSimulation.data?.request}>
                {busy ? "Confirming…" : "Deposit"}
              </Button>
            )}
          </ActionCard>
        </TabsContent>
        <TabsContent value="withdraw">
          <ActionCard title="Withdraw available liquidity">
            <p className="text-sm text-muted-foreground">Immediately withdrawable: {format(maxWithdraw)}</p>
            <Label htmlFor="withdraw-amount">Assets</Label>
            <Input id="withdraw-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!enabled} />
            <Button className="w-full" onClick={withdraw} disabled={actionDisabled || !withdrawSimulation.data?.request}>
              {busy ? "Confirming…" : "Withdraw"}
            </Button>
          </ActionCard>
        </TabsContent>
        <TabsContent value="queue">
          <ActionCard title="Queue share redemption">
            <p className="text-sm text-muted-foreground">Queueing transfers shares into FIFO escrow until cash returns.</p>
            <Label htmlFor="queue-shares">Shares</Label>
            <Input id="queue-shares" inputMode="decimal" value={queueShares} onChange={(event) => setQueueShares(event.target.value)} disabled={!enabled} />
            <Button className="w-full" onClick={queue} disabled={!enabled || busy || !queueSimulation.data?.request}>
              {busy ? "Confirming…" : "Enter withdrawal queue"}
            </Button>
            <div className="rounded-lg border p-3 text-sm text-muted-foreground">
              <p>Next FIFO request: {typeof nextRequest.data === "bigint" ? `#${nextRequest.data}` : "—"}</p>
              <p>Receiver: {queued ? `${queued[1].slice(0, 8)}…${queued[1].slice(-6)}` : "No pending request"}</p>
              <p>Estimated assets: {typeof queuedAssets.data === "bigint" ? format(queuedAssets.data) : "—"}</p>
            </div>
            <Button className="w-full" variant="outline" onClick={claim} disabled={busy || !claimSimulation.data?.request}>Claim next FIFO request</Button>
          </ActionCard>
        </TabsContent>
      </Tabs>
      <TransactionStatus hash={receipt.finalHash} walletPending={transaction.isPending} confirming={receipt.status === "confirming"} confirmed={receipt.status === "confirmed"} error={transaction.error ?? receipt.error} replacementReason={receipt.replacementReason} label="Vault transaction" />
      {!isConnected ? <p className="mt-4 text-sm text-muted-foreground">Connect a wallet to load balances and transact.</p> : null}
      {isConnected && chainId !== 84532 ? <p className="mt-4 text-sm text-amber-200">Switch to Base Sepolia.</p> : null}
    </>
  );
}

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-3 max-w-xl">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
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
