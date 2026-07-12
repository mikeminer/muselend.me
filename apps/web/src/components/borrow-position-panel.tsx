"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatUnits, isAddress, parseAbi, parseUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { deploymentConfigured } from "@/lib/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

type Props = { disclosures: string[]; acknowledgements: string[] };
const erc20MetadataAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export function BorrowPositionPanel({ disclosures, acknowledgements }: Props) {
  const { address, isConnected, chainId } = useAccount();
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("");
  const [advanceRate, setAdvanceRate] = useState(60);
  const [term, setTerm] = useState(30);
  const [accepted, setAccepted] = useState<boolean[]>(() => acknowledgements.map(() => false));
  const [status, setStatus] = useState<string>();
  const [loading, setLoading] = useState(false);
  const tokenAddress = isAddress(token) ? token : undefined;
  const tokenReads = useReadContracts({
    contracts: tokenAddress && address ? [
      { address: tokenAddress, abi: erc20MetadataAbi, functionName: "balanceOf", args: [address] },
      { address: tokenAddress, abi: erc20MetadataAbi, functionName: "decimals" },
      { address: tokenAddress, abi: erc20MetadataAbi, functionName: "symbol" },
    ] : [],
    query: { enabled: Boolean(tokenAddress && address && chainId === 84532) },
  });
  const tokenBalance = tokenReads.data?.[0]?.status === "success" ? tokenReads.data[0].result : 0n;
  const tokenDecimals = tokenReads.data?.[1]?.status === "success" ? tokenReads.data[1].result : 18;
  const tokenSymbol = tokenReads.data?.[2]?.status === "success" ? tokenReads.data[2].result : "tokens";
  const amountAtomic = useMemo(() => safeTokenAmount(amount, tokenDecimals), [amount, tokenDecimals]);
  const ready = deploymentConfigured && isConnected && chainId === 84532;
  const balanceSufficient = !isConnected || amountAtomic <= tokenBalance;
  const formValid = Boolean(tokenAddress) && amountAtomic > 0n && balanceSufficient && accepted.every(Boolean);

  async function requestQuote() {
    if (!formValid) return;
    setLoading(true);
    setStatus(undefined);
    try {
      const validation = await fetch("/api/token/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chainId: 84532, token }),
      });
      const validationBody = (await validation.json()) as { valid?: boolean; reason?: string };
      if (!validation.ok || !validationBody.valid) {
        setStatus(validationBody.reason ?? "This token is not enabled by the protocol validator.");
        return;
      }
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
      const body = (await response.json()) as { error?: { message?: string }; message?: string };
      setStatus(body.error?.message ?? body.message ?? (response.ok ? "Quote ready." : "Quote unavailable."));
    } catch {
      setStatus("The quote service could not be reached. No transaction was prepared.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader><CardTitle>Position details</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="token">Creator Token address</Label>
            <Input id="token" value={token} onChange={(event) => setToken(event.target.value.trim())} placeholder="0x…" />
            <p className="text-xs text-muted-foreground">Only canonical, enabled Zora Creator Tokens are accepted.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount to sell</Label>
            <Input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            {isConnected && tokenAddress ? <p className="text-xs text-muted-foreground">Wallet balance: {Number(formatUnits(tokenBalance, tokenDecimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol}</p> : null}
            {!balanceSufficient ? <p className="text-xs text-destructive">Amount exceeds the connected wallet balance.</p> : null}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><Label>Loan amount</Label><span className="font-mono text-muted-foreground">{advanceRate}%</span></div>
            <Slider value={[advanceRate]} min={10} max={60} step={5} onValueChange={(value) => setAdvanceRate(value[0] ?? 60)} aria-label="Loan amount percentage" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[7, 14, 30].map((days) => <Button key={days} type="button" variant={days === term ? "default" : "outline"} onClick={() => setTerm(days)}>{days} days</Button>)}
          </div>
          <Separator />
          <section aria-labelledby="borrow-disclosures" className="space-y-3">
            <h2 id="borrow-disclosures" className="text-sm font-medium">Required disclosures</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">{disclosures.map((text) => <li key={text} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span>{text}</span></li>)}</ul>
          </section>
          <Separator />
          <div className="space-y-4">{acknowledgements.map((text, index) => <div key={text} className="flex items-start gap-3"><Checkbox id={`risk-${index}`} checked={accepted[index]} onCheckedChange={(checked) => setAccepted((current) => current.map((value, item) => item === index ? checked === true : value))} /><Label htmlFor={`risk-${index}`} className="font-normal leading-5 text-muted-foreground">{text}</Label></div>)}</div>
          <Button className="w-full" disabled={!formValid || loading} onClick={requestQuote}>{loading ? "Validating…" : ready ? "Validate and request quote" : "Check availability"}</Button>
          {status ? <Alert><AlertTitle>Quote status</AlertTitle><AlertDescription>{status}</AlertDescription></Alert> : null}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Quote summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{[["Sale proceeds", "—"], ["Principal", "—"], ["Origination fee", "—"], ["Hedge premium", "—"], ["Net USDC received", "—"], ["Coverage cap", "—"], ["Worst-case debt", "—"]].map(([key, value]) => <div key={key} className="flex justify-between gap-4"><span className="text-muted-foreground">{key}</span><span className="font-mono">{value}</span></div>)}</CardContent></Card>
        <Alert className="border-amber-300/15 bg-amber-300/5"><AlertTriangle /><AlertTitle>Redemption can be partial</AlertTitle><AlertDescription className="leading-5">Above the cap, you may need to add USDC to recover the full amount. Otherwise the protocol may return fewer tokens. Liquidity, slippage and fees affect the result.</AlertDescription></Alert>
        {!deploymentConfigured ? <p className="text-sm text-muted-foreground">Verified Base Sepolia addresses are not published yet. The app validates inputs but cannot prepare a transaction.</p> : null}
      </div>
    </div>
  );
}

function safeTokenAmount(value: string, decimals: number) {
  try { return value && /^\d+(\.\d{0,18})?$/.test(value) ? parseUnits(value, decimals) : 0n; } catch { return 0n; }
}
