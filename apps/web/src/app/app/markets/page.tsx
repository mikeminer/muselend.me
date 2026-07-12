import { MarketsPanel } from "@/components/markets-panel";
import { PageHeading } from "@/components/page-heading";

export default function MarketsPage() {
  return <>
    <PageHeading eyebrow="Risk configuration" title="Enabled creator-token markets" description="Every market is read from bounded on-chain risk configuration. Mainnet remains disabled." />
    <MarketsPanel />
  </>;
}
