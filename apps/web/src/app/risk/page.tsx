import { useTranslations } from "next-intl";
import { ContentPage } from "@/components/content-page";

export default function RiskPage() {
  const t = useTranslations("PublicPages");
  return <ContentPage eyebrow={t("riskEyebrow")} title={t("riskTitle")} intro={t("riskIntro")} sections={[
    { title: t("riskLiquidity"), body: t("riskLiquidityBody") },
    { title: t("riskSynthetic"), body: t("riskSyntheticBody") },
    { title: t("riskTranches"), body: t("riskTranchesBody") },
    { title: t("riskDependencies"), body: t("riskDependenciesBody") },
    { title: t("riskAdmin"), body: t("riskAdminBody") },
  ]} />;
}
