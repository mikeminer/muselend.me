import { useTranslations } from "next-intl";
import { ContentPage } from "@/components/content-page";

export default function MaintenancePage() {
  const t = useTranslations("PublicPages");
  return <ContentPage
    eyebrow={t("maintenanceEyebrow")}
    title={t("maintenanceTitle")}
    intro={t("maintenanceIntro")}
    sections={[
      { title: t("maintenanceFunds"), body: t("maintenanceFundsBody") },
      { title: t("maintenanceUpdates"), body: t("maintenanceUpdatesBody") },
    ]}
  />;
}
