import { useTranslations } from "next-intl";
import { ContentPage } from "@/components/content-page";

export default function Status() {
  const t = useTranslations("PublicPages");
  return <ContentPage
    eyebrow={t("statusEyebrow")}
    title={t("statusTitle")}
    intro={t("statusIntro")}
    sections={[
      { title: t("statusWeb"), body: t("statusWebBody") },
      { title: t("statusContracts"), body: t("statusContractsBody") },
      { title: t("statusData"), body: t("statusDataBody") },
      { title: t("statusMainnet"), body: t("statusMainnetBody") },
    ]}
  />;
}
