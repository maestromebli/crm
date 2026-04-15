"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { patchLeadEstimateById } from "../../../features/leads/lead-estimate-api";
import { postFormData, postJson } from "../../../lib/api/patch-json";
import { cn } from "../../../lib/utils";

type LineRow = {
  id?: string;
  type: string;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  costPrice: number | null;
  amountSale: number;
  amountCost: number | null;
  margin: number | null;
};

type EstPayload = {
  id: string;
  version: number;
  status: string;
  totalPrice?: number | null;
  totalCost?: number | null;
  grossMargin?: number | null;
  discountAmount?: number | null;
  deliveryCost?: number | null;
  installationCost?: number | null;
  notes?: string | null;
  lineItems?: LineRow[];
};

type AnalyzeEstimateFileResponse = {
  aiSummary?: string | null;
  draft?: {
    lines?: Array<{
      productName?: string;
      qty?: number;
      unit?: string;
      salePrice?: number;
    }>;
    assumptions?: string[];
  };
};

const btn =
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50";

export function LeadEstimateEditorClient({
  leadId,
  estimateId,
  leadTitle,
}: {
  leadId: string;
  estimateId: string;
  leadTitle: string;
}) {
  const router = useRouter();
  const [est, setEst] = useState<EstPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [delivery, setDelivery] = useState("0");
  const [install, setInstall] = useState("0");
  const [lineDrafts, setLineDrafts] = useState<
    Array<{
      productName: string;
      qty: string;
      unit: string;
      salePrice: string;
    }>
  >([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [matQ, setMatQ] = useState("");
  const [matHits, setMatHits] = useState<
    Array<{ id: string; label: string; hint?: string; unit?: string; unitPrice?: number }>
  >([]);
  const [fileBusy, setFileBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(
        `/api/leads/${leadId}/estimates/${estimateId}`,
      );
      const j = (await r.json()) as {
        estimate?: EstPayload;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      const e = j.estimate;
      if (!e) throw new Error("Немає даних смети");
      setEst(e);
      setNotes(String(e.notes ?? ""));
      setDiscount(String(e.discountAmount ?? 0));
      setDelivery(String(e.deliveryCost ?? 0));
      setInstall(String(e.installationCost ?? 0));
      setLineDrafts(
        (e.lineItems ?? []).map((li) => ({
          productName: li.productName,
          qty: String(li.qty),
          unit: li.unit || "шт",
          salePrice: String(li.salePrice),
        })),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setEst(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, estimateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveHeader = async () => {
    if (!est) return;
    setBusy(true);
    setErr(null);
    try {
      const j = await patchLeadEstimateById<{ estimate?: EstPayload }>(
        leadId,
        estimateId,
        {
          notes: notes.trim() || null,
          discountAmount: Number(discount) || 0,
          deliveryCost: Number(delivery) || 0,
          installationCost: Number(install) || 0,
        },
      );
      if (j.estimate) setEst(j.estimate);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const buildLineItemsPayload = () => {
    const out: Record<string, unknown>[] = [];
    for (const row of lineDrafts) {
      const name = row.productName.trim();
      if (!name) continue;
      const qty = Number(row.qty.replace(",", ".")) || 0;
      const salePrice = Number(row.salePrice.replace(",", ".")) || 0;
      const unit = row.unit.trim() || "шт";
      const amountSale = qty * salePrice;
      out.push({
        type: "PRODUCT",
        category: null,
        productName: name,
        qty,
        unit,
        salePrice,
        costPrice: null,
        amountSale,
        amountCost: null,
        margin: null,
      });
    }
    return out;
  };

  const saveLines = async () => {
    if (!est) return;
    setBusy(true);
    setErr(null);
    try {
      const lineItems = buildLineItemsPayload();
      const j = await patchLeadEstimateById<{ estimate?: EstPayload }>(
        leadId,
        estimateId,
        { lineItems },
      );
      if (j.estimate) {
        setEst(j.estimate);
        setLineDrafts(
          (j.estimate.lineItems ?? []).map((li) => ({
            productName: li.productName,
            qty: String(li.qty),
            unit: li.unit || "шт",
            salePrice: String(li.salePrice),
          })),
        );
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const addRow = () => {
    setLineDrafts((d) => [
      ...d,
      { productName: "", qty: "1", unit: "шт", salePrice: "0" },
    ]);
  };

  const runAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    setErr(null);
    try {
      const j = await postJson<{
        error?: string;
        draft?: {
          lines: Array<{
            productName: string;
            qty: number;
            unit: string;
            salePrice: number;
          }>;
          assumptions?: string[];
        };
      }>(`/api/leads/${leadId}/estimates/ai-draft`, { prompt: aiPrompt });
      const lines = j.draft?.lines ?? [];
      if (lines.length) {
        setLineDrafts(
          lines.map((l) => ({
            productName: l.productName,
            qty: String(l.qty),
            unit: l.unit || "шт",
            salePrice: String(l.salePrice),
          })),
        );
        if (j.draft?.assumptions?.length) {
          setNotes((n) =>
            [n.trim(), j.draft!.assumptions!.join("\n")].filter(Boolean).join("\n\n"),
          );
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setAiBusy(false);
    }
  };

  const importEstimateFromFile = async (file: File) => {
    setFileBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "CALCULATION");
      const uploaded = await postFormData<{ id?: string; fileName?: string }>(
        `/api/leads/${leadId}/attachments`,
        fd,
      );
      if (!uploaded.id) {
        throw new Error("Не вдалося завантажити файл");
      }
      const analyzed = await postJson<AnalyzeEstimateFileResponse>(
        `/api/leads/${leadId}/attachments/${uploaded.id}/analyze-estimate`,
        { apply: false },
      );
      const draftLines = analyzed.draft?.lines ?? [];
      if (draftLines.length === 0) {
        throw new Error("Не знайдено позицій у файлі прорахунку");
      }
      setLineDrafts(
        draftLines
          .map((line) => ({
            productName: String(line.productName ?? "").trim(),
            qty: String(
              typeof line.qty === "number" && Number.isFinite(line.qty)
                ? line.qty
                : 1,
            ),
            unit:
              typeof line.unit === "string" && line.unit.trim()
                ? line.unit.trim()
                : "шт",
            salePrice: String(
              typeof line.salePrice === "number" && Number.isFinite(line.salePrice)
                ? Math.max(0, line.salePrice)
                : 0,
            ),
          }))
          .filter((line) => line.productName.length > 0),
      );
      if (analyzed.draft?.assumptions?.length) {
        setNotes((n) =>
          [n.trim(), analyzed.draft!.assumptions!.join("\n")]
            .filter(Boolean)
            .join("\n\n"),
        );
      } else if (analyzed.aiSummary?.trim()) {
        setNotes((n) =>
          [n.trim(), analyzed.aiSummary!.trim()].filter(Boolean).join("\n\n"),
        );
      }
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Помилка імпорту файлу прорахунку",
      );
    } finally {
      setFileBusy(false);
    }
  };

  const searchMat = async () => {
    const q = matQ.trim();
    if (!q) {
      setMatHits([]);
      return;
    }
    try {
      const r = await fetch(
        `/api/materials/search?q=${encodeURIComponent(q)}&limit=12`,
      );
      const j = (await r.json()) as {
        items?: Array<{ id: string; label: string; hint?: string; unit?: string; unitPrice?: number }>;
      };
      if (r.ok) setMatHits(j.items ?? []);
    } catch {
      setMatHits([]);
    }
  };

  const pickMat = (h: {
    label: string;
    unit?: string;
    unitPrice?: number;
  }) => {
    setLineDrafts((d) => [
      ...d,
      {
        productName: h.label,
        qty: "1",
        unit: h.unit ?? "шт",
        salePrice: String(h.unitPrice ?? 0),
      },
    ]);
    setMatHits([]);
    setMatQ("");
  };

  const removeRow = (idx: number) => {
    setLineDrafts((d) => d.filter((_, i) => i !== idx));
  };

  const wrap =
    "rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm";

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <Link
          href={`/leads/${leadId}`}
          className="font-medium text-sky-800 underline underline-offset-2"
        >
          ← {leadTitle}
        </Link>
        <span className="text-slate-300">·</span>
        <span>Прорахунок на ліді</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Завантаження…</p>
      ) : err && !est ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </p>
      ) : est ? (
        <>
          {err ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {err}
            </p>
          ) : null}

          <div className={wrap}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-lg font-semibold text-slate-900">
                Версія {est.version}{" "}
                <span className="text-sm font-normal text-slate-500">
                  ({est.status})
                </span>
              </h1>
              {est.totalPrice != null ? (
                <p className="text-xl font-bold text-slate-900">
                  {est.totalPrice.toLocaleString("uk-UA")} грн
                </p>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="text-xs">
                <span className="text-slate-500">Знижка</span>
                <input
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                  inputMode="decimal"
                />
              </label>
              <label className="text-xs">
                <span className="text-slate-500">Доставка</span>
                <input
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                  inputMode="decimal"
                />
              </label>
              <label className="text-xs">
                <span className="text-slate-500">Монтаж</span>
                <input
                  value={install}
                  onChange={(e) => setInstall(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1"
                  inputMode="decimal"
                />
              </label>
            </div>
            <label className="mt-2 block text-xs">
              <span className="text-slate-500">Нотатки</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              className={cn(btn, "mt-2")}
              onClick={() => void saveHeader()}
            >
              Зберегти знижку / доставку / нотатки
            </button>
          </div>

          <div className={wrap}>
            <h2 className="font-semibold text-slate-900">Швидкий ввід</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Текстовий опис проєкту → чернетка рядків (без зовнішнього GPT).
              Каталог — локальний кеш постачальників.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                void importEstimateFromFile(file);
                e.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              disabled={fileBusy}
              className={cn(btn, "mt-2")}
              onClick={() => fileInputRef.current?.click()}
            >
              {fileBusy ? "Обробка файлу…" : "Завантажити файл прорахунку"}
            </button>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={2}
              placeholder="Напр.: кухня 3м, ДСП Egger, фасади фарбований МДФ, фурнітура Blum…"
              className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={aiBusy}
              className={cn(btn, "mt-2")}
              onClick={() => void runAiDraft()}
            >
              {aiBusy ? "Розбір…" : "Застосувати текст до позицій"}
            </button>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[11px] font-medium text-slate-700">
                Пошук у каталозі
              </p>
              <div className="mt-1 flex gap-2">
                <input
                  value={matQ}
                  onChange={(e) => setMatQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchMat();
                  }}
                  placeholder="Egger, Blum, ДСП…"
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void searchMat()}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  Знайти
                </button>
              </div>
              {matHits.length > 0 ? (
                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs">
                  {matHits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className="w-full rounded px-1 py-0.5 text-left hover:bg-white"
                        onClick={() => pickMat(h)}
                      >
                        <span className="font-medium">{h.label}</span>
                        {h.hint ? (
                          <span className="text-slate-500"> — {h.hint}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className={wrap}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">Позиції</h2>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                onClick={addRow}
              >
                + Рядок
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Швидке редагування: назва, кількість, ціна за од. — сума
              рахується автоматично. Підтримка змін клієнта без ERP-форм.
            </p>
            <div className="mt-3 space-y-2">
              {lineDrafts.length === 0 ? (
                <p className="text-xs text-slate-500">Немає рядків.</p>
              ) : (
                lineDrafts.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2"
                  >
                    <label className="min-w-[160px] flex-1 text-[11px]">
                      <span className="text-slate-500">Назва</span>
                      <input
                        value={row.productName}
                        onChange={(e) =>
                          setLineDrafts((d) => {
                            const n = [...d];
                            n[idx] = { ...n[idx], productName: e.target.value };
                            return n;
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-sm"
                      />
                    </label>
                    <label className="w-16 text-[11px]">
                      <span className="text-slate-500">К-ть</span>
                      <input
                        value={row.qty}
                        onChange={(e) =>
                          setLineDrafts((d) => {
                            const n = [...d];
                            n[idx] = { ...n[idx], qty: e.target.value };
                            return n;
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-sm"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="w-14 text-[11px]">
                      <span className="text-slate-500">Од.</span>
                      <input
                        value={row.unit}
                        onChange={(e) =>
                          setLineDrafts((d) => {
                            const n = [...d];
                            n[idx] = { ...n[idx], unit: e.target.value };
                            return n;
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-sm"
                      />
                    </label>
                    <label className="w-24 text-[11px]">
                      <span className="text-slate-500">Ціна/од.</span>
                      <input
                        value={row.salePrice}
                        onChange={(e) =>
                          setLineDrafts((d) => {
                            const n = [...d];
                            n[idx] = { ...n[idx], salePrice: e.target.value };
                            return n;
                          })
                        }
                        className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-sm"
                        inputMode="decimal"
                      />
                    </label>
                    <button
                      type="button"
                      className="mb-0.5 text-[11px] text-rose-700 underline"
                      onClick={() => removeRow(idx)}
                    >
                      Видалити
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              className={cn(btn, "mt-3")}
              onClick={() => void saveLines()}
            >
              Зберегти позиції
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
