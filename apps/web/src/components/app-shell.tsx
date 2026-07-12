import Link from "next/link";
import { Activity, ChartNoAxesCombined, CircleDollarSign, LayoutDashboard, ShieldCheck, WalletCards } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { WalletButton } from "@/components/wallet-button";

const nav = [
  ["overview", "/app", LayoutDashboard],
  ["borrow", "/app/borrow", CircleDollarSign],
  ["lend", "/app/lend", WalletCards],
  ["underwrite", "/app/underwrite", ShieldCheck],
  ["positions", "/app/positions", Activity],
  ["markets", "/app/markets", ChartNoAxesCombined],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("AppShell");
  return <div className="min-h-screen bg-background">
    <header className="border-b border-white/8">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden border-primary/30 text-primary sm:inline-flex">Base Sepolia</Badge>
          <LocaleSwitcher />
          <WalletButton />
        </div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1500px] md:grid-cols-[220px_1fr]">
      <aside className="hidden min-h-[calc(100vh-4rem)] border-r border-white/8 p-4 md:block">
        <nav className="space-y-1" aria-label="MuseLend">
          {nav.map(([key, href, Icon]) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"><Icon className="size-4" />{t(key)}</Link>)}
        </nav>
        <div className="mt-10 rounded-lg border border-amber-300/15 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/65">{t("testnetNotice")}</div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </div>
  </div>;
}
