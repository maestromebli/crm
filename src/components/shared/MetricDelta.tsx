type MetricDeltaProps = {
  delta: number;
  suffix?: string;
};

export function MetricDelta({ delta, suffix = "%" }: MetricDeltaProps) {
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        positive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
      }`}
    >
      {positive ? "+" : ""}
      {delta.toFixed(2)}
      {suffix}
    </span>
  );
}

