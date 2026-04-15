"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ConstructorApprovalReview } from "../constructor-hub.types";

const approvalChecklist = [
  "Розміри перевірені",
  "Матеріали збігаються",
  "Фурнітура підтверджена",
  "Техніка врахована",
  "Монтажні ризики описані",
  "Специфікація повна",
  "Файли достатні для запуску",
  "Коментарі до версії заповнені",
];

export function ConstructorApprovalPanel({
  reviews,
  onApprove,
  onReturn,
}: {
  reviews: ConstructorApprovalReview[];
  onApprove?: () => void;
  onReturn?: (payload: { reason: string; severity: string; remarks: string[] }) => void;
}) {
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState("MAJOR");
  const [remarks, setRemarks] = useState("");

  return (
    <section id="approval" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Перевірка і погодження</h3>

      <ul className="grid gap-1.5 text-xs md:grid-cols-2">
        {approvalChecklist.map((item) => (
          <li key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">
            {item}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onApprove?.()}>Прийняти</Button>
        <Button
          variant="outline"
          onClick={() =>
            onReturn?.({
              reason: reason.trim(),
              severity,
              remarks: remarks
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
        >
          Повернути на доопрацювання
        </Button>
        <Button variant="ghost">Залишити зауваження</Button>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
        <p className="text-xs font-semibold text-rose-900">Повернення на доопрацювання</p>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Причина повернення"
          className="mt-2 w-full rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm"
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="mt-2 rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="MINOR">MINOR</option>
          <option value="MAJOR">MAJOR</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="Список зауважень (кожне з нового рядка)"
          className="mt-2 w-full rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Історія ревізій</p>
        <ul className="space-y-2 text-xs">
          {reviews.length === 0 ? <li className="text-slate-500">Ревізій поки немає.</li> : null}
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <p className="font-medium text-slate-900">{review.reviewerName}</p>
              <p className="mt-0.5 text-slate-700">
                {review.decision}
                {review.severity ? ` · ${review.severity}` : ""}
              </p>
              {review.reason ? <p className="mt-1 text-slate-600">{review.reason}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
