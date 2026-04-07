"use client";

import { useMemo, useState } from "react";
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

export function ProcurementRequestDrawer() {
  const [open, setOpen] = useState(false);
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

  const total = useMemo(
    () => lines.reduce((acc, l) => acc + l.qty * l.plannedUnitCost, 0),
    [lines],
  );

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Створити заявку
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Нова заявка на закупку</h3>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Закрити
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <Input placeholder="Проєкт" className="h-9 text-xs" />
              <Input placeholder="Обʼєкт (опц.)" className="h-9 text-xs" />
              <Input type="date" className="h-9 text-xs" />
            </div>
            <Input placeholder="Коментар" className="mt-2 h-9 text-xs" />

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
                  <Input className="md:col-span-2 h-8 text-xs" value={line.name} onChange={(e) => {
                    const next = [...lines];
                    next[idx].name = e.target.value;
                    setLines(next);
                  }} placeholder="Позиція" />
                  <Input className="md:col-span-1 h-8 text-xs" value={line.unit} onChange={(e) => {
                    const next = [...lines];
                    next[idx].unit = e.target.value;
                    setLines(next);
                  }} placeholder="Од." />
                  <Input className="md:col-span-1 h-8 text-xs" type="number" value={line.qty} onChange={(e) => {
                    const next = [...lines];
                    next[idx].qty = Number(e.target.value);
                    setLines(next);
                  }} placeholder="Qty" />
                  <Input className="md:col-span-2 h-8 text-xs" type="number" value={line.plannedUnitCost} onChange={(e) => {
                    const next = [...lines];
                    next[idx].plannedUnitCost = Number(e.target.value);
                    setLines(next);
                  }} placeholder="План / од." />
                  <div className="md:col-span-2 flex items-center rounded border border-slate-200 px-2 text-xs">
                    {(line.qty * line.plannedUnitCost).toLocaleString("uk-UA")} UAH
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="md:col-span-2"
                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  >
                    Видалити
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
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
              <div className="text-sm font-semibold">Разом план: {total.toLocaleString("uk-UA")} UAH</div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

