import { useTranslations } from "next-intl";
import { ContentPage } from "@/components/content-page";

export default function Cookies() {
  const t = useTranslations("PublicPages");
  return <ContentPage eyebrow={t("legal")} title={t("cookiesTitle")} intro={t("cookiesIntro")} sections={[
    { title: t("cookiesEssential"), body: t("cookiesEssentialBody") },
    { title: t("cookiesAnalytics"), body: t("cookiesAnalyticsBody") },
  ]} />;
}
