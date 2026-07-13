"use client";

import { BaseCreatorTokenMirrorFactoryAbi } from "@muselend/abis";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, LoaderCircle, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatUnits, isAddress, type Address, type Hex } from "viem";
import { useAccount, useSimulateContract, useWriteContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import {
  testnetClaimAttestationResponse,
  testnetClaimDiscoveryResponse,
} from "@/lib/api-schemas";
import { contracts } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";
import { TransactionStatus } from "@/components/transaction-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Discovery = ReturnType<typeof testnetClaimDiscoveryResponse.parse>;
type Attestation = ReturnType<typeof testnetClaimAttestationResponse.parse>;

export function CreatorTokenClaimPanel() {
  const t = useTranslations("ClaimPanel");
  const { address, isConnected, chainId } = useAccount();
  const [selectedToken, setSelectedToken] = useState("");
  const factory = contracts.creatorMirrorFactory;
  const sourceToken = isAddress(selectedToken) ? selectedToken : undefined;
  const discoveryQuery = useQuery({
    queryKey: ["creator-token-discovery", address],
    enabled: Boolean(address),
    queryFn: async (): Promise<Discovery> => {
      const response = await fetch(`/api/testnet-claim?wallet=${address}`);
      if (!response.ok) throw new Error(t("discoveryUnavailable"));
      return testnetClaimDiscoveryResponse.parse(await response.json());
    },
  });
  const verification = useMutation({
    mutationFn: async ({ wallet, token }: { wallet: Address; token: Address }): Promise<Attestation> => {
      const response = await fetch("/api/testnet-claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, sourceToken: token }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload && "error" in payload
          ? (payload as { error?: { message?: string } }).error?.message
          : undefined;
        throw new Error(message ?? t("verificationFailed"));
      }
      return testnetClaimAttestationResponse.parse(payload);
    },
  });
  const discovery = discoveryQuery.data;
  const attestation = verification.data?.wallet.toLowerCase() === address?.toLowerCase()
    && verification.data?.sourceToken.toLowerCase() === sourceToken?.toLowerCase()
    ? verification.data
    : undefined;
  const voucher = attestation?.voucher;
  const enabled = Boolean(
    factory &&
      address &&
      chainId === baseSepolia.id &&
      voucher &&
      attestation?.eligible &&
      attestation.signature,
  );
  const simulation = useSimulateContract({
    address: factory,
    abi: BaseCreatorTokenMirrorFactoryAbi,
    functionName: "claim",
    args:
      voucher && attestation?.signature
        ? [
            {
              wallet: voucher.wallet as Address,
              sourceToken: voucher.sourceToken as Address,
              amount: BigInt(voucher.amount),
              name: voucher.name,
              symbol: voucher.symbol,
              decimals: voucher.decimals,
              deadline: BigInt(voucher.deadline),
            },
            attestation.signature as Hex,
          ]
        : undefined,
    account: address,
    query: { enabled },
  });
  const transaction = useWriteContract();
  const receipt = useTrackedTransaction(transaction.data);
  const mirror = attestation?.mirror ?? (simulation.data?.result as Address | undefined);

  function verifyBalance() {
    if (!address || !sourceToken) return;
    verification.mutate({ wallet: address, token: sourceToken });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{t("selectTitle")}</CardTitle>
          <CardDescription>{t("selectDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!factory ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{t("notConfiguredTitle")}</AlertTitle>
              <AlertDescription>{t("notConfiguredText")}</AlertDescription>
            </Alert>
          ) : null}
          {!isConnected ? (
            <Alert>
              <AlertCircle />
              <AlertTitle>{t("connectTitle")}</AlertTitle>
              <AlertDescription>{t("connectText")}</AlertDescription>
            </Alert>
          ) : chainId !== baseSepolia.id ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{t("networkTitle")}</AlertTitle>
              <AlertDescription>{t("networkText")}</AlertDescription>
            </Alert>
          ) : null}

          {address ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>{t("discovered")}</Label>
                {discoveryQuery.isPending ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : null}
              </div>
              {discovery?.tokens.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {discovery.tokens.map((token) => (
                    <button
                      type="button"
                      key={token.address}
                      onClick={() => setSelectedToken(token.address)}
                      className={`rounded-lg border p-3 text-left transition-colors ${selectedToken.toLowerCase() === token.address.toLowerCase() ? "border-primary bg-primary/8" : "border-white/10 hover:bg-white/5"}`}
                    >
                      <span className="block font-medium">{token.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">${token.symbol} · {token.balance}</span>
                    </button>
                  ))}
                </div>
              ) : (discovery || discoveryQuery.isError) && !discoveryQuery.isPending ? (
                <p className="text-sm text-muted-foreground">
                  {discovery?.discoveryAvailable ? t("noneDiscovered") : t("discoveryUnavailable")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="source-token">{t("manualAddress")}</Label>
            <Input
              id="source-token"
              value={selectedToken}
              onChange={(event) => setSelectedToken(event.target.value.trim())}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t("manualHelp")}</p>
          </div>

          {verification.error ? <p role="alert" className="text-sm text-destructive">{verification.error.message}</p> : null}
          <Button
            onClick={verifyBalance}
            disabled={!factory || !address || chainId !== baseSepolia.id || !sourceToken || verification.isPending}
          >
            {verification.isPending ? <LoaderCircle className="animate-spin" /> : <Search />}
            {verification.isPending ? t("verifying") : t("verify")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("claimTitle")}</CardTitle>
          <CardDescription>{t("claimDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {attestation?.voucher ? (
            <div className="space-y-3 rounded-lg border border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{attestation.voucher.name}</p>
                  <p className="text-sm text-muted-foreground">${attestation.voucher.symbol}</p>
                </div>
                <Badge variant="outline">Base → Sepolia</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">{t("baseBalance")}</p><p className="mt-1 break-all font-mono">{formatUnits(BigInt(attestation.sourceBalance), attestation.voucher.decimals)}</p></div>
                <div><p className="text-muted-foreground">{t("claimAmount")}</p><p className="mt-1 break-all font-mono">{formatUnits(BigInt(attestation.voucher.amount), attestation.voucher.decimals)}</p></div>
              </div>
            </div>
          ) : attestation?.claimed ? (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>{t("alreadyClaimedTitle")}</AlertTitle>
              <AlertDescription>{t("alreadyClaimedText")}</AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">{t("empty")}</p>
          )}

          <Alert>
            <AlertCircle />
            <AlertTitle>{t("oneTimeTitle")}</AlertTitle>
            <AlertDescription>{t("oneTimeText")}</AlertDescription>
          </Alert>

          {simulation.error && enabled ? <p className="text-sm text-destructive">{t("simulationFailed")}</p> : null}
          <Button
            className="w-full"
            disabled={!simulation.data?.request || transaction.isPending || receipt.status === "confirming" || receipt.status === "confirmed"}
            onClick={() => simulation.data?.request && transaction.writeContract(simulation.data.request)}
          >
            {transaction.isPending || receipt.status === "confirming" ? <LoaderCircle className="animate-spin" /> : null}
            {receipt.status === "confirmed" ? t("claimed") : t("claim")}
          </Button>
          <TransactionStatus
            hash={receipt.finalHash}
            walletPending={transaction.isPending}
            confirming={receipt.status === "confirming"}
            confirmed={receipt.status === "confirmed"}
            error={transaction.error ?? receipt.error}
            replacementReason={receipt.replacementReason}
            label={t("transaction")}
          />
          {mirror ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{t("mirrorAddress")}</p>
              <a className="block break-all font-mono text-primary underline underline-offset-4" href={`https://sepolia.basescan.org/address/${mirror}`} target="_blank" rel="noreferrer">{mirror}</a>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
