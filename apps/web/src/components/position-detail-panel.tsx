"use client";

import { MuseLendPositionManagerAbi } from "@muselend/abis";
import { formatUnits, maxUint256, parseAbi } from "viem";
import { useTranslations } from "next-intl";
import { useAccount, useBlock, useReadContracts, useWriteContract } from "wagmi";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { TransactionStatus } from "@/components/transaction-status";
import { PositionHistory } from "@/components/position-history";
import { PositionSettlement } from "@/components/position-settlement";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PositionTuple = readonly [`0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, number, number, number, number, bigint, number];
const erc20Abi = parseAbi(["function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"]);
const stateKeys = ["stateNone", "stateOpen", "stateSettling", "stateClosed", "stateDefaulted", "statePending"] as const;

export function PositionDetailPanel({ id }: { id: bigint }) {
  const t = useTranslations("PositionDetail");
  const { address, chainId, isConnected } = useAccount();
  const manager = contracts.positionManager;
  const usdc = contracts.usdc;
  const enabled = deploymentConfigured && Boolean(manager) && Boolean(usdc) && chainId === 84532;
  const reads = useReadContracts({
    contracts: manager && usdc && address ? [
      { address: manager, abi: MuseLendPositionManagerAbi, functionName: "positions", args: [id] },
      { address: manager, abi: MuseLendPositionManagerAbi, functionName: "currentDebt", args: [id] },
      { address: usdc, abi: erc20Abi, functionName: "allowance", args: [address, manager] },
    ] : [],
    allowFailure: true,
    query: { enabled: enabled && Boolean(address) },
  });
  const position = reads.data?.[0]?.status === "success" ? reads.data[0].result as unknown as PositionTuple : undefined;
  const debt = reads.data?.[1]?.status === "success" ? reads.data[1].result as bigint : 0n;
  const allowance = reads.data?.[2]?.status === "success" ? reads.data[2].result as bigint : 0n;
  const transaction = useWriteContract();
  const receipt = useTrackedTransaction(transaction.data);
  const block = useBlock({ query: { enabled } });
  const busy = transaction.isPending || receipt.status === "confirming";
  const ownsPosition = Boolean(position && address && position[0].toLowerCase() === address.toLowerCase());
  const expired = Boolean(position && block.data && block.data.timestamp > BigInt(position[12] + 3 * 24 * 60 * 60));

  function approve() { if (usdc && manager) transaction.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [manager, maxUint256] }); }
  function repay() { if (manager) transaction.writeContract({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "repay", args: [id] }); }
  function settle() { if (manager) transaction.writeContract({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "settleExpiredPosition", args: [id] }); }
  function markPending() { if (manager) transaction.writeContract({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "markSettlementPending", args: [id] }); }

  if (!deploymentConfigured) return <Alert><AlertTitle>{t("contractsTitle")}</AlertTitle><AlertDescription>{t("contractsText")}</AlertDescription></Alert>;
  if (!isConnected) return <Alert><AlertTitle>{t("connectTitle")}</AlertTitle><AlertDescription>{t("connectText")}</AlertDescription></Alert>;
  if (chainId !== 84532) return <Alert><AlertTitle>{t("networkTitle")}</AlertTitle><AlertDescription>{t("networkText")}</AlertDescription></Alert>;
  if (reads.isLoading) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (!position || position[0] === "0x0000000000000000000000000000000000000000") return <Alert><AlertTitle>{t("missingTitle")}</AlertTitle><AlertDescription>{t("missingText")}</AlertDescription></Alert>;

  const stateCode = position[16];
  const state = t(stateKeys[stateCode] ?? "stateUnknown");
  const active = stateCode === 1 || stateCode === 5;
  return <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>{t("accounting")}</CardTitle><Badge variant="outline">{state}</Badge></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
      <Metric label={t("owner")} value={short(position[0])} />
      <Metric label={t("creatorToken")} value={short(position[1])} />
      <Metric label={t("syntheticAmount")} value={token(position[3])} />
      <Metric label={t("saleProceeds")} value={money(position[4])} />
      <Metric label={t("principal")} value={money(position[5])} />
      <Metric label={t("debt")} value={money(debt)} />
      <Metric label={t("coverageCap")} value={money(position[7])} />
      <Metric label={t("juniorCoverage")} value={money(position[8])} />
      <Metric label={t("maturity")} value={new Date(position[12] * 1000).toLocaleString()} />
      <Metric label={t("epoch")} value={position[14].toString()} />
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{t("actions")}</CardTitle></CardHeader><CardContent className="space-y-3">
      {active && ownsPosition && debt > 0n ? allowance < debt
        ? <Button className="w-full" onClick={approve} disabled={busy}>{busy ? t("confirming") : t("approve", { amount: money(debt) })}</Button>
        : <Button className="w-full" onClick={repay} disabled={busy}>{busy ? t("confirming") : t("repay", { amount: money(debt) })}</Button> : null}
      {active && expired ? <Button className="w-full" variant="destructive" onClick={settle} disabled={busy}>{busy ? t("confirming") : t("settle")}</Button> : null}
      {stateCode === 1 && ownsPosition ? <Button className="w-full" variant="outline" onClick={markPending} disabled={busy}>{busy ? t("confirming") : t("markPending")}</Button> : null}
      <p className="text-sm text-muted-foreground">{t("actionHelp")}</p>
      <TransactionStatus hash={receipt.finalHash} walletPending={transaction.isPending} confirming={receipt.status === "confirming"} confirmed={receipt.status === "confirmed"} error={transaction.error ?? receipt.error} replacementReason={receipt.replacementReason} label={t("transaction")} />
    </CardContent></Card>
    {active && ownsPosition ? <PositionSettlement id={id} creatorToken={position[1]} adapter={position[2]} syntheticAmount={position[3]} coverageCap={position[7]} debt={debt} allowance={allowance} enabled={enabled && !busy} /> : null}
    <PositionHistory id={id} enabled={enabled} />
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 break-all font-mono">{value}</p></div>; }
function money(value: bigint) { return `${Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`; }
function token(value: bigint) { return Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 }); }
function short(value: string) { return `${value.slice(0, 8)}…${value.slice(-6)}`; }
