import { MarketsPanel } from "@/components/markets-panel";
import { PageHeading } from "@/components/page-heading";

export default function MarketsPage() {
  const t = useTranslations("AppPages");
  return <>
    <PageHeading eyebrow={t("marketsEyebrow")} title={t("marketsTitle")} description={t("marketsDescription")} />
    <MarketsPanel />
  </>;
}
import { useTranslations } from "next-intl";
