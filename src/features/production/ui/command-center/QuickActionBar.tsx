type Action = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function QuickActionBar({ actions }: { actions: Action[] }) {
  return (
    <section className="enver-panel rounded-2xl p-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--enver-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--enver-muted)]"
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
