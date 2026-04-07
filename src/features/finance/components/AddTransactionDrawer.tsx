"use client";

import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import type { FinanceTransactionType } from "../types/models";

type Props = {
  onCreate?: (payload: Record<string, string>) => void;
};

export function AddTransactionDrawer({ onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FinanceTransactionType>("INCOME");

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Додати транзакцію
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Нова транзакція</h3>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Закрити
              </Button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs">
                Тип
                <select
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-xs"
                  value={type}
                  onChange={(e) => setType(e.target.value as FinanceTransactionType)}
                >
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                  <option value="PAYROLL">PAYROLL</option>
                  <option value="COMMISSION">COMMISSION</option>
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="REFUND">REFUND</option>
                </select>
              </label>
              <label className="text-xs">
                Сума
                <Input className="mt-1 h-9 text-xs" placeholder="0.00" />
              </label>
              <label className="text-xs">
                Дата
                <Input className="mt-1 h-9 text-xs" type="date" />
              </label>
              {type === "PAYROLL" ? (
                <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  Payroll-режим: заповніть роль працівника та тип розрахунку.
                </p>
              ) : null}
              {type === "COMMISSION" ? (
                <p className="rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
                  Commission-режим: вкажіть отримувача і базу розрахунку.
                </p>
              ) : null}
              <Button
                onClick={() => {
                  onCreate?.({});
                  setOpen(false);
                }}
              >
                Зберегти
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

