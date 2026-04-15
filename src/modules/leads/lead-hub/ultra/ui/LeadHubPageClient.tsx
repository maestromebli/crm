"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLeadHubQuery } from "../hooks/useLeadHubQuery";
import { useLeadHubStore } from "../hooks/useLeadHubStore";
import { usePricingCalculation } from "../hooks/usePricingCalculation";
import { useLeadHubAutosave } from "../hooks/useLeadHubAutosave";
import type { LeadHubPricingItem } from "../domain/types";
import { calculatePricingLineMetrics } from "../services/pricing-line";
import {
  fillMissing,
  generateFromFile,
  generateFromImage,
  optimizePrice,
  reduceCost,
} from "../ai";
import { parseExcel, parseImage, parsePDF } from "../parsing";

function Money({ value, currency }: { value: number; currency: string }) {
  return (
    <span>
      {new Intl.NumberFormat("uk-UA", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value)}
    </span>
  );
}

function savePricingSession(pricingSessionId: string, items: LeadHubPricingItem[]) {
  return fetch("/api/pricing/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pricingSessionId,
      items,
      summaryNote: "Autosave from Lead Hub workspace",
    }),
  });
}

async function uploadLeadHubFile(params: {
  sessionId: string;
  role: "IMAGE" | "CALC_SOURCE" | "DOC";
  file: File;
}) {
  const form = new FormData();
  form.append("sessionId", params.sessionId);
  form.append("role", params.role);
  form.append("file", params.file);

  const response = await fetch("/api/lead-hub/upload", {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

  return (await response.json()) as {
    ok: boolean;
    file: {
      id: string;
      role: "IMAGE" | "CALC_SOURCE" | "DOC";
      fileName: string;
      fileUrl: string;
      mimeType: string;
    };
  };
}

export function LeadHubPageClient({ id }: { id: string }) {
  const query = useLeadHubQuery(id);
  const setSession = useLeadHubStore((s) => s.setSession);
  const session = useLeadHubStore((s) => s.session);
  const pricingState = useLeadHubStore((s) => s.pricingState);
  const syncState = useLeadHubStore((s) => s.syncState);
  const updateItem = useLeadHubStore((s) => s.updateItem);
  const addItem = useLeadHubStore((s) => s.addItem);
  const removeItem = useLeadHubStore((s) => s.removeItem);
  const setFiles = useLeadHubStore((s) => s.setFiles);
  const setImages = useLeadHubStore((s) => s.setImages);
  const applyAIResult = useLeadHubStore((s) => s.applyAIResult);
  const applyParsedTemplate = useLeadHubStore((s) => s.applyParsedTemplate);
  const [activeDrawerTab, setActiveDrawerTab] = useState<
    "ai" | "parse" | "versions" | "breakdown"
  >("ai");
  const [aiExplanation, setAiExplanation] = useState("");
  const [contextNotes, setContextNotes] = useState("");

  useEffect(() => {
    if (query.data && (!session || session.id !== query.data.id)) {
      setSession(query.data);
    }
  }, [query.data, session, setSession]);

  usePricingCalculation();
  useLeadHubAutosave();

  const totals = session?.totals;
  const currency = session?.currency ?? "UAH";

  const imageFiles = useMemo(
    () => (session?.files ?? []).filter((file) => file.role === "IMAGE"),
    [session?.files],
  );

  async function onRunAiAction(action: "optimize" | "reduce" | "fill" | "image" | "file") {
    if (!session) return;

    let nextItems = pricingState;
    if (action === "optimize") nextItems = await optimizePrice(pricingState);
    if (action === "reduce") nextItems = await reduceCost(pricingState);
    if (action === "fill") nextItems = await fillMissing(pricingState);
    if (action === "image") nextItems = await generateFromImage(pricingState);
    if (action === "file") nextItems = await generateFromFile(pricingState);

    applyAIResult(nextItems, action);
    await savePricingSession(session.pricingSessionId, nextItems);
    setAiExplanation(
      `AI action "${action}" applied to ${nextItems.length} pricing lines.`,
    );
  }

  async function onParseFile(file: File) {
    const mime = file.type.toLowerCase();
    if (mime.includes("image")) {
      const parsed = await parseImage(file);
      applyParsedTemplate({ items: parsed.items, source: "image" });
    } else if (mime.includes("sheet") || file.name.endsWith(".xlsx")) {
      const parsed = await parseExcel(file);
      applyParsedTemplate({ items: parsed.items, source: "excel" });
    } else {
      const parsed = await parsePDF(file);
      applyParsedTemplate({ items: parsed.items, source: "pdf" });
    }
  }

  async function onUploadAndProcess(file: File, role: "IMAGE" | "CALC_SOURCE" | "DOC") {
    if (!session) return;
    const uploaded = await uploadLeadHubFile({
      sessionId: session.id,
      role,
      file,
    });
    const nextFiles = [
      {
        id: uploaded.file.id,
        role: uploaded.file.role,
        fileName: uploaded.file.fileName,
        fileUrl: uploaded.file.fileUrl,
        mimeType: uploaded.file.mimeType,
        createdAt: new Date().toISOString(),
      },
      ...session.files,
    ];
    setFiles(nextFiles);
    setImages(nextFiles.filter((item) => item.role === "IMAGE"));
    await onParseFile(file);
  }

  if (query.isLoading || !session || !totals) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Ultra Lead Hub...
        </div>
      </div>
    );
  }

  return (
    <div className="lead-hub-root space-y-4 p-4 md:p-6">
      <header className="leadhub-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="enver-eyebrow">Pricing-first Lead Hub</p>
            <h1 className="text-2xl font-semibold">{session.title ?? "Lead Hub"}</h1>
            <p className="text-sm text-slate-600">
              Session #{session.id.slice(0, 8)} · status {session.status}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {syncState.isSaving
                ? "Saving..."
                : syncState.lastError
                  ? `Sync error: ${syncState.lastError}`
                  : syncState.lastSavedAt
                    ? `Synced at ${new Date(syncState.lastSavedAt).toLocaleTimeString("uk-UA")}`
                    : "No sync yet"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => addItem()}>
              Add line
            </Button>
            <Button
              onClick={async () => {
                await savePricingSession(session.pricingSessionId, pricingState);
              }}
            >
              Save snapshot
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside className="leadhub-card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Left Panel</h2>
          <div className="leadhub-card-soft p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">Image uploader</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-slate-50">
              <Upload className="h-4 w-4" />
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await onUploadAndProcess(file, "IMAGE");
                }}
              />
            </label>
          </div>
          <div className="leadhub-card-soft p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">File uploader</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-slate-50">
              <Upload className="h-4 w-4" />
              Upload calc source
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await onUploadAndProcess(file, "CALC_SOURCE");
                }}
              />
            </label>
          </div>
          <div className="leadhub-card-soft p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">Context inputs</p>
            <Textarea
              value={contextNotes}
              onChange={(e) => setContextNotes(e.target.value)}
              rows={6}
              placeholder="Budget, object dimensions, constraints..."
            />
          </div>
          <div className="leadhub-card-soft p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">Image preview</p>
            <div className="grid grid-cols-3 gap-2">
              {imageFiles.slice(0, 6).map((file) => (
                <img
                  key={file.id}
                  src={file.fileUrl}
                  alt={file.fileName}
                  className="h-20 w-full rounded-md object-cover"
                />
              ))}
            </div>
          </div>
        </aside>

        <main className="leadhub-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Center Panel · Pricing Workspace</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Cost</th>
                  <th className="px-3 py-2 text-left">Price</th>
                  <th className="px-3 py-2 text-left">Margin</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pricingState.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <Input
                        value={row.name}
                        onChange={(e) => updateItem(row.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={row.quantity}
                        onChange={(e) =>
                          updateItem(row.id, { quantity: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={row.unitCost}
                        onChange={(e) =>
                          updateItem(row.id, { unitCost: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={row.unitPrice}
                        onChange={(e) =>
                          updateItem(row.id, { unitPrice: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      {session.canViewMargin ? (
                        <div className="rounded-md bg-slate-100 px-2 py-1 text-xs">
                          {calculatePricingLineMetrics(row).lineMarginPercent.toFixed(1)}%
                        </div>
                      ) : (
                        <div className="rounded-md bg-slate-100 px-2 py-1 text-xs">
                          Hidden
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(row.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        <aside className="leadhub-card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Right Panel</h2>
          <div className="leadhub-card-soft space-y-2 p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Totals Panel</p>
            <div className="text-sm">
              Revenue: <Money value={totals.totalRevenue} currency={currency} />
            </div>
            <div className="text-sm">
              Cost: <Money value={totals.totalCost} currency={currency} />
            </div>
            {session.canViewMargin && (
              <>
                <div className="text-sm">
                  Profit: <Money value={totals.grossProfit} currency={currency} />
                </div>
                <div className="text-sm">Margin: {totals.marginPercent.toFixed(1)}%</div>
              </>
            )}
          </div>
          <div className="leadhub-card-soft p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Margin Indicator</p>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div
                className={cn(
                  "h-full rounded-full",
                  totals.marginPercent < 12
                    ? "bg-red-500"
                    : totals.marginPercent < 20
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
                style={{
                  width: `${Math.max(4, Math.min(100, totals.marginPercent))}%`,
                }}
              />
            </div>
          </div>
          <div className="leadhub-card-soft p-3">
            <p className="text-xs font-medium uppercase text-slate-500">Alerts Panel</p>
            <ul className="mt-2 space-y-2 text-xs">
              {session.summary.topRiskItems.length === 0 && (
                <li className="rounded-md bg-emerald-50 p-2 text-emerald-700">
                  No risk alerts
                </li>
              )}
              {session.summary.topRiskItems.map((risk) => (
                <li key={risk.id} className="rounded-md bg-amber-50 p-2 text-amber-800">
                  <div className="font-medium">{risk.name}</div>
                  <div>{risk.reason}</div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <section className="leadhub-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[
            { id: "ai", label: "AI Panel" },
            { id: "parse", label: "File Parse Result" },
            { id: "versions", label: "Version History" },
            { id: "breakdown", label: "Breakdown" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveDrawerTab(tab.id as typeof activeDrawerTab)}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                activeDrawerTab === tab.id
                  ? "bg-[var(--enver-accent)] text-white"
                  : "bg-slate-100 text-slate-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeDrawerTab === "ai" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Button variant="outline" onClick={() => onRunAiAction("optimize")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Optimize price
              </Button>
              <Button variant="outline" onClick={() => onRunAiAction("reduce")}>
                <Wand2 className="mr-2 h-4 w-4" />
                Reduce cost
              </Button>
              <Button variant="outline" onClick={() => onRunAiAction("fill")}>
                Fill missing
              </Button>
              <Button variant="outline" onClick={() => onRunAiAction("image")}>
                Generate from image
              </Button>
              <Button variant="outline" onClick={() => onRunAiAction("file")}>
                Generate from file
              </Button>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
              {aiExplanation || "Run an AI action to get pricing explanation here."}
            </div>
          </div>
        )}

        {activeDrawerTab === "parse" && (
          <div className="text-sm text-slate-700">
            Last parser: {useLeadHubStore.getState().parseState.lastParsedType ?? "none"}
          </div>
        )}

        {activeDrawerTab === "versions" && (
          <div className="text-sm text-slate-700">
            Current workspace autosaves each change. API creates immutable pricing
            versions on every save/calculate call.
          </div>
        )}

        {activeDrawerTab === "breakdown" && (
          <div className="grid gap-2 text-sm">
            {pricingState.map((item) => {
              const metrics = calculatePricingLineMetrics(item);
              return (
                <div key={item.id} className="rounded-md border bg-slate-50 p-2">
                  <div className="font-medium">{item.name}</div>
                  <div>
                    Cost {metrics.lineCost.toFixed(2)} · Revenue{" "}
                    {metrics.lineRevenue.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
