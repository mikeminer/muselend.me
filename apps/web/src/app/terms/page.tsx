import { useTranslations } from "next-intl";
import { ContentPage } from "@/components/content-page";

export default function Terms() {
  const t = useTranslations("PublicPages");
  return <ContentPage eyebrow={t("legal")} title={t("termsTitle")} intro={t("termsIntro")} sections={[
    { title: t("termsTestnet"), body: t("termsTestnetBody") },
    { title: t("termsGuarantee"), body: t("termsGuaranteeBody") },
    { title: t("termsResponsibility"), body: t("termsResponsibilityBody") },
  ]} />;
}
