import { useTranslations } from "next-intl";
import { CreatorTokenClaimPanel } from "@/components/creator-token-claim-panel";
import { PageHeading } from "@/components/page-heading";

export default function ClaimPage() {
  const t = useTranslations("Claim");
  return (
    <>
      <PageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <CreatorTokenClaimPanel />
    </>
  );
}
