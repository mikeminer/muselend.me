import Link from "next/link";
import { Menu, Wallet } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const links = [
  ["How it works", "/#how-it-works"],
  ["Markets", "/app/markets"],
  ["Docs", "/docs"],
  ["Risks", "/risk"],
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <BrandLogo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Primary navigation">
          {links.map(([label, href]) => <Link key={href} href={href} className="transition-colors hover:text-foreground">{label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild className="hidden bg-primary text-primary-foreground hover:bg-primary/90 sm:inline-flex">
            <Link href="/app"><Wallet />Launch app</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden" aria-label="Open navigation"><Menu /></Button></SheetTrigger>
            <SheetContent className="dark p-6"><SheetTitle className="sr-only">Navigation</SheetTitle><BrandLogo />
              <nav className="mt-10 flex flex-col gap-6 text-lg">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/app">Launch app</Link></nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
