import { PageHeading } from "@/components/page-heading";
import { PortfolioOverview } from "@/components/portfolio-overview";

export default function OverviewPage() {
  const t = useTranslations("AppPages");
  return <>
    <PageHeading eyebrow={t("overviewEyebrow")} title={t("overviewTitle")} description={t("overviewDescription")} />
    <PortfolioOverview />
  </>;
}
import { useTranslations } from "next-intl";
