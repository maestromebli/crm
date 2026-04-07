"use client";

import { cn } from "../../../lib/utils";

type SparklineProps = {
  data: number[];
  className?: string;
  stroke?: string;
};

export function Sparkline({
  data,
  className,
  stroke = "currentColor",
}: SparklineProps) {
  if (!data.length) {
    return (
      <div
        className={cn(
          "h-10 w-full rounded-md bg-[var(--enver-surface)]",
          className,
        )}
      />
    );
  }
  const max = Math.max(1e-6, ...data);
  const min = Math.min(0, ...data);
  const h = 32;
  const w = 120;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
    const y =
      h -
      pad -
      ((v - min) / Math.max(1e-6, max - min)) * (h - pad * 2);
    return `${x},${y}`;
  });
  const d = `M ${pts.join(" L ")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-10 w-[120px] shrink-0", className)}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
    </svg>
  );
}
