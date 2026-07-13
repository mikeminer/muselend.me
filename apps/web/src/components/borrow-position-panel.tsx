"use client";

import {
  InterestRateModelAbi,
  MuseLendPositionManagerAbi,
  MuseLendRiskManagerAbi,
  MuseLendUSDCVaultAbi,
} from "@muselend/abis";
import {
  BPS,
  mulDivDown,
  mulDivUp,
  positionLimits,
  worstCaseDebt,
} from "@muselend/risk-engine";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  formatUnits,
  isAddress,
  maxUint256,
  parseAbi,
  parseUnits,
  type Address,
} from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from "wagmi";
import { swapQuoteResponse } from "@/lib/api-schemas";
import {
  borrowerWalletReady,
  hasSufficientTokenBalance,
  needsTokenApproval,
  quoteDeadlineIsFresh,
} from "@/lib/borrow-flow-state";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { TransactionStatus } from "@/components/transaction-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

type Props = { disclosures: string[]; acknowledgements: string[] };
type Quote = ReturnType<typeof swapQuoteResponse.parse>["quote"];
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
const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address,uint256) returns (bool)",
]);

export function BorrowPositionPanel({ disclosures, acknowledgements }: Props) {
  const t = useTranslations("BorrowPanel");
  const { address, isConnected, chainId } = useAccount();
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [advanceRate, setAdvanceRate] = useState(60);
  const [term, setTerm] = useState(30);
  const [epoch, setEpoch] = useState("1");
  const [accepted, setAccepted] = useState<boolean[]>(() =>
    acknowledgements.map(() => false),
  );
  const [quote, setQuote] = useState<Quote>();
  const [quoteFresh, setQuoteFresh] = useState(false);
  const [status, setStatus] = useState<string>();
  const [loading, setLoading] = useState(false);
  const tokenAddress = isAddress(token) ? token : undefined;
  const manager = contracts.positionManager;
  const adapter = contracts.swapAdapter;
  const risk = contracts.riskManager;
  const rateModel = contracts.interestRateModel;
  const ready = borrowerWalletReady({
    deploymentConfigured,
    contractsConfigured: Boolean(manager && adapter && risk && rateModel),
    isConnected,
    chainId,
  });
  const tokenReads = useReadContracts({
    contracts:
      tokenAddress && address && manager
        ? [
            {
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            },
            {
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "allowance",
              args: [address, manager],
            },
            { address: tokenAddress, abi: erc20Abi, functionName: "decimals" },
            { address: tokenAddress, abi: erc20Abi, functionName: "symbol" },
          ]
        : [],
    query: {
      enabled: Boolean(tokenAddress && address && manager && chainId === 84532),
    },
  });
  const tokenBalance = resultBigInt(tokenReads.data?.[0]);
  const refetchTokenReads = tokenReads.refetch;
  const allowance = resultBigInt(tokenReads.data?.[1]);
  const tokenDecimals =
    tokenReads.data?.[2]?.status === "success"
      ? (tokenReads.data[2].result as number)
      : 18;
  const tokenSymbol =
    tokenReads.data?.[3]?.status === "success"
      ? (tokenReads.data[3].result as string)
      : t("tokens");
  const amountAtomic = useMemo(
    () => safeTokenAmount(amount, tokenDecimals),
    [amount, tokenDecimals],
  );
  const configuration = useReadContract({
    address: risk,
    abi: MuseLendRiskManagerAbi,
    functionName: "getTokenConfig",
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled: ready && Boolean(tokenAddress) },
  });
  const premiumRead = useReadContract({
    address: risk,
    abi: MuseLendRiskManagerAbi,
    functionName: "termPremium",
    args: tokenAddress ? [tokenAddress, term * 86_400] : undefined,
    query: { enabled: ready && Boolean(tokenAddress), retry: false },
  });
  const feeRead = useReadContract({
    address: risk,
    abi: MuseLendRiskManagerAbi,
    functionName: "originationFeeBps",
    query: { enabled: ready },
  });
  const maxRateRead = useReadContract({
    address: rateModel,
    abi: InterestRateModelAbi,
    functionName: "maxBorrowRateRay",
    query: { enabled: ready },
  });
  const poolReads = useReadContracts({
    contracts: contracts.seniorVault
      ? [
          {
            address: contracts.seniorVault,
            abi: MuseLendUSDCVaultAbi,
            functionName: "availableCash",
          },
          {
            address: contracts.seniorVault,
            abi: MuseLendUSDCVaultAbi,
            functionName: "totalPrincipalOutstanding",
          },
        ]
      : [],
    query: { enabled: ready },
  });
  const poolCash = resultBigInt(poolReads.data?.[0]);
  const poolDebt = resultBigInt(poolReads.data?.[1]);
  const aprRead = useReadContract({
    address: rateModel,
    abi: InterestRateModelAbi,
    functionName: "borrowRate",
    args: [poolCash, poolDebt],
    query: { enabled: ready },
  });
  const config = configuration.data as RiskConfig | undefined;
  const requestedAdvanceBps = BigInt(advanceRate * 100);
  const quotedProceeds =
    quote?.kind === "sell" ? BigInt(quote.quotedAmount) : 0n;
  const minimumProceeds =
    quote?.kind === "sell" ? BigInt(quote.protectedAmount) : 0n;
  const principal = mulDivDown(minimumProceeds, requestedAdvanceBps, BPS);
  const limits =
    config && quotedProceeds > 0n
      ? positionLimits({
          saleProceeds: quotedProceeds,
          advanceRateBps: BigInt(config.advanceRateBps),
          seniorCoverageBps: BigInt(config.seniorCoverageBps),
          coverageCapBps: BigInt(config.coverageCapBps),
        })
      : undefined;
  const premiumBps =
    typeof premiumRead.data === "number" ? BigInt(premiumRead.data) : 0n;
  const feeBps = typeof feeRead.data === "number" ? BigInt(feeRead.data) : 0n;
  const premium = limits
    ? mulDivUp(limits.juniorCoverage, premiumBps, BPS)
    : 0n;
  const originationFee = mulDivUp(principal, feeBps, BPS);
  const netReceived =
    principal > premium + originationFee
      ? principal - premium - originationFee
      : 0n;
  const maxRate = typeof maxRateRead.data === "bigint" ? maxRateRead.data : 0n;
  const maximumDebt = worstCaseDebt(
    principal,
    maxRate,
    BigInt((term + 3) * 86_400),
  );
  const epochId = /^\d+$/.test(epoch) && Number(epoch) > 0 ? Number(epoch) : 0;
  const balanceSufficient = hasSufficientTokenBalance(
    amountAtomic,
    tokenBalance,
  );
  const quoteMatches = Boolean(
    quote &&
      quoteFresh &&
      quoteDeadlineIsFresh(quote.deadline) &&
      quote.kind === "sell" &&
      quote.amount === amountAtomic.toString() &&
      tokenAddress &&
      quote.adapter.toLowerCase() === adapter?.toLowerCase() &&
      quote.route.creatorToken.toLowerCase() === tokenAddress.toLowerCase(),
  );
  const formValid = Boolean(
    tokenAddress &&
      amountAtomic > 0n &&
      balanceSufficient &&
      accepted.every(Boolean) &&
      epochId > 0,
  );
  const route = quote
    ? ({
        creatorToken: quote.route.creatorToken as Address,
        usdc: quote.route.usdc as Address,
        poolId: quote.route.poolId as `0x${string}`,
        fee: quote.route.fee,
        tickSpacing: quote.route.tickSpacing,
        hook: quote.route.hook as Address,
        minHopPriceX36: BigInt(quote.route.minHopPriceX36),
      } as const)
    : undefined;
  const openParams =
    quote && tokenAddress && adapter && route
      ? ({
          creatorToken: tokenAddress,
          adapter,
          amount: amountAtomic,
          minUsdcOut: minimumProceeds,
          principal,
          term: term * 86_400,
          epochId,
          deadline: BigInt(quote.deadline),
          route,
        } as const)
      : undefined;
  const simulation = useSimulateContract({
    address: manager,
    abi: MuseLendPositionManagerAbi,
    functionName: "openPosition",
    args: openParams ? [openParams] : undefined,
    account: address,
    query: {
      enabled:
        ready &&
        formValid &&
        quoteMatches &&
        Boolean(config?.enabled) &&
        requestedAdvanceBps <= BigInt(config?.advanceRateBps ?? 0) &&
        allowance >= amountAtomic,
    },
  });
  const transaction = useWriteContract();
  const receipt = useTrackedTransaction(transaction.data);
  const busy =
    loading || transaction.isPending || receipt.status === "confirming";

  useEffect(() => {
    if (!quote) return;
    const timeout = window.setTimeout(
      () => setQuoteFresh(false),
      Math.max(0, quote.deadline * 1000 - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [quote]);
  useEffect(() => {
    if (receipt.status === "confirmed") void refetchTokenReads();
  }, [receipt.status, refetchTokenReads]);

  async function requestQuote() {
    if (!formValid) return;
    setLoading(true);
    setQuote(undefined);
    setQuoteFresh(false);
    setStatus(undefined);
    try {
      const validation = await fetch("/api/token/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chainId: 84532, token }),
      });
      const validationBody = (await validation.json()) as {
        valid?: boolean;
        reason?: string;
      };
      if (!validation.ok || !validationBody.valid)
        throw new Error(validationBody.reason ?? t("tokenRejected"));
      const response = await fetch("/api/quote/sell", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chainId: 84532,
          creatorToken: token,
          amount: amountAtomic.toString(),
          slippageBps: 100,
          deadline: Math.floor(Date.now() / 1000) + 300,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(t("quoteUnavailable"));
      const parsed = swapQuoteResponse.parse(body).quote;
      if (
        parsed.kind !== "sell" ||
        parsed.adapter.toLowerCase() !== adapter?.toLowerCase()
      )
        throw new Error(t("quoteMismatch"));
      setQuote(parsed);
      setQuoteFresh(true);
      setStatus(t("quoteReady"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("quoteFailed"));
    } finally {
      setLoading(false);
    }
  }
  function approve() {
    if (tokenAddress && manager)
      transaction.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [manager, maxUint256],
      });
  }
  function open() {
    if (simulation.data?.request) {
      transaction.writeContract(simulation.data.request);
      invalidateQuote();
    }
  }
  function invalidateQuote() {
    setQuote(undefined);
    setQuoteFresh(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="token">{t("tokenAddress")}</Label>
            <Input
              id="token"
              value={token}
              onChange={(event) => {
                setToken(event.target.value.trim());
                invalidateQuote();
              }}
              placeholder="0x…"
            />
            <p className="text-xs text-muted-foreground">{t("tokenHelp")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">{t("amount")}</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                invalidateQuote();
              }}
              placeholder="0.00"
            />
            {isConnected && tokenAddress ? (
              <p className="text-xs text-muted-foreground">
                {t("walletBalance", {
                  balance: Number(
                    formatUnits(tokenBalance, tokenDecimals),
                  ).toLocaleString(undefined, { maximumFractionDigits: 6 }),
                  symbol: tokenSymbol,
                })}
              </p>
            ) : null}
            {!balanceSufficient ? (
              <p className="text-xs text-destructive">
                {t("insufficientBalance")}
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <Label>{t("loanAmount")}</Label>
              <span className="font-mono text-muted-foreground">
                {advanceRate}%
              </span>
            </div>
            <Slider
              value={[advanceRate]}
              min={10}
              max={60}
              step={5}
              onValueChange={(value) => {
                setAdvanceRate(value[0] ?? 60);
                invalidateQuote();
              }}
              aria-label={t("loanAria")}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[7, 14, 30].map((days) => (
              <Button
                key={days}
                type="button"
                variant={days === term ? "default" : "outline"}
                onClick={() => {
                  setTerm(days);
                  invalidateQuote();
                }}
              >
                {t("days", { days })}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="epoch-id">{t("epoch")}</Label>
            <Input
              id="epoch-id"
              inputMode="numeric"
              value={epoch}
              onChange={(event) => {
                setEpoch(event.target.value);
                invalidateQuote();
              }}
            />
          </div>
          <Separator />
          <section aria-labelledby="borrow-disclosures" className="space-y-3">
            <h2 id="borrow-disclosures" className="text-sm font-medium">
              {t("disclosures")}
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {disclosures.map((text) => (
                <li key={text} className="flex gap-2">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>
          <Separator />
          <div className="space-y-4">
            {acknowledgements.map((text, index) => (
              <div key={text} className="flex items-start gap-3">
                <Checkbox
                  id={`risk-${index}`}
                  checked={accepted[index]}
                  onCheckedChange={(checked) =>
                    setAccepted((current) =>
                      current.map((value, item) =>
                        item === index ? checked === true : value,
                      ),
                    )
                  }
                />
                <Label
                  htmlFor={`risk-${index}`}
                  className="font-normal leading-5 text-muted-foreground"
                >
                  {text}
                </Label>
              </div>
            ))}
          </div>
          {!quote ? (
            <Button
              className="w-full"
              disabled={!formValid || loading}
              onClick={requestQuote}
            >
              {loading
                ? t("validating")
                : ready
                  ? t("requestQuote")
                  : t("availability")}
            </Button>
          ) : needsTokenApproval(amountAtomic, allowance) ? (
            <Button className="w-full" onClick={approve} disabled={busy}>
              {t("approve")}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={open}
              disabled={busy || !simulation.data?.request}
            >
              {t("open")}
            </Button>
          )}
          {status ? (
            <Alert>
              <AlertTitle>{t("quoteStatus")}</AlertTitle>
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          ) : null}
          {simulation.error && quote ? (
            <p className="text-sm text-destructive">{t("simulationError")}</p>
          ) : null}
          <TransactionStatus
            hash={receipt.finalHash}
            walletPending={transaction.isPending}
            confirming={receipt.status === "confirming"}
            confirmed={receipt.status === "confirmed"}
            error={transaction.error ?? receipt.error}
            replacementReason={receipt.replacementReason}
            label={t("transaction")}
          />
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("summary")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Summary
              label={t("expectedProceeds")}
              value={money(quotedProceeds)}
            />
            <Summary
              label={t("minimumProceeds")}
              value={money(minimumProceeds)}
            />
            <Summary label={t("principal")} value={money(principal)} />
            <Summary
              label={t("apr")}
              value={rayPercent(
                typeof aprRead.data === "bigint" ? aprRead.data : 0n,
              )}
            />
            <Summary label={t("fee")} value={money(originationFee)} />
            <Summary label={t("premium")} value={money(premium)} />
            <Summary label={t("net")} value={money(netReceived)} />
            <Summary
              label={t("coverageCap")}
              value={money(limits?.coverageCap ?? 0n)}
            />
            <Summary
              label={t("juniorCoverage")}
              value={money(limits?.juniorCoverage ?? 0n)}
            />
            <Summary label={t("worstDebt")} value={money(maximumDebt)} />
          </CardContent>
        </Card>
        <Alert className="border-amber-300/15 bg-amber-300/5">
          <AlertTriangle />
          <AlertTitle>{t("partialTitle")}</AlertTitle>
          <AlertDescription className="leading-5">
            {t("partialText")}
          </AlertDescription>
        </Alert>
        {!deploymentConfigured ? (
          <p className="text-sm text-muted-foreground">
            {t("deploymentMissing")}
          </p>
        ) : null}
        {deploymentConfigured && (!adapter || !rateModel) ? (
          <p className="text-sm text-muted-foreground">
            {t("integrationMissing")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function resultBigInt(
  result: { status: string; result?: unknown } | undefined,
) {
  return result?.status === "success" && typeof result.result === "bigint"
    ? result.result
    : 0n;
}
function safeTokenAmount(value: string, decimals: number) {
  try {
    return value && /^\d+(\.\d{0,18})?$/.test(value)
      ? parseUnits(value, decimals)
      : 0n;
  } catch {
    return 0n;
  }
}
function money(value: bigint) {
  return value === 0n
    ? "—"
    : `${Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
}
function rayPercent(value: bigint) {
  return value === 0n
    ? "—"
    : `${(Number(value) / 1e25).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono">{value}</span>
    </div>
  );
}
