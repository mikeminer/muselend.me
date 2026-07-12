"use client";

import { MuseLendPositionManagerAbi, MuseLendRiskManagerAbi } from "@muselend/abis";
import { formatUnits, parseAbi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const metadataAbi = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)"]);
type RiskConfig = {
  enabled: boolean;
  canonicalZoraVersion: number;
  riskTier: number;
  advanceRateBps: number;
  seniorCoverageBps: number;
  coverageCapBps: number;
  maximumPriceImpactBps: number;
  minimumPositionUsdc: bigint;
  maximumPositionUsdc: bigint;
  maximumTokenExposureUsdc: bigint;
  maximumWalletExposureUsdc: bigint;
};

export function MarketsPanel() {
  const { chainId } = useAccount();
  const token = contracts.creatorToken;
  const risk = contracts.riskManager;
  const manager = contracts.positionManager;
  const enabled = deploymentConfigured && chainId === 84532 && Boolean(token && risk && manager);
  const name = useReadContract({ address: token, abi: metadataAbi, functionName: "name", query: { enabled } });
  const symbol = useReadContract({ address: token, abi: metadataAbi, functionName: "symbol", query: { enabled } });
  const configuration = useReadContract({ address: risk, abi: MuseLendRiskManagerAbi, functionName: "getTokenConfig", args: token ? [token] : undefined, query: { enabled } });
  const exposureRead = useReadContract({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "tokenExposure", args: token ? [token] : undefined, query: { enabled } });
  const term7 = useReadContract({ address: risk, abi: MuseLendRiskManagerAbi, functionName: "termPremium", args: token ? [token, 7 * 86_400] : undefined, query: { enabled, retry: false } });
  const term14 = useReadContract({ address: risk, abi: MuseLendRiskManagerAbi, functionName: "termPremium", args: token ? [token, 14 * 86_400] : undefined, query: { enabled, retry: false } });
  const term30 = useReadContract({ address: risk, abi: MuseLendRiskManagerAbi, functionName: "termPremium", args: token ? [token, 30 * 86_400] : undefined, query: { enabled, retry: false } });
  const config = configuration.data as RiskConfig | undefined;
  const exposure = exposureRead.data ?? 0n;
  const terms = [[7, term7.data], [14, term14.data], [30, term30.data]].flatMap(([days, premium]) => typeof premium === "number" ? [{ days: days as number, premium }] : []);

  if (!deploymentConfigured) return <EmptyState title="No testnet deployment configured" text="Markets appear only after a verified Creator Token and RiskManager are published from the deployment manifest." />;
  if (chainId !== 84532) return <EmptyState title="Switch to Base Sepolia" text="Mainnet market configuration remains disabled." />;
  if (configuration.isLoading || exposureRead.isLoading) return <p className="text-sm text-muted-foreground">Reading market configuration from Base Sepolia…</p>;
  if (!config?.enabled) return <EmptyState title="Market disabled" text="The configured Creator Token is not enabled by on-chain governance." />;

  return <Card>
    <CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>{name.data ?? "Creator Token"}</CardTitle><p className="mt-1 font-mono text-sm text-muted-foreground">{symbol.data ?? "—"} · {short(token)}</p></div><Badge variant="outline">Risk tier {config.riskTier}</Badge></CardHeader>
    <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Current exposure" value={money(exposure)} detail={`of ${money(config.maximumTokenExposureUsdc)}`} />
      <Metric label="Position range" value={`${money(config.minimumPositionUsdc)}–${money(config.maximumPositionUsdc)}`} detail="Realized sale proceeds" />
      <Metric label="Advance / senior coverage" value={`${bps(config.advanceRateBps)} / ${bps(config.seniorCoverageBps)}`} detail={`Synthetic cap ${bps(config.coverageCapBps)}`} />
      <Metric label="Allowed terms" value={terms.length ? terms.map((term) => `${term.days}d`).join(" · ") : "None"} detail={terms.map((term) => `${term.days}d premium ${bps(term.premium)}`).join(" · ")} />
      <Metric label="Max price impact" value={bps(config.maximumPriceImpactBps)} detail={`Canonical Zora version ${config.canonicalZoraVersion}`} />
      <Metric label="Per-wallet exposure" value={money(config.maximumWalletExposureUsdc)} detail="Hard on-chain cap" />
    </CardContent>
  </Card>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-mono">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }
function money(value: bigint) { return `${Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`; }
function bps(value: number) { return `${(value / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`; }
function short(value: string | undefined) { return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : ""; }
