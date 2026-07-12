import { useTranslations } from "next-intl";
import { BorrowPositionPanel } from "@/components/borrow-position-panel";
import { PageHeading } from "@/components/page-heading";

export default function BorrowPage() {
  const t = useTranslations("Borrow");
  const disclosures = [
    t("sale"),
    t("reserve"),
    t("loan"),
    t("cap"),
    t("topUp"),
    t("partial"),
    t("default"),
    t("execution"),
    t("economicRisk"),
  ];
  const acknowledgements = [t("sale"), t("cap"), t("default"), t("contractRisk")];

  return (
    <>
      <PageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <BorrowPositionPanel disclosures={disclosures} acknowledgements={acknowledgements} />
    </>
  );
}
