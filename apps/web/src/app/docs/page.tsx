import { useTranslations } from "next-intl";
import { ContentPage } from "@/components/content-page";

export default function DocsPage() {
  const t = useTranslations("PublicPages");
  return <ContentPage eyebrow={t("docsEyebrow")} title={t("docsTitle")} intro={t("docsIntro")} sections={[
    { title: t("docsOpening"), body: t("docsOpeningBody") },
    { title: t("docsInterest"), body: t("docsInterestBody") },
    { title: t("docsSettlement"), body: t("docsSettlementBody") },
    { title: t("docsDefault"), body: t("docsDefaultBody") },
  ]} />;
}
