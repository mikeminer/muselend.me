import Image from "next/image";
import Link from "next/link";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="MuseLend home">
      <Image src="/brand/muselend-icon.svg" alt="" width={36} height={36} priority />
      {!compact && (
        <span className="text-lg font-medium tracking-[-0.04em]">
          muse<span className="text-primary">lend</span><span className="text-muted-foreground">.me</span>
        </span>
      )}
    </Link>
  );
}
