"use client";

import { MuseLendPositionManagerAbi, MuseLendRiskManagerAbi } from "@muselend/abis";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { encodeFunctionData, isAddress, keccak256, parseAbi, parseUnits, toBytes, zeroHash, type Address, type Hex } from "viem";
import { useAccount, useReadContract, useSimulateContract, useWriteContract } from "wagmi";
import { contracts } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { TransactionStatus } from "@/components/transaction-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const timelockAbi = parseAbi([
  "function getMinDelay() view returns (uint256)",
  "function PROPOSER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32,address) view returns (bool)",
  "function hashOperation(address,uint256,bytes,bytes32,bytes32) pure returns (bytes32)",
  "function isOperationPending(bytes32) view returns (bool)",
  "function schedule(address,uint256,bytes,bytes32,bytes32,uint256)",
]);
type Action = "caps" | "fee" | "adapter" | "market";
export type TokenConfig = { enabled: boolean; canonicalZoraVersion: number; riskTier: number; advanceRateBps: number; seniorCoverageBps: number; coverageCapBps: number; maximumPriceImpactBps: number; minimumPositionUsdc: bigint; maximumPositionUsdc: bigint; maximumTokenExposureUsdc: bigint; maximumWalletExposureUsdc: bigint };

export function GovernanceProposal() {
  const t = useTranslations("Admin");
  const { address } = useAccount();
  const [action, setAction] = useState<Action>("caps");
  const [seniorCap, setSeniorCap] = useState("250000");
  const [juniorCap, setJuniorCap] = useState("250000");
  const [feeBps, setFeeBps] = useState("50");
  const [adapter, setAdapter] = useState(contracts.swapAdapter ?? "");
  const [adapterAllowed, setAdapterAllowed] = useState(true);
  const [marketEnabled, setMarketEnabled] = useState(true);
  const [label, setLabel] = useState("");
  const timelock = contracts.timelock;
  const risk = contracts.riskManager;
  const manager = contracts.positionManager;
  const token = contracts.creatorToken;
  const caps = useMemo(() => [safeUsdc(seniorCap), safeUsdc(juniorCap)] as const, [seniorCap, juniorCap]);
  const fee = /^\d+$/.test(feeBps) ? Number(feeBps) : -1;
  const adapterAddress = isAddress(adapter) ? adapter : undefined;
  const delay = useReadContract({ address: timelock, abi: timelockAbi, functionName: "getMinDelay", query: { enabled: Boolean(timelock) } });
  const proposerRole = useReadContract({ address: timelock, abi: timelockAbi, functionName: "PROPOSER_ROLE", query: { enabled: Boolean(timelock) } });
  const proposer = useReadContract({ address: timelock, abi: timelockAbi, functionName: "hasRole", args: proposerRole.data && address ? [proposerRole.data, address] : undefined, query: { enabled: Boolean(timelock && proposerRole.data && address) } });
  const tokenConfigRead = useReadContract({ address: risk, abi: MuseLendRiskManagerAbi, functionName: "getTokenConfig", args: token ? [token] : undefined, query: { enabled: Boolean(risk && token) } });
  const tokenConfig = tokenConfigRead.data as TokenConfig | undefined;
  const nextTokenConfig = tokenConfig ? { ...tokenConfig, enabled: marketEnabled } : undefined;
  const capsSimulation = useSimulateContract({ address: risk, abi: MuseLendRiskManagerAbi, functionName: "setGlobalCaps", args: caps, account: timelock, query: { enabled: action === "caps" && caps[0] > 0n && caps[1] > 0n && Boolean(timelock) } });
  const feeSimulation = useSimulateContract({ address: risk, abi: MuseLendRiskManagerAbi, functionName: "setOriginationFee", args: fee >= 0 ? [fee] : undefined, account: timelock, query: { enabled: action === "fee" && fee >= 0 && fee <= 200 && Boolean(timelock) } });
  const adapterSimulation = useSimulateContract({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "setAdapter", args: adapterAddress ? [adapterAddress, adapterAllowed] : undefined, account: timelock, query: { enabled: action === "adapter" && Boolean(adapterAddress && timelock) } });
  const marketSimulation = useSimulateContract({ address: risk, abi: MuseLendRiskManagerAbi, functionName: "setTokenConfig", args: token && nextTokenConfig ? [token, nextTokenConfig] : undefined, account: timelock, query: { enabled: action === "market" && Boolean(token && nextTokenConfig && timelock) } });
  const directReady = action === "caps" ? Boolean(capsSimulation.data?.request) : action === "fee" ? Boolean(feeSimulation.data?.request) : action === "adapter" ? Boolean(adapterSimulation.data?.request) : Boolean(marketSimulation.data?.request);
  const target = action === "adapter" ? manager : risk;
  const data = proposalData(action, caps, fee, adapterAddress, adapterAllowed, token, nextTokenConfig);
  const salt = label.trim().length >= 4 ? keccak256(toBytes(`muselend:${label.trim()}`)) : undefined;
  const operationId = useReadContract({ address: timelock, abi: timelockAbi, functionName: "hashOperation", args: target && data && salt ? [target, 0n, data, zeroHash, salt] : undefined, query: { enabled: Boolean(timelock && target && data && salt) } });
  const pending = useReadContract({ address: timelock, abi: timelockAbi, functionName: "isOperationPending", args: operationId.data ? [operationId.data] : undefined, query: { enabled: Boolean(timelock && operationId.data) } });
  const scheduleSimulation = useSimulateContract({ address: timelock, abi: timelockAbi, functionName: "schedule", args: target && data && salt && typeof delay.data === "bigint" ? [target, 0n, data, zeroHash, salt, delay.data] : undefined, account: address, query: { enabled: directReady && proposer.data === true && pending.data !== true } });
  const transaction = useWriteContract();
  const receipt = useTrackedTransaction(transaction.data);
  const busy = transaction.isPending || receipt.status === "confirming";

  return <Card><CardHeader><CardTitle>{t("proposalTitle")}</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">{t("proposalHelp")}</p>
    <div className="space-y-2"><Label htmlFor="proposal-action">{t("action")}</Label><select id="proposal-action" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" value={action} onChange={(event) => setAction(event.target.value as Action)}><option value="caps">{t("actionCaps")}</option><option value="fee">{t("actionFee")}</option><option value="adapter">{t("actionAdapter")}</option><option value="market">{t("actionMarket")}</option></select></div>
    {action === "caps" ? <div className="grid gap-3 sm:grid-cols-2"><Field id="senior-cap" label={t("seniorCapField")} value={seniorCap} onChange={setSeniorCap} /><Field id="junior-cap" label={t("juniorCapField")} value={juniorCap} onChange={setJuniorCap} /></div> : null}
    {action === "fee" ? <Field id="fee-bps" label={t("feeField")} value={feeBps} onChange={setFeeBps} /> : null}
    {action === "adapter" ? <><Field id="adapter-address" label={t("adapterAddress")} value={adapter} onChange={setAdapter} /><div className="flex items-center gap-3"><Checkbox id="adapter-allowed" checked={adapterAllowed} onCheckedChange={(checked) => setAdapterAllowed(checked === true)} /><Label htmlFor="adapter-allowed">{t("adapterAllowed")}</Label></div></> : null}
    {action === "market" ? <div className="space-y-3 rounded-lg border p-3"><div className="flex items-center gap-3"><Checkbox id="market-enabled" checked={marketEnabled} onCheckedChange={(checked) => setMarketEnabled(checked === true)} /><Label htmlFor="market-enabled">{t("creatorMarketEnabled")}</Label></div><p className="text-xs text-muted-foreground">{t("marketHelp")}</p></div> : null}
    <Field id="proposal-label" label={t("proposalLabel")} value={label} onChange={setLabel} />
    <div className="space-y-2 rounded-lg border p-3 font-mono text-xs"><p>{t("timelock")}: {timelock ?? "—"}</p><p>{typeof delay.data === "bigint" ? t("delay", { hours: (delay.data / 3600n).toString() }) : t("delay", { hours: "—" })}</p><p>{t("target", { target: target ?? "—" })}</p><p className="break-all">{t("operation", { operation: operationId.data ?? "—" })}</p><p>{t("directSimulation", { status: directReady ? t("passed") : t("notReady") })}</p><p>{t("proposer", { status: proposer.data === true ? t("yes") : t("no") })}</p><p>{t("pending", { status: pending.data === true ? t("yes") : t("no") })}</p></div>
    <Button onClick={() => scheduleSimulation.data?.request && transaction.writeContract(scheduleSimulation.data.request)} disabled={busy || !scheduleSimulation.data?.request}>{busy ? t("confirming") : t("schedule")}</Button>
    <TransactionStatus hash={receipt.finalHash} walletPending={transaction.isPending} confirming={receipt.status === "confirming"} confirmed={receipt.status === "confirmed"} error={transaction.error ?? receipt.error} replacementReason={receipt.replacementReason} label={t("scheduleTransaction")} />
  </CardContent></Card>;
}

export function proposalData(action: Action, caps: readonly [bigint, bigint], fee: number, adapter: Address | undefined, allowed: boolean, token: Address | undefined, tokenConfig: TokenConfig | undefined): Hex | undefined {
  if (action === "caps" && caps[0] > 0n && caps[1] > 0n) return encodeFunctionData({ abi: MuseLendRiskManagerAbi, functionName: "setGlobalCaps", args: caps });
  if (action === "fee" && fee >= 0 && fee <= 200) return encodeFunctionData({ abi: MuseLendRiskManagerAbi, functionName: "setOriginationFee", args: [fee] });
  if (action === "adapter" && adapter) return encodeFunctionData({ abi: MuseLendPositionManagerAbi, functionName: "setAdapter", args: [adapter, allowed] });
  if (action === "market" && token && tokenConfig) return encodeFunctionData({ abi: MuseLendRiskManagerAbi, functionName: "setTokenConfig", args: [token, tokenConfig] });
  return undefined;
}
function safeUsdc(value: string) { try { return /^\d+(\.\d{0,6})?$/.test(value) ? parseUnits(value, 6) : 0n; } catch { return 0n; } }
function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
