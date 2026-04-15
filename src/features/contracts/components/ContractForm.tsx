"use client";

import { useMemo, useState } from "react";
import type { ContractViewModel } from "../types";

export function ContractForm({ contract }: { contract: ContractViewModel }) {
  const [fields, setFields] = useState<Record<string, unknown>>(contract.fields);
  const [status, setStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const calculatedRemaining = useMemo(() => {
    const total = Number(fields.totalAmount ?? 0);
    const advance = Number(fields.advanceAmount ?? 0);
    return (total - advance).toFixed(2);
  }, [fields.totalAmount, fields.advanceAmount]);

  const fieldLabels: Record<string, string> = {
    contractNumber: "Номер договору",
    contractDate: "Дата договору",
    customerFullName: "ПІБ клієнта",
    customerTaxId: "ІПН клієнта",
    customerPhone: "Телефон клієнта",
    customerEmail: "Email клієнта",
    objectAddress: "Адреса обʼєкта",
    deliveryAddress: "Адреса доставки",
    totalAmount: "Загальна сума",
    advanceAmount: "Аванс",
    productionLeadTimeDays: "Строк виробництва (днів)",
    installationLeadTime: "Строк монтажу",
    paymentTerms: "Умови оплати",
    warrantyMonths: "Гарантія (місяців)",
    managerComment: "Коментар менеджера",
    specialConditions: "Спеціальні умови",
    supplierSignerName: "Підписант постачальника",
    supplierSignerBasis: "Підстава підписанта",
  };

  async function save() {
    setSaving(true);
    setStatus("");
    const res = await fetch(`/api/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          ...fields,
          remainingAmount: Number(calculatedRemaining),
        },
      }),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    setStatus(res.ok ? "Збережено" : data.error ?? "Помилка збереження");
  }

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Поля договору</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          "contractNumber",
          "contractDate",
          "customerFullName",
          "customerTaxId",
          "customerPhone",
          "customerEmail",
          "objectAddress",
          "deliveryAddress",
          "totalAmount",
          "advanceAmount",
          "productionLeadTimeDays",
          "installationLeadTime",
          "paymentTerms",
          "warrantyMonths",
          "managerComment",
          "specialConditions",
          "supplierSignerName",
          "supplierSignerBasis",
        ].map((key) => (
          <label key={key} className="space-y-1 text-sm">
            <span className="text-slate-600">{fieldLabels[key] ?? key}</span>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={String(fields[key] ?? "")}
              onChange={(event) =>
                setFields((prev) => ({
                  ...prev,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>
      <p className="text-sm text-slate-600">Розрахований залишок: {calculatedRemaining}</p>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Збереження..." : "Зберегти"}
      </button>
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
    </section>
  );
}
