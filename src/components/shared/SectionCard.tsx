type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export function SectionCard({ title, subtitle, children, className, id }: SectionCardProps) {
  return (
    <section
      id={id}
      className={`enver-panel enver-panel--interactive p-5 ring-1 ring-slate-900/[0.04] ${className ?? ""}`}
    >
      <header className="mb-5 border-b border-[var(--enver-border)] pb-4">
        <h2 className="text-base font-semibold leading-snug tracking-tight text-[var(--enver-text)]">{title}</h2>
        {subtitle ? (
          <p className="mt-1.5 max-w-[80ch] text-sm leading-relaxed text-[var(--enver-text-muted)]">{subtitle}</p>
        ) : null}
    </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

