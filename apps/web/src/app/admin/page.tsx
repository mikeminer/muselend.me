import { AdminConsole } from "@/components/admin-console";
import { PageHeading } from "@/components/page-heading";

export default function Admin() {
  const t = useTranslations("Admin");
  return <>
    <PageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
    <AdminConsole />
  </>;
}
import { useTranslations } from "next-intl";
