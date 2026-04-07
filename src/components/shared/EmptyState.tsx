type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="enver-empty p-8 text-center">
      <h3 className="text-sm font-semibold text-[var(--enver-text)]">{title}</h3>
      <p className="mt-1 text-xs text-[var(--enver-text-muted)]">{description}</p>
    </div>
  );
}

