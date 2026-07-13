"use client";

import {
  MuseLendHedgeEpochVaultAbi,
  MuseLendPositionManagerAbi,
  MuseLendTestUSDCAbi,
  MuseLendUSDCVaultAbi,
} from "@muselend/abis";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { formatUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from "wagmi";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionStatus } from "@/components/transaction-status";
import { contracts, deploymentConfigured } from "@/lib/contracts";
import { useTrackedTransaction } from "@/lib/use-tracked-transaction";

type PositionTuple = readonly [
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  number,
  number,
  number,
  number,
  bigint,
  number,
];

const positionWindow = 50n;
const epochWindow = 5n;

export function PortfolioOverview() {
  const t = useTranslations("Portfolio");
  const { address, chainId, isConnected } = useAccount();
  const manager = contracts.positionManager;
  const senior = contracts.seniorVault;
  const hedge = contracts.hedgeEpochVault;
  const testUsdc = contracts.usdc;
  const enabled = deploymentConfigured && Boolean(address) && chainId === 84532;
  const nextPosition = useReadContract({
    address: manager,
    abi: MuseLendPositionManagerAbi,
    functionName: "nextPositionId",
    query: { enabled },
  });
  const nextEpoch = useReadContract({
    address: hedge,
    abi: MuseLendHedgeEpochVaultAbi,
    functionName: "nextEpochId",
    query: { enabled },
  });
  const nextPositionId =
    typeof nextPosition.data === "bigint" ? nextPosition.data : 1n;
  const firstPositionId =
    nextPositionId > positionWindow ? nextPositionId - positionWindow : 1n;
  const positionIds = range(firstPositionId, nextPositionId);
  const nextEpochId = typeof nextEpoch.data === "bigint" ? nextEpoch.data : 1n;
  const firstEpochId =
    nextEpochId > epochWindow ? nextEpochId - epochWindow : 1n;
  const epochIds = range(firstEpochId, nextEpochId);
  const seniorSharesRead = useReadContract({
    address: senior,
    abi: MuseLendUSDCVaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled },
  });
  const faucetReads = useReadContracts({
    contracts:
      testUsdc && address
        ? [
            {
              address: testUsdc,
              abi: MuseLendTestUSDCAbi,
              functionName: "balanceOf",
              args: [address],
            },
            {
              address: testUsdc,
              abi: MuseLendTestUSDCAbi,
              functionName: "hasClaimedFaucet",
              args: [address],
            },
            {
              address: testUsdc,
              abi: MuseLendTestUSDCAbi,
              functionName: "FAUCET_AMOUNT",
            },
          ]
        : [],
    query: { enabled },
  });
  const faucetClaimed =
    faucetReads.data?.[1]?.status === "success" &&
    faucetReads.data[1].result === true;
  const faucetSimulation = useSimulateContract({
    address: testUsdc,
    abi: MuseLendTestUSDCAbi,
    functionName: "faucet",
    account: address,
    query: { enabled: enabled && !faucetClaimed },
  });
  const faucetTransaction = useWriteContract();
  const faucetReceipt = useTrackedTransaction(faucetTransaction.data);
  const refetchFaucet = faucetReads.refetch;
  useEffect(() => {
    if (faucetReceipt.status === "confirmed") void refetchFaucet();
  }, [faucetReceipt.status, refetchFaucet]);
  const positionReads = useReadContracts({
    contracts: manager
      ? positionIds.map((id) => ({
          address: manager,
          abi: MuseLendPositionManagerAbi,
          functionName: "positions" as const,
          args: [id] as const,
        }))
      : [],
    query: { enabled },
  });
  const epochReads = useReadContracts({
    contracts:
      hedge && address
        ? epochIds.map((id) => ({
            address: hedge,
            abi: MuseLendHedgeEpochVaultAbi,
            functionName: "balanceOf" as const,
            args: [address, id] as const,
          }))
        : [],
    query: { enabled },
  });

  if (!deploymentConfigured)
    return <EmptyState title={t("contractsTitle")} text={t("contractsText")} />;
  if (!isConnected)
    return <EmptyState title={t("connectTitle")} text={t("connectText")} />;
  if (chainId !== 84532)
    return <EmptyState title={t("networkTitle")} text={t("networkText")} />;
  if (
    nextPosition.isLoading ||
    nextEpoch.isLoading ||
    seniorSharesRead.isLoading ||
    faucetReads.isLoading ||
    positionReads.isLoading ||
    epochReads.isLoading
  )
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("loading")}
      </p>
    );
  if (
    nextPosition.isError ||
    nextEpoch.isError ||
    seniorSharesRead.isError ||
    faucetReads.isError ||
    positionReads.isError ||
    epochReads.isError
  )
    return <EmptyState title={t("errorTitle")} text={t("errorText")} />;

  const seniorShares =
    typeof seniorSharesRead.data === "bigint" ? seniorSharesRead.data : 0n;
  const testUsdcBalance = readBigInt(faucetReads.data?.[0]);
  const faucetAmount = readBigInt(faucetReads.data?.[2]);
  const owned = (positionReads.data ?? []).flatMap((result, index) => {
    if (result.status !== "success") return [];
    const position = result.result as unknown as PositionTuple;
    return address && position[0].toLowerCase() === address.toLowerCase()
      ? [{ id: positionIds[index], position }]
      : [];
  });
  const active = owned.filter(
    ({ position }) =>
      position[16] === 1 || position[16] === 2 || position[16] === 5,
  );
  const principal = active.reduce(
    (total, { position }) => total + position[5],
    0n,
  );
  const juniorShares = (epochReads.data ?? []).reduce(
    (total, result) => total + readBigInt(result),
    0n,
  );
  const recent = [...owned].reverse().slice(0, 3);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("faucetTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("faucetDescription")}
          </p>
          <p className="font-mono text-sm">
            {t("faucetBalance", { balance: units(testUsdcBalance) })}
          </p>
          <Button
            disabled={
              faucetClaimed ||
              !faucetSimulation.data?.request ||
              faucetTransaction.isPending ||
              faucetReceipt.status === "confirming"
            }
            onClick={() =>
              faucetSimulation.data?.request &&
              faucetTransaction.writeContract(faucetSimulation.data.request)
            }
          >
            {faucetClaimed
              ? t("faucetClaimed")
              : t("faucetClaim", { amount: units(faucetAmount) })}
          </Button>
          <TransactionStatus
            hash={faucetReceipt.finalHash}
            walletPending={faucetTransaction.isPending}
            confirming={faucetReceipt.status === "confirming"}
            confirmed={faucetReceipt.status === "confirmed"}
            error={faucetTransaction.error ?? faucetReceipt.error}
            replacementReason={faucetReceipt.replacementReason}
            label={t("faucetTransaction")}
          />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("activePositions")}
          value={active.length.toLocaleString()}
          detail={t("activeDetail", { count: Number(positionWindow) })}
        />
        <MetricCard
          label={t("principal")}
          value={usdc(principal)}
          detail={t("principalDetail")}
        />
        <MetricCard
          label={t("seniorShares")}
          value={units(seniorShares)}
          detail={t("seniorDetail")}
        />
        <MetricCard
          label={t("juniorShares")}
          value={units(juniorShares)}
          detail={t("juniorDetail", { count: Number(epochWindow) })}
        />
      </div>
      {owned.length === 0 && seniorShares === 0n && juniorShares === 0n ? (
        <EmptyState title={t("emptyTitle")} text={t("emptyText")} />
      ) : null}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>{t("recent")}</CardTitle>
          <Button asChild variant="outline">
            <Link href="/app/positions">{t("viewAll")}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRecent")}</p>
          ) : (
            <ul className="divide-y">
              {recent.map(({ id, position }) => (
                <li key={id.toString()}>
                  <Link
                    href={`/app/positions/${id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm hover:text-primary"
                  >
                    <span className="font-mono">
                      {t("position", { id: id.toString() })}
                    </span>
                    <span>
                      {usdc(position[5])} · {t(stateKey(position[16]))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/app/borrow">{t("quote")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/lend">{t("seniorAction")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/underwrite">{t("juniorAction")}</Link>
        </Button>
      </div>
    </div>
  );
}

function range(first: bigint, exclusiveEnd: bigint) {
  return Array.from(
    { length: Number(exclusiveEnd - first) },
    (_, index) => first + BigInt(index),
  );
}
function readBigInt(result: { status: string; result?: unknown } | undefined) {
  return result?.status === "success" && typeof result.result === "bigint"
    ? result.result
    : 0n;
}
function units(value: bigint) {
  return Number(formatUnits(value, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}
function usdc(value: bigint) {
  return `${units(value)} USDC`;
}
function stateKey(state: number) {
  return (
    (
      [
        "stateNone",
        "stateOpen",
        "stateSettling",
        "stateClosed",
        "stateDefaulted",
        "statePending",
      ] as const
    )[state] ?? "stateUnknown"
  );
}
