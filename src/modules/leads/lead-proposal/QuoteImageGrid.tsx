"use client";

import { cn } from "../../../lib/utils";

type Props = {
  urls: string[];
  emptyLabel?: string;
  className?: string;
};

/** Сітка зображень у колонці «Візи»: 1x2 / 2x2 залежно від кількості */
export function QuoteImageGrid({
  urls,
  emptyLabel = "Без зображення",
  className,
}: Props) {
  const clean = urls.filter(Boolean);
  if (clean.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[120px] items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50/80 text-center text-[10px] leading-snug text-slate-500 print:border-slate-400 print:bg-white",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  const gridClass =
    clean.length === 1
      ? "grid-cols-1"
      : clean.length === 2
        ? "grid-cols-2"
        : clean.length === 3
          ? "grid-cols-2"
          : "grid-cols-2";

  return (
    <div
      className={cn("grid gap-1.5", gridClass, className)}
      data-quote-images={clean.length}
    >
      {clean.slice(0, 4).map((src, i) => (
        <div
          key={`${src}-${i}`}
          className="relative aspect-[4/3] overflow-hidden rounded border border-slate-200 bg-[var(--enver-card)] print:border-slate-400"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}
