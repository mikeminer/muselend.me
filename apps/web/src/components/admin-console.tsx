"use client";

import { MuseLendPositionManagerAbi, MuseLendRiskManagerAbi } from "@muselend/abis";
import { keccak256, toBytes } from "viem";
import { useTranslations } from "next-intl";
import {
  useAccount,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from "wagmi";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { TransactionStatus } from "@/components/transaction-status";
import { GovernanceProposal } from "@/components/governance-proposal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const riskAdminRole = keccak256(toBytes("RISK_ADMIN_ROLE"));
const pauseGuardianRole = keccak256(toBytes("PAUSE_GUARDIAN_ROLE"));
const adapterAdminRole = keccak256(toBytes("ADAPTER_ADMIN_ROLE"));
type TokenConfig = { enabled: boolean; canonicalZoraVersion: number; riskTier: number; advanceRateBps: number; seniorCoverageBps: number; coverageCapBps: number; maximumPriceImpactBps: number; minimumPositionUsdc: bigint; maximumPositionUsdc: bigint; maximumTokenExposureUsdc: bigint; maximumWalletExposureUsdc: bigint };

export function AdminConsole() {
  const t = useTranslations("Admin");
  const { address, chainId, isConnected } = useAccount();
  const riskManager = contracts.riskManager;
  const manager = contracts.positionManager;
  const token = contracts.creatorToken;
  const adapter = contracts.swapAdapter;
  const timelock = contracts.timelock;
  const enabled = deploymentConfigured && Boolean(address && riskManager && manager && token && adapter && timelock) && chainId === 84532;
  const reads = useReadContracts({
    contracts: enabled && address && riskManager && manager && token && adapter && timelock ? [
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "hasRole", args: [riskAdminRole, address] },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "hasRole", args: [pauseGuardianRole, address] },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "openingsPaused" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "depositsPaused" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "mainnetEnabled" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "globalSeniorDebtCap" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "globalJuniorCoverageCap" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "originationFeeBps" },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "hasRole", args: [riskAdminRole, timelock] },
      { address: manager, abi: MuseLendPositionManagerAbi, functionName: "hasRole", args: [adapterAdminRole, timelock] },
      { address: manager, abi: MuseLendPositionManagerAbi, functionName: "allowedAdapter", args: [adapter] },
      { address: riskManager, abi: MuseLendRiskManagerAbi, functionName: "getTokenConfig", args: [token] },
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
  const timelockRiskAdmin = value(8) === true;
  const timelockAdapterAdmin = value(9) === true;
  const adapterAllowed = value(10) === true;
  const tokenConfig = value(11) as TokenConfig | undefined;
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

  if (!deploymentConfigured) return <Alert><AlertTitle>{t("deploymentTitle")}</AlertTitle><AlertDescription>{t("deploymentText")}</AlertDescription></Alert>;
  if (!manager || !token || !adapter || !timelock) return <Alert><AlertTitle>{t("configTitle")}</AlertTitle><AlertDescription>{t("configText")}</AlertDescription></Alert>;
  if (!isConnected) return <Alert><AlertTitle>{t("connectTitle")}</AlertTitle><AlertDescription>{t("connectText")}</AlertDescription></Alert>;
  if (chainId !== 84532) return <Alert><AlertTitle>{t("networkTitle")}</AlertTitle><AlertDescription>{t("networkText")}</AlertDescription></Alert>;

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3">
      <StatusCard title={t("openings")} active={!openingsPaused} activeLabel={t("enabled")} inactiveLabel={t("disabled")} />
      <StatusCard title={t("deposits")} active={!depositsPaused} activeLabel={t("enabled")} inactiveLabel={t("disabled")} />
      <StatusCard title={t("mainnet")} active={mainnetEnabled} activeLabel={t("enabled")} inactiveLabel={t("disabled")} danger />
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{t("roles")}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <Role label={t("walletRiskAdmin")} active={isRiskAdmin} activeLabel={t("granted")} inactiveLabel={t("notGranted")} />
        <Role label={t("guardian")} active={isGuardian} activeLabel={t("granted")} inactiveLabel={t("notGranted")} />
        <Role label={t("timelockRiskAdmin")} active={timelockRiskAdmin} activeLabel={t("granted")} inactiveLabel={t("notGranted")} />
        <Role label={t("timelockAdapterAdmin")} active={timelockAdapterAdmin} activeLabel={t("granted")} inactiveLabel={t("notGranted")} />
        {!isRiskAdmin && !isGuardian ? <p className="text-muted-foreground">{t("readOnly")}</p> : null}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{t("envelope")}</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <Row label={t("seniorCap")} value={`${formatUsdc(seniorCap)} USDC`} />
        <Row label={t("juniorCap")} value={`${formatUsdc(juniorCap)} USDC`} />
        <Row label={t("fee")} value={`${feeBps / 100}%`} />
        <Row label={t("timelock")} value={short(contracts.timelock, t("notConfigured"))} />
        <Row label={t("adapter")} value={`${short(adapter, t("notConfigured"))} · ${adapterAllowed ? t("allowed") : t("blocked")}`} />
        <Row label={t("market")} value={tokenConfig?.enabled ? t("marketEnabled", { tier: tokenConfig.riskTier }) : t("disabled")} />
        <Row label={t("advance")} value={tokenConfig ? `${bps(tokenConfig.advanceRateBps)} / ${bps(tokenConfig.seniorCoverageBps)} / ${bps(tokenConfig.coverageCapBps)}` : "—"} />
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>{t("emergency")}</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("simulationHelp")}</p>
      {!openingsPaused && isGuardian ? <Button variant="destructive" disabled={!pauseSimulation.data?.request || busy} onClick={() => pauseSimulation.data?.request && transaction.writeContract(pauseSimulation.data.request)}>{busy ? t("confirming") : t("pause")}</Button> : null}
      {openingsPaused && isRiskAdmin ? <Button disabled={!unpauseSimulation.data?.request || busy} onClick={() => unpauseSimulation.data?.request && transaction.writeContract(unpauseSimulation.data.request)}>{busy ? t("confirming") : t("unpause")}</Button> : null}
      <TransactionStatus hash={receipt.finalHash} walletPending={transaction.isPending} confirming={receipt.status === "confirming"} confirmed={receipt.status === "confirmed"} error={transaction.error ?? receipt.error} replacementReason={receipt.replacementReason} label={t("transaction")} />
    </CardContent></Card>
    <GovernanceProposal />
  </div>;
}

function StatusCard({ title, active, activeLabel, inactiveLabel, danger = false }: { title: string; active: boolean; activeLabel: string; inactiveLabel: string; danger?: boolean }) { return <Card><CardContent className="flex items-center justify-between pt-6"><span>{title}</span><Badge variant={active && danger ? "destructive" : "outline"}>{active ? activeLabel : inactiveLabel}</Badge></CardContent></Card>; }
function Role({ label, active, activeLabel, inactiveLabel }: { label: string; active: boolean; activeLabel: string; inactiveLabel: string }) { return <div className="flex items-center justify-between"><span>{label}</span><Badge variant="outline">{active ? activeLabel : inactiveLabel}</Badge></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="break-all text-right font-mono">{value}</span></div>; }
function formatUsdc(value: bigint) { return (Number(value) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function bps(value: number) { return `${(value / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`; }
function short(value: string | undefined, fallback: string) { return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : fallback; }
