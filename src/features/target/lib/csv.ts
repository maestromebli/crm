import type { DemoCampaign } from "../types";

function cell(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCampaignsCsv(rows: DemoCampaign[]): string {
  const BOM = "\uFEFF";
  const header = [
    "Кампанія",
    "Статус",
    "Ціль",
    "Бюджет/день UAH",
    "Витрати UAH",
    "Ліди",
    "CPL UAH",
    "Канал",
  ];
  const lines = [
    header.join(";"),
    ...rows.map((c) =>
      [
        c.name,
        c.status,
        c.objective,
        String(c.budgetDailyUah),
        String(c.spendUah),
        String(c.leads),
        c.cplUah != null ? String(c.cplUah) : "",
        c.channel,
      ]
        .map((x) => cell(x))
        .join(";"),
    ),
  ];
  return BOM + lines.join("\n");
}
