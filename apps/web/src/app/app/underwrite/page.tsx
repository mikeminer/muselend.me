import { HedgeEpochPanel } from "@/components/hedge-epoch-panel";
import { PageHeading } from "@/components/page-heading";

export default function UnderwritePage() {
  const t = useTranslations("AppPages");
  return (
    <>
      <PageHeading
        eyebrow={t("underwriteEyebrow")}
        title={t("underwriteTitle")}
        description={t("underwriteDescription")}
      />
      <HedgeEpochPanel />
    </>
  );
}
import { useTranslations } from "next-intl";
