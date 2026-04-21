import type { PhoneDuplicateMatch } from "../../../lib/leads/phone-check-matches";

export type DuplicateMatches = PhoneDuplicateMatch[];

type DuplicateWarningProps = {
  loading: boolean;
  matches: DuplicateMatches | null;
};

function formatDealValue(m: PhoneDuplicateMatch): string | null {
  if (m.type !== "deal" || m.value == null) return null;
  const n = m.value.toLocaleString("uk-UA", { maximumFractionDigits: 2 });
  const cur = m.currency?.trim();
  return cur ? `${n} ${cur}` : n;
}

export function DuplicateWarning({ loading, matches }: DuplicateWarningProps) {
  if (loading) {
    return (
      <p className="text-[10px] text-slate-500">Перевірка дублів…</p>
    );
  }

  if (!matches?.length) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-950">
      <p className="font-semibold">Можливі збіги</p>
      <ul className="mt-1 list-inside list-disc">
        {matches.map((m) => {
          const dealVal = formatDealValue(m);
          const suffix = dealVal ? ` — ${dealVal}` : "";
          if (m.type === "lead") {
            return (
              <li key={`lead-${m.id}`}>
                Лід:{" "}
                <a href={`/leads/${m.id}`} className="font-medium underline">
                  {m.name}
                </a>
                {suffix}
              </li>
            );
          }
          if (m.type === "contact") {
            return (
              <li key={`contact-${m.id}`}>
                Контакт:{" "}
                <a href={`/contacts/${m.id}`} className="font-medium underline">
                  {m.name}
                </a>
                {suffix}
              </li>
            );
          }
          return (
            <li key={`deal-${m.id}`}>
              Замовлення:{" "}
              <a
                href={`/deals/${m.id}/workspace`}
                className="font-medium underline"
              >
                {m.name}
              </a>
              {suffix}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
