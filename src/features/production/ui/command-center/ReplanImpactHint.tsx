type ReplanImpact = {
  affectedOrdersCount: number;
  workshopImpact: string;
  deadlineConflicts: number;
  overloadDelta: number;
  recommended: boolean;
  risky: boolean;
};

export function ReplanImpactHint({ impact }: { impact: ReplanImpact | null }) {
  if (!impact) return <p className="text-xs text-slate-500">Оберіть слот, щоб побачити вплив перепланування.</p>;
  return (
    <div className={`rounded-lg border px-2.5 py-2 text-xs ${impact.risky ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
      <p className="font-semibold text-slate-900">Вплив перепланування</p>
      <ul className="mt-1 space-y-0.5 text-slate-700">
        <li>Зачеплені замовлення: {impact.affectedOrdersCount}</li>
        <li>Конфлікти дедлайнів: {impact.deadlineConflicts}</li>
        <li>Вплив на цех: {impact.workshopImpact}</li>
        <li>Дельта перевантаження: {impact.overloadDelta > 0 ? `+${impact.overloadDelta}` : impact.overloadDelta}</li>
        <li>Рішення: {impact.recommended ? "рекомендовано" : impact.risky ? "ризиковано" : "нейтрально"}</li>
      </ul>
    </div>
  );
}
