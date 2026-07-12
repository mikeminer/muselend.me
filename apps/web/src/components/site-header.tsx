import Link from "next/link";
import { Menu, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { WalletButton } from "@/components/wallet-button";

export function SiteHeader() {
  const t = useTranslations("Navigation");
  const shared = useTranslations("Shared");
  const links = [[t("how"), "/#how-it-works"], [t("markets"), "/app/markets"], [t("docs"), "/docs"], [t("risks"), "/risk"]] as const;
  return <header className="sticky top-0 z-50 border-b border-white/8 bg-background/85 backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
      <BrandLogo />
      <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label={shared("navigation")}>{links.map(([label, href]) => <Link key={href} href={href} className="transition-colors hover:text-foreground">{label}</Link>)}</nav>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <Button asChild className="hidden bg-primary text-primary-foreground hover:bg-primary/90 sm:inline-flex"><Link href="/app"><Wallet />{t("launch")}</Link></Button>
        <div className="hidden xl:block"><WalletButton /></div>
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden" aria-label={shared("openNavigation")}><Menu /></Button></SheetTrigger>
          <SheetContent className="dark p-6"><SheetTitle className="sr-only">{shared("navigation")}</SheetTitle><BrandLogo /><nav className="mt-10 flex flex-col gap-6 text-lg">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/app">{t("launch")}</Link></nav></SheetContent>
        </Sheet>
      </div>
    </div>
  </header>;
}
