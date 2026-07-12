"use client";

import { useTranslations } from "next-intl";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";

export function WalletButton() {
  const t = useTranslations("Shared");
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  if (isConnected && chainId !== baseSepolia.id) return <Button variant="destructive" disabled={isSwitching} onClick={() => switchChain({ chainId: baseSepolia.id })}>{isSwitching ? t("switching") : t("switchNetwork")}</Button>;
  if (isConnected && address) return <Button variant="outline" onClick={() => disconnect()} aria-label={t("disconnect", { address })}>{short(address)}</Button>;
  const connector = connectors[0];
  return <Button variant="outline" disabled={!connector || isPending} onClick={() => connector && connect({ connector })} title={error?.message}>{isPending ? t("connecting") : connector ? t("connect") : t("install")}</Button>;
}

function short(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
