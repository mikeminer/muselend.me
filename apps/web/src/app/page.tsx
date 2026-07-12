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
  { icon: CircleDollarSign, eyebrow: "Borrow", title: "Turn realized value into liquidity", text: "Your creator tokens are sold at opening. The realized USDC is isolated as position reserve before a senior loan is originated." },
  { icon: TrendingUp, eyebrow: "Lend", title: "Fund the senior USDC vault", text: "Supply native USDC on Base and earn borrower interest, with withdrawals constrained by actually available liquidity." },
  { icon: ShieldCheck, eyebrow: "Underwrite", title: "Cover capped upside by epoch", text: "Junior capital earns premium and downside PnL, while accepting defined losses if creator tokens appreciate." },
];

const facts = ["Sale proceeds measured by balance delta", "Senior priority on default", "Time-limited synthetic position", "Explicit coverage cap and settlement paths"];

export default function Home() {
  const t = useTranslations("Home");
  return <><SiteHeader /><main>
    <section className="relative overflow-hidden border-b border-white/8"><div className="hero-glow" /><div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.15fr_.85fr] lg:py-36">
      <div><Badge variant="outline" className="mb-7 border-primary/30 bg-primary/8 text-primary">{t("eyebrow")}</Badge><h1 className="max-w-4xl text-5xl font-medium leading-[.96] tracking-[-0.065em] sm:text-7xl">{t("title")}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">{t("subtitle")}</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/app/borrow">{t("borrow")} <ArrowRight /></Link></Button><Button asChild variant="outline" size="lg"><Link href="/docs">{t("readDocs")}</Link></Button></div><div className="mt-10 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">{facts.map(f => <div key={f} className="flex items-center gap-2"><Check className="size-4 text-[var(--brand-teal)]" />{f}</div>)}</div></div>
      <Card className="self-center border-white/10 bg-[#15131f]/90 shadow-2xl shadow-primary/5"><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm font-normal text-muted-foreground">Illustrative position</CardTitle><Badge variant="secondary">30 days</Badge></div></CardHeader><CardContent className="space-y-6"><div><div className="text-sm text-muted-foreground">Creator token sold</div><div className="mt-1 font-mono text-3xl">125,000 TOKEN</div></div><Separator /><div className="grid grid-cols-2 gap-5"><div><div className="text-xs text-muted-foreground">Sale reserve</div><div className="mt-1 font-mono text-lg">8,400 USDC</div></div><div><div className="text-xs text-muted-foreground">Loan principal</div><div className="mt-1 font-mono text-lg">5,040 USDC</div></div><div><div className="text-xs text-muted-foreground">Coverage cap</div><div className="mt-1 font-mono text-lg">12,600 USDC</div></div><div><div className="text-xs text-muted-foreground">Junior coverage</div><div className="mt-1 font-mono text-lg">4,200 USDC</div></div></div><div className="rounded-lg border border-amber-300/15 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/70">If full buyback costs more than the coverage cap, the borrower must top up or accept a partial capped settlement.</div></CardContent></Card>
    </div></section>
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" id="how-it-works"><div className="max-w-2xl"><p className="text-sm uppercase tracking-[.18em] text-primary">One protocol, three sides</p><h2 className="mt-3 text-3xl font-medium tracking-[-.04em] sm:text-5xl">Liquidity with an explicit risk waterfall.</h2></div><div className="mt-10 grid gap-4 lg:grid-cols-3">{flows.map(({icon: Icon, eyebrow, title, text}) => <Card key={eyebrow} className="border-white/8 bg-card/50"><CardHeader><Icon className="mb-8 size-5 text-primary" /><p className="text-xs uppercase tracking-[.18em] text-muted-foreground">{eyebrow}</p><CardTitle className="text-xl tracking-tight">{title}</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{text}</CardContent></Card>)}</div></section>
    <section className="border-y border-white/8 bg-white/[.018]"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Network" value="84532" detail="Base Sepolia" /><MetricCard label="Senior liquidity" value="—" detail="Available after deployment" /><MetricCard label="Open positions" value="0" detail="Testnet protocol not deployed" /><MetricCard label="Mainnet" value="Disabled" detail="Launch gates required" /></div></div></section>
    <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6"><p className="text-sm uppercase tracking-[.18em] text-primary">Understand before acting</p><h2 className="mt-4 text-4xl font-medium tracking-[-.05em]">{t("riskTitle")}</h2><p className="mx-auto mt-5 max-w-2xl leading-7 text-muted-foreground">Liquidity can disappear. Smart contracts can fail. Junior capital can be lost. The protocol exposes the cap, debt, settlement route and maximum top-up before signing.</p><Button asChild variant="outline" className="mt-8"><Link href="/risk">Review all risks <ArrowRight /></Link></Button></section>
  </main><Footer /></>;
}
