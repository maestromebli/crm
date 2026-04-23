"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api/patch-json";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

type Line = {
  category: string;
  itemType: string;
  name: string;
  article: string;
  unit: string;
  qty: number;
  plannedUnitCost: number;
  supplier: string;
  comment: string;
};

export type ProcurementRequestDrawerProps = {
  /** Відкрити панель (наприклад `?newRequest=1` у URL). */
  defaultOpen?: boolean;
  /** Попередньо обрати замовлення (`?dealId=` з робочого місця замовлення). */
  initialDealId?: string;
};

export function ProcurementRequestDrawer({
  defaultOpen = false,
  initialDealId,
}: ProcurementRequestDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [dealId, setDealId] = useState(initialDealId?.trim() ?? "");
  const [deals, setDeals] = useState<Array<{ id: string; title: string }>>([]);
  const [neededByDate, setNeededByDate] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [headerComment, setHeaderComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([
    {
      category: "ДСП",
      itemType: "MATERIAL",
      name: "",
      article: "",
      unit: "шт",
      qty: 1,
      plannedUnitCost: 0,
      supplier: "",
      comment: "",
    },
  ]);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/crm/procurement/deals");
        const j = (await r.json()) as { deals?: Array<{ id: string; title: string }> };
        if (!cancelled && r.ok && j.deals) setDeals(j.deals);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = initialDealId?.trim();
    if (!id) return;
    if (deals.length === 0) {
      setDealId(id);
      return;
    }
    if (deals.some((d) => d.id === id)) setDealId(id);
  }, [initialDealId, deals]);

  const total = useMemo(
    () => lines.reduce((acc, l) => acc + l.qty * l.plannedUnitCost, 0),
    [lines],
  );

  async function submit() {
    setError(null);
    if (!dealId.trim()) {
      setError("Оберіть замовлення (проєкт).");
      return;
    }
    const payloadLines = lines
      .filter((l) => l.name.trim().length > 0)
      .map((l) => ({
        name: l.name.trim(),
        qty: l.qty,
        plannedUnitCost: l.plannedUnitCost,
      }));
    if (payloadLines.length === 0) {
      setError("Додайте хоча б одну позицію з назвою.");
      return;
    }
    setSaving(true);
    try {
      await postJson<{ ok?: boolean }>("/api/crm/procurement/requests", {
        dealId: dealId.trim(),
        lines: payloadLines,
        neededByDate: neededByDate || null,
        priority,
        comment: headerComment || null,
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Створити заявку
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-[var(--enver-card)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Нова заявка на закупку</h3>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Закрити </Button>
            </div>

            {error ? (
              <div className="mb-2 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
                {error}
              </div>
            ) : null}

            <label className="block text-[11px] font-medium text-slate-600">Замовлення (проєкт)</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs"
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
            >
              <option value="">— Оберіть замовлення —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            {deals.length === 0 ? (
              <p className="mt-1 text-[11px] text-amber-800">
                Список замовлень порожній або БД недоступна. Перевірте підключення та наявність замовлень у CRM.
              </p>
            ) : null}

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div>
                <label className="text-[11px] text-slate-600">Потрібно до</label>
                <Input
                  type="date"
                  className="mt-1 h-9 text-xs"
                  value={neededByDate}
                  onChange={(e) => setNeededByDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600">Пріоритет</label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-xs"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="LOW">Низький</option>
                  <option value="MEDIUM">Середній</option>
                  <option value="HIGH">Високий</option>
                  <option value="CRITICAL">Критичний</option>
                </select>
              </div>
              <div className="md:col-span-1" />
            </div>
            <div className="mt-2">
              <label className="text-[11px] text-slate-600">Коментар до заявки</label>
              <Input
                placeholder="Контекст для закупівель"
                className="mt-1 h-9 text-xs"
                value={headerComment}
                onChange={(e) => setHeaderComment(e.target.value)}
              />
            </div>

            <div className="mt-4 space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid gap-2 rounded border border-slate-200 p-2 md:grid-cols-12">
                  <Input
                    className="md:col-span-2 h-8 text-xs"
                    value={line.category}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx].category = e.target.value;
                      setLines(next);
                    }}
                    placeholder="Категорія"
                  />
                  <Input
                    className="md:col-span-2 h-8 text-xs"
                    value={line.name}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx].name = e.target.value;
                      setLines(next);
                    }}
                    placeholder="Позиція"
                  />
                  <Input
                    className="md:col-span-1 h-8 text-xs"
                    value={line.unit}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx].unit = e.target.value;
                      setLines(next);
                    }}
                    placeholder="Од."
                  />
                  <Input
                    className="md:col-span-1 h-8 text-xs"
                    type="number"
                    value={line.qty}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx].qty = Number(e.target.value);
                      setLines(next);
                    }}
                    placeholder="К-сть"
                  />
                  <Input
                    className="md:col-span-2 h-8 text-xs"
                    type="number"
                    value={line.plannedUnitCost}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx].plannedUnitCost = Number(e.target.value);
                      setLines(next);
                    }}
                    placeholder="План / од."
                  />
                  <div className="md:col-span-2 flex items-center rounded border border-slate-200 px-2 text-xs">
                    {(line.qty * line.plannedUnitCost).toLocaleString("uk-UA")} грн
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="md:col-span-2"
                    type="button"
                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  >
                    Видалити
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() =>
                  setLines([
                    ...lines,
                    {
                      category: "ДСП",
                      itemType: "MATERIAL",
                      name: "",
                      article: "",
                      unit: "шт",
                      qty: 1,
                      plannedUnitCost: 0,
                      supplier: "",
                      comment: "",
                    },
                  ])
                }
              >
                Додати рядок
              </Button>
              <div className="text-sm font-semibold">Разом план: {total.toLocaleString("uk-UA")} грн</div>
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3">
              <Button variant="outline" size="sm" type="button" onClick={() => setOpen(false)}>
                Скасувати
              </Button>
              <Button size="sm" type="button" disabled={saving} onClick={() => void submit()}>
                {saving ? "Збереження…" : "Зберегти заявку"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
