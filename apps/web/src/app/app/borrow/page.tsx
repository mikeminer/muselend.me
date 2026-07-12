import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeading } from "@/components/page-heading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

export default function BorrowPage() {
  const t = useTranslations("Borrow");
  const disclosures = [
    t("sale"),
    t("reserve"),
    t("loan"),
    t("cap"),
    t("topUp"),
    t("partial"),
    t("default"),
    t("execution"),
    t("economicRisk"),
  ];
  const acknowledgements = [t("sale"), t("cap"), t("default"), t("contractRisk")];

  return (
    <>
      <PageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Position details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="token">Creator Token address</Label>
              <Input id="token" placeholder="0x…" disabled />
              <p className="text-xs text-muted-foreground">
                Only canonical, enabled Zora Creator Tokens are accepted.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount to sell</Label>
              <Input id="amount" placeholder="0.00" disabled />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <Label>Loan amount</Label>
                <span className="font-mono text-muted-foreground">60% max</span>
              </div>
              <Slider value={[60]} aria-label="Loan amount percentage" disabled />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[7, 14, 30].map((days) => (
                <Button key={days} variant={days === 30 ? "default" : "outline"} disabled>
                  {days} days
                </Button>
              ))}
            </div>
            <Separator />
            <section aria-labelledby="borrow-disclosures" className="space-y-3">
              <h2 id="borrow-disclosures" className="text-sm font-medium">
                {t("disclosuresTitle")}
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {disclosures.map((text) => (
                  <li key={text} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </section>
            <Separator />
            <div className="space-y-4">
              {acknowledgements.map((text, index) => (
                <div key={text} className="flex items-start gap-3">
                  <Checkbox id={`risk-${index}`} disabled />
                  <Label
                    htmlFor={`risk-${index}`}
                    className="font-normal leading-5 text-muted-foreground"
                  >
                    {text}
                  </Label>
                </div>
              ))}
            </div>
            <Button className="w-full" disabled>
              Contracts not deployed
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quote summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ["Sale proceeds", "—"],
                ["Principal", "—"],
                ["Origination fee", "—"],
                ["Hedge premium", "—"],
                ["Net USDC received", "—"],
                ["Coverage cap", "—"],
                ["Worst-case debt", "—"],
              ].map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Alert className="border-amber-300/15 bg-amber-300/5">
            <AlertTriangle />
            <AlertTitle>Redemption can be partial</AlertTitle>
            <AlertDescription className="leading-5">
              Above the cap, you may need to add USDC to recover the full amount. Otherwise the
              protocol may return fewer tokens. Liquidity, slippage and fees affect the result.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </>
  );
}
