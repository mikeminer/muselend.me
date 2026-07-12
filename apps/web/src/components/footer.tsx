import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function Footer() {
  return <footer className="border-t border-white/8"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-end"><div><BrandLogo /><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Capped synthetic exposure for creator-token holders. Testnet only. No capital or redemption is guaranteed.</p></div><nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><Link href="/risk">Risk</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/status">Status</Link></nav></div></footer>;
}
