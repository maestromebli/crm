"use client";

import { useMemo, useState } from "react";
import { contractsApi } from "../../lib/contracts-api";
import { ContractEntity } from "./types";

interface ContractFormProps {
  contract: ContractEntity;
}

export function ContractForm({ contract }: ContractFormProps) {
  const [state, setState] = useState({
    contractNumber: contract.contractNumber,
    contractDate: contract.contractDate.slice(0, 10),
    objectAddress: contract.objectAddress ?? "",
    deliveryAddress: contract.deliveryAddress ?? "",
    totalAmount: String(contract.totalAmount),
    advanceAmount: String(contract.advanceAmount),
    remainingAmount: String(contract.remainingAmount),
    productionLeadTimeDays: String(contract.productionLeadTimeDays ?? ""),
    installationLeadTime: contract.installationLeadTime ?? "",
    paymentTerms: contract.paymentTerms ?? "",
    warrantyMonths: String(contract.warrantyMonths ?? ""),
    managerComment: contract.managerComment ?? "",
    specialConditions: contract.specialConditions ?? "",
    supplierSignerName: contract.supplierSignerName ?? "",
    supplierSignerBasis: contract.supplierSignerBasis ?? ""
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const derivedRemaining = useMemo(() => {
    const total = Number(state.totalAmount) || 0;
    const advance = Number(state.advanceAmount) || 0;
    return (total - advance).toFixed(2);
  }, [state.totalAmount, state.advanceAmount]);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      await contractsApi.updateContract(contract.id, {
        fields: {
          contractNumber: state.contractNumber,
          contractDate: state.contractDate,
          objectAddress: state.objectAddress,
          deliveryAddress: state.deliveryAddress,
          totalAmount: Number(state.totalAmount),
          advanceAmount: Number(state.advanceAmount),
          remainingAmount: Number(derivedRemaining),
          productionLeadTimeDays: Number(state.productionLeadTimeDays) || undefined,
          installationLeadTime: state.installationLeadTime,
          paymentTerms: state.paymentTerms,
          warrantyMonths: Number(state.warrantyMonths) || undefined,
          managerComment: state.managerComment,
          specialConditions: state.specialConditions,
          supplierSignerName: state.supplierSignerName,
          supplierSignerBasis: state.supplierSignerBasis
        }
      });
      setMessage("Збережено");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold">Редагування полів договору</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(state).map(([key, value]) => (
          <label key={key} className="space-y-1 text-sm">
            <span className="text-slate-600">{key}</span>
            <input
              value={value}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  [key]: event.target.value
                }))
              }
              className="w-full rounded-md border px-3 py-2"
            />
          </label>
        ))}
      </div>
      <p className="text-sm text-slate-600">Розрахований залишок: {derivedRemaining}</p>
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {saving ? "Збереження..." : "Зберегти"}
      </button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
