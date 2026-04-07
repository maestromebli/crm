import { cn } from "@/lib/utils";

type KanbanBoardSkeletonProps = {
  /** Скільки колонок показати (наприклад 4 — legacy, 6 — цех). */
  columns?: number;
  className?: string;
};

export function KanbanBoardSkeleton({
  columns = 4,
  className,
}: KanbanBoardSkeletonProps) {
  const grid =
    columns <= 1
      ? "grid-cols-1"
      : columns >= 6
        ? "md:grid-cols-2 xl:grid-cols-6"
        : "md:grid-cols-2 xl:grid-cols-4";

  return (
    <div className={cn("grid gap-3", grid, className)} aria-hidden>
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="enver-panel flex min-h-[320px] flex-col p-3"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="h-4 w-28 animate-pulse rounded-md bg-[var(--enver-hover)]" />
            <div className="h-5 w-8 animate-pulse rounded-full bg-[var(--enver-hover)]" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-[4.5rem] animate-pulse rounded-xl bg-[var(--enver-hover)]" />
            <div className="h-[4.5rem] animate-pulse rounded-xl bg-[var(--enver-hover)]" />
            <div className="h-[4.5rem] w-4/5 animate-pulse rounded-xl bg-[var(--enver-hover)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
