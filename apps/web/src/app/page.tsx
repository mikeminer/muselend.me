import Link from "next/link";
import { ArrowRight, Check, CircleDollarSign, ShieldCheck, TrendingUp } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { MetricCard } from "@/components/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";

const flows = [
  { icon: CircleDollarSign, eyebrow: "borrowEyebrow", title: "borrowTitle", text: "borrowText" },
  { icon: TrendingUp, eyebrow: "lendEyebrow", title: "lendTitle", text: "lendText" },
  { icon: ShieldCheck, eyebrow: "underwriteEyebrow", title: "underwriteTitle", text: "underwriteText" },
] as const;

const facts = ["factDelta", "factPriority", "factLimited", "factCap"] as const;

export default function Home() {
  const t = useTranslations("Home");
  return <><SiteHeader /><main>
    <section className="relative overflow-hidden border-b border-white/8"><div className="hero-glow" /><div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.15fr_.85fr] lg:py-36">
      <div><Badge variant="outline" className="mb-7 border-primary/30 bg-primary/8 text-primary">{t("eyebrow")}</Badge><h1 className="max-w-4xl text-5xl font-medium leading-[.96] tracking-[-0.065em] sm:text-7xl">{t("title")}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">{t("subtitle")}</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/app/borrow">{t("borrow")} <ArrowRight /></Link></Button><Button asChild variant="outline" size="lg"><Link href="/docs">{t("readDocs")}</Link></Button></div><div className="mt-10 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">{facts.map((key) => <div key={key} className="flex items-center gap-2"><Check className="size-4 text-[var(--brand-teal)]" />{t(key)}</div>)}</div></div>
      <Card className="self-center border-white/10 bg-[#15131f]/90 shadow-2xl shadow-primary/5"><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm font-normal text-muted-foreground">{t("illustrative")}</CardTitle><Badge variant="secondary">{t("days30")}</Badge></div></CardHeader><CardContent className="space-y-6"><div><div className="text-sm text-muted-foreground">{t("tokenSold")}</div><div className="mt-1 font-mono text-3xl">125,000 TOKEN</div></div><Separator /><div className="grid grid-cols-2 gap-5"><div><div className="text-xs text-muted-foreground">{t("saleReserve")}</div><div className="mt-1 font-mono text-lg">8,400 USDC</div></div><div><div className="text-xs text-muted-foreground">{t("loanPrincipal")}</div><div className="mt-1 font-mono text-lg">5,040 USDC</div></div><div><div className="text-xs text-muted-foreground">{t("coverageCap")}</div><div className="mt-1 font-mono text-lg">12,600 USDC</div></div><div><div className="text-xs text-muted-foreground">{t("juniorCoverage")}</div><div className="mt-1 font-mono text-lg">4,200 USDC</div></div></div><div className="rounded-lg border border-amber-300/15 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/70">{t("illustrativeRisk")}</div></CardContent></Card>
    </div></section>
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" id="how-it-works"><div className="max-w-2xl"><p className="text-sm uppercase tracking-[.18em] text-primary">{t("threeSides")}</p><h2 className="mt-3 text-3xl font-medium tracking-[-.04em] sm:text-5xl">{t("waterfall")}</h2></div><div className="mt-10 grid gap-4 lg:grid-cols-3">{flows.map(({icon: Icon, eyebrow, title, text}) => <Card key={eyebrow} className="border-white/8 bg-card/50"><CardHeader><Icon className="mb-8 size-5 text-primary" /><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">{t(eyebrow)}</p><CardTitle className="text-xl tracking-tight">{t(title)}</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{t(text)}</CardContent></Card>)}</div></section>
    <section className="border-y border-white/8 bg-white/[.018]"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label={t("network")} value="84532" detail="Base Sepolia" /><MetricCard label={t("seniorLiquidity")} value="—" detail={t("afterDeployment")} /><MetricCard label={t("openPositions")} value="0" detail={t("notDeployed")} /><MetricCard label={t("mainnet")} value={t("disabled")} detail={t("launchGates")} /></div></div></section>
    <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6"><p className="text-sm uppercase tracking-[.18em] text-primary">{t("understand")}</p><h2 className="mt-4 text-4xl font-medium tracking-[-.05em]">{t("riskTitle")}</h2><p className="mx-auto mt-5 max-w-2xl leading-7 text-muted-foreground">{t("riskText")}</p><Button asChild variant="outline" className="mt-8"><Link href="/risk">{t("reviewRisks")} <ArrowRight /></Link></Button></section>
  </main><Footer /></>;
}
