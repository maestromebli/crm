import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

type KanbanEmptyColumnProps = {
  message?: string;
  className?: string;
};

export function KanbanEmptyColumn({
  message = "Немає карток",
  className,
}: KanbanEmptyColumnProps) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--enver-border-strong)] bg-[var(--enver-surface)]/60 px-3 py-6 text-center",
        className,
      )}
    >
      <LayoutGrid
        className="h-7 w-7 text-[var(--enver-muted)] opacity-45"
        strokeWidth={1.25}
        aria-hidden
      />
      <p className="text-[11px] font-medium text-[var(--enver-text-muted)]">{message}</p>
    </div>
  );
}
