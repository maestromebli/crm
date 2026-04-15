"use client";

import { useState } from "react";
import { contractsApi } from "../../lib/contracts-api";

export function ManagerReviewActions({ contractId }: { contractId: string }) {
  const [state, setState] = useState<string | null>(null);

  async function runAction(action: "generate" | "review" | "approve") {
    setState("Виконання...");
    try {
      if (action === "generate") {
        await contractsApi.generateDocuments(contractId);
        setState("PDF snapshots згенеровано");
      }
      if (action === "review") {
        await contractsApi.sendForReview(contractId);
        setState("Договір переведено в UNDER_REVIEW");
      }
      if (action === "approve") {
        await contractsApi.approve(contractId);
        setState("Договір погоджено");
      }
    } catch (error) {
      setState(error instanceof Error ? error.message : "Помилка виконання");
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-base font-semibold">Перевірка менеджером</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-md border px-3 py-2 text-sm" onClick={() => runAction("generate")}>
          Генерувати документи
        </button>
        <button className="rounded-md border px-3 py-2 text-sm" onClick={() => runAction("review")}>
          Відправити на review
        </button>
        <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white" onClick={() => runAction("approve")}>
          Підтвердити та відправити
        </button>
      </div>
      {state ? <p className="mt-2 text-sm text-slate-600">{state}</p> : null}
    </div>
  );
}
