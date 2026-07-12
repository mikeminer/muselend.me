import { PageHeading } from "@/components/page-heading";
import { PositionsPanel } from "@/components/positions-panel";

export default function PositionsPage() {
  const t = useTranslations("AppPages");
  return <>
    <PageHeading eyebrow={t("positionsEyebrow")} title={t("positionsTitle")} description={t("positionsDescription")} />
    <PositionsPanel />
  </>;
}
import { useTranslations } from "next-intl";
