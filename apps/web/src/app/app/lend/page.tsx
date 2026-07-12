import { PageHeading } from "@/components/page-heading";
import { SeniorVaultPanel } from "@/components/senior-vault-panel";

export default function LendPage() {
  const t = useTranslations("AppPages");
  return (
    <>
      <PageHeading
        eyebrow={t("lendEyebrow")}
        title={t("lendTitle")}
        description={t("lendDescription")}
      />
      <SeniorVaultPanel />
    </>
  );
}
import { useTranslations } from "next-intl";
