import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand-logo";

export function Footer() {
  const t = useTranslations("Footer");
  return <footer className="border-t border-white/8"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-end"><div><BrandLogo /><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">{t("description")}</p></div><nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><Link href="/risk">{t("risk")}</Link><Link href="/terms">{t("terms")}</Link><Link href="/privacy">{t("privacy")}</Link><Link href="/cookies">{t("cookies")}</Link><Link href="/status">{t("status")}</Link></nav></div></footer>;
}
