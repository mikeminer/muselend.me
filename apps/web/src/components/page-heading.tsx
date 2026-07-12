export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return <div className="mb-8 max-w-3xl">{eyebrow && <p className="mb-2 text-xs uppercase tracking-[.18em] text-primary">{eyebrow}</p>}<h1 className="text-3xl font-medium tracking-[-.045em] sm:text-4xl">{title}</h1><p className="mt-3 leading-7 text-muted-foreground">{description}</p></div>;
}
