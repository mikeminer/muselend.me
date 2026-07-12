import { PageHeading } from "@/components/page-heading";
import { PositionsPanel } from "@/components/positions-panel";

export default function PositionsPage() {
  return <>
    <PageHeading eyebrow="Positions" title="Capped synthetic positions" description="Inspect debt, maturity, reserve, junior coverage and currently available settlement routes." />
    <PositionsPanel />
  </>;
}
