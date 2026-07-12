import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="border-white/8 bg-card/55"><CardHeader className="pb-2"><CardTitle className="text-xs font-normal uppercase tracking-[0.16em] text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="font-mono text-2xl tracking-tight tabular-nums">{value}</div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}
