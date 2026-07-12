import { PageHeading } from "@/components/page-heading";
import { PortfolioOverview } from "@/components/portfolio-overview";

export default function OverviewPage() {
  return <>
    <PageHeading eyebrow="Portfolio" title="Your MuseLend overview" description="Positions, vault deposits, hedge epochs and activity derived from Base Sepolia." />
    <PortfolioOverview />
  </>;
}
