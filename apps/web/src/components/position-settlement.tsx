"use client";

import { MuseLendPositionManagerAbi } from "@muselend/abis";
import { useEffect, useState } from "react";
import { formatUnits, maxUint256, parseAbi, parseUnits, type Address } from "viem";
import { useAccount, useSimulateContract, useWriteContract } from "wagmi";
import { buyQuoteResponse } from "@/lib/api-schemas";
import { contracts } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { TransactionStatus } from "@/components/transaction-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)"]);
type Quote = ReturnType<typeof buyQuoteResponse.parse>["quote"];

type Props = {
  id: bigint;
  creatorToken: Address;
  adapter: Address;
  syntheticAmount: bigint;
  coverageCap: bigint;
  debt: bigint;
  allowance: bigint;
  enabled: boolean;
};

export function PositionSettlement(props: Props) {
  const { address } = useAccount();
  const [mode, setMode] = useState<"full" | "capped">("full");
  const [topUp, setTopUp] = useState("0");
  const [quote, setQuote] = useState<Quote>();
  const [quoteFresh, setQuoteFresh] = useState(false);
  const [quoteError, setQuoteError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const manager = contracts.positionManager;
  const usdc = contracts.usdc;
  const topUpAtomic = safeUsdc(topUp);
  const requiredTopUp = quote?.kind === "buy-exact-output" ? maximum(BigInt(quote.protectedAmount) - props.coverageCap, 0n) : 0n;
  const requiredAllowance = props.debt + (mode === "full" ? topUpAtomic : 0n);
  const route = quote ? { creatorToken: quote.route.creatorToken as Address, usdc: quote.route.usdc as Address, poolId: quote.route.poolId as `0x${string}`, fee: quote.route.fee, tickSpacing: quote.route.tickSpacing, hook: quote.route.hook as Address, minHopPriceX36: BigInt(quote.route.minHopPriceX36) } as const : undefined;
  const expectedKind = mode === "full" ? "buy-exact-output" : "buy-exact-input";
  const expectedAmount = (mode === "full" ? props.syntheticAmount : props.coverageCap).toString();
  const quoteMatches = Boolean(quote && quoteFresh && usdc && quote.kind === expectedKind && quote.amount === expectedAmount && quote.adapter.toLowerCase() === props.adapter.toLowerCase() && quote.route.creatorToken.toLowerCase() === props.creatorToken.toLowerCase() && quote.route.usdc.toLowerCase() === usdc.toLowerCase());
  const fullSimulation = useSimulateContract({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "closeFull", args: route ? [props.id, topUpAtomic, BigInt(quote!.deadline), route] : undefined, account: address, query: { enabled: props.enabled && mode === "full" && quoteMatches && topUpAtomic >= requiredTopUp && props.allowance >= requiredAllowance } });
  const cappedSimulation = useSimulateContract({ address: manager, abi: MuseLendPositionManagerAbi, functionName: "closeCapped", args: route ? [props.id, BigInt(quote!.protectedAmount), BigInt(quote!.deadline), route] : undefined, account: address, query: { enabled: props.enabled && mode === "capped" && quoteMatches && props.allowance >= requiredAllowance } });
  const transaction = useWriteContract();
  const receipt = useTrackedTransaction(transaction.data);
  const busy = loading || transaction.isPending || receipt.status === "confirming";

  useEffect(() => {
    if (!quote) return;
    const timeout = window.setTimeout(() => setQuoteFresh(false), Math.max(0, quote.deadline * 1000 - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [quote]);

  async function requestQuote(nextMode = mode) {
    setLoading(true); setQuote(undefined); setQuoteFresh(false); setQuoteError(undefined);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    try {
      const response = await fetch(`/api/quote/${nextMode === "full" ? "buy-exact-output" : "buy-exact-input"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: 84532, creatorToken: props.creatorToken, amount: (nextMode === "full" ? props.syntheticAmount : props.coverageCap).toString(), slippageBps: 100, deadline }) });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("No verified settlement quote is available.");
      const parsed = buyQuoteResponse.parse(body).quote;
      if (parsed.adapter.toLowerCase() !== props.adapter.toLowerCase()) throw new Error("Quote adapter does not match this position.");
      setQuote(parsed); setQuoteFresh(true);
    } catch (error) { setQuoteError(error instanceof Error ? error.message : "Settlement quote failed safely."); }
    finally { setLoading(false); }
  }

  function approve() { if (usdc && manager) transaction.writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [manager, maxUint256] }); }
  function execute() {
    if (mode === "full" && fullSimulation.data?.request) transaction.writeContract(fullSimulation.data.request);
    if (mode === "capped" && cappedSimulation.data?.request) transaction.writeContract(cappedSimulation.data.request);
  }

  return <Card className="lg:col-span-2"><CardHeader><CardTitle>Close position</CardTitle></CardHeader><CardContent className="space-y-5">
    <Tabs value={mode} onValueChange={(value) => { const next = value as "full" | "capped"; setMode(next); setQuote(undefined); setQuoteFresh(false); setQuoteError(undefined); }}><TabsList><TabsTrigger value="full">Full redemption</TabsTrigger><TabsTrigger value="capped">Capped settlement</TabsTrigger></TabsList>
      <TabsContent value="full" className="space-y-4"><p className="text-sm text-muted-foreground">Buy exactly {formatToken(props.syntheticAmount)} tokens. The position covers up to {formatUsdc(props.coverageCap)}; you control the maximum additional USDC.</p><div className="space-y-2"><Label htmlFor="settlement-top-up">Maximum top-up</Label><Input id="settlement-top-up" inputMode="decimal" value={topUp} onChange={(event) => { setTopUp(event.target.value); setQuote(undefined); setQuoteFresh(false); }} /></div></TabsContent>
      <TabsContent value="capped" className="space-y-4"><Alert><AlertTitle>Token return may be partial</AlertTitle><AlertDescription>The entire {formatUsdc(props.coverageCap)} cap is exchanged. You receive only the Creator Tokens obtainable above the protected minimum.</AlertDescription></Alert></TabsContent>
    </Tabs>
    <Button variant="outline" onClick={() => requestQuote()} disabled={!props.enabled || busy}>{loading ? "Requesting…" : "Request fresh quote"}</Button>
    {quote ? <div className="grid gap-3 text-sm sm:grid-cols-3"><Metric label={mode === "full" ? "Protected max cost" : "Minimum token return"} value={mode === "full" ? formatUsdc(BigInt(quote.protectedAmount)) : formatToken(BigInt(quote.protectedAmount))} /><Metric label="Quote expiry" value={new Date(quote.deadline * 1000).toLocaleTimeString()} /><Metric label="Source" value="Verified testnet adapter" /></div> : null}
    {mode === "full" && quote && topUpAtomic < requiredTopUp ? <p className="text-sm text-destructive">Maximum top-up must be at least {formatUsdc(requiredTopUp)} for this slippage-protected quote.</p> : null}
    {quoteError ? <p className="text-sm text-destructive">{quoteError}</p> : null}
    {quote && props.allowance < requiredAllowance ? <Button onClick={approve} disabled={busy}>Approve debt and top-up USDC</Button> : <Button onClick={execute} disabled={busy || !(mode === "full" ? fullSimulation.data?.request : cappedSimulation.data?.request)}>Simulate and close</Button>}
    {(fullSimulation.error || cappedSimulation.error) && quote ? <p className="text-sm text-destructive">Simulation failed. The transaction was not sent; refresh the quote and verify allowance and liquidity.</p> : null}
    <TransactionStatus hash={receipt.finalHash} walletPending={transaction.isPending} confirming={receipt.status === "confirming"} confirmed={receipt.status === "confirmed"} error={transaction.error ?? receipt.error} replacementReason={receipt.replacementReason} label="Settlement" />
  </CardContent></Card>;
}

function safeUsdc(value: string) { try { return /^\d+(\.\d{0,6})?$/.test(value) ? parseUnits(value, 6) : 0n; } catch { return 0n; } }
function maximum(value: bigint, floor: bigint) { return value > floor ? value : floor; }
function formatUsdc(value: bigint) { return `${Number(formatUnits(value, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`; }
function formatToken(value: bigint) { return Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 }); }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-muted-foreground">{label}</p><p className="mt-1 break-all font-mono">{value}</p></div>; }
