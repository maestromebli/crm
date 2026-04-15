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
      className={`enver-panel p-5 ${className ?? ""}`}
    >
      <header className="mb-4 border-b border-[var(--enver-border)] pb-3">
        <h2 className="text-base font-semibold leading-snug tracking-tight text-[var(--enver-text)]">{title}</h2>
        {subtitle ? (
          <p className="mt-1.5 max-w-[80ch] text-sm leading-relaxed text-[var(--enver-text-muted)]">{subtitle}</p>
        ) : null}
    </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

