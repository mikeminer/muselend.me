import { useTranslations } from "next-intl";
import { ContentPage } from "@/components/content-page";

export default function Privacy() {
  const t = useTranslations("PublicPages");
  return <ContentPage eyebrow={t("legal")} title={t("privacyTitle")} intro={t("privacyIntro")} sections={[
    { title: t("privacyCategories"), body: t("privacyCategoriesBody") },
    { title: t("privacyAuthority"), body: t("privacyAuthorityBody") },
    { title: t("privacyRights"), body: t("privacyRightsBody") },
  ]} />;
}
