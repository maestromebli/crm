type CurrencyCellProps = {
  value: number;
  currency?: string;
  tone?: "default" | "income" | "expense";
};

const toneClass: Record<NonNullable<CurrencyCellProps["tone"]>, string> = {
  default: "text-slate-800",
  income: "text-emerald-700",
  expense: "text-rose-700",
};

export function CurrencyCell({ value, currency = "UAH", tone = "default" }: CurrencyCellProps) {
  return (
    <span className={`font-medium ${toneClass[tone]}`}>
      {value.toLocaleString("uk-UA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}{" "}
      {currency}
    </span>
  );
}

