"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { patchLeadEstimateById } from "../../../../features/leads/lead-estimate-api";
import { postJson } from "../../../../lib/api/patch-json";
import { buildEstimateLinePayload } from "../../../../lib/estimates/build-estimate-line-payload";
import type { EstimateCategoryKey } from "../../../../lib/estimates/estimate-categories";
import { estimateVersionPreviewStorageKey } from "../../../../lib/estimates/estimate-version-preview-storage";
import {
  apiLineToSnapshotLine,
  draftLikeToSnapshotLine,
} from "../../../../lib/estimates/estimate-preview-snapshot";
import {
  computeEstimateLineDiff,
  type DiffRow,
  type SnapshotLine,
} from "../../../../lib/estimates/estimate-version-diff";
import { CreateProposalModal } from "../CreateProposalModal";
import { CreateNewVersionPanel } from "./CreateNewVersionPanel";
import { CurrentEstimatePanel } from "./CurrentEstimatePanel";
import { EstimateComparisonStrip } from "./EstimateComparisonStrip";
import { EstimateInfoBanner } from "./EstimateInfoBanner";
import {
  EstimateVersionHeader,
  EstimateVersionMetricsStrip,
} from "./EstimateVersionHeader";
import { EstimateSummarySidebar } from "./EstimateSummarySidebar";
import { MaterialSearchCard } from "./MaterialSearchCard";
import { NewEstimatePreviewPanel } from "./NewEstimatePreviewPanel";
import { VersionHistoryCard, type VersionRow } from "./VersionHistoryCard";
import {
  discountPercent,
  marginPercent,
  recalcTotals,
} from "./estimate-version-totals";

type LineDraftJson = {
  key: string;
  categoryKey: EstimateCategoryKey;
  productName: string;
  qty: string;
  coefficient?: string | null;
  unit: string;
  salePrice: string;
  supplierProvider?: string | null;
  supplierMaterialId?: string | null;
  supplierMaterialName?: string | null;
  supplierPriceSnapshot?: number | null;
  baseItemId?: string | null;
  unitPriceSource?: "manual" | "supplier_snapshot" | null;
};

type StoredPreview = {
  v: 1;
  lines: LineDraftJson[];
  notes: string | null;
  discountAmount: number;
  deliveryCost: number;
  installationCost: number;
};

type EstPayload = {
  id: string;
  version: number;
  status: string;
  totalPrice: number | null;
  grossMargin: number | null;
  discountAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  notes: string | null;
  updatedAt?: string;
  lineItems: Array<{
    id: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
    metadataJson?: unknown;
  }>;
};

const btnGhost =
  "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-[var(--enver-hover)]";

export function EstimateVersionPreviewClient({
  leadId,
  estimateId,
  leadTitle: initialLeadTitle,
}: {
  leadId: string;
  estimateId: string;
  leadTitle: string;
}) {
  const router = useRouter();
  const moreRef = useRef<HTMLDivElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const [leadTitle, setLeadTitle] = useState(initialLeadTitle);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [est, setEst] = useState<EstPayload | null>(null);
  const [isCurrent, setIsCurrent] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);

  const [storedPreview, setStoredPreview] = useState<StoredPreview | null>(
    null,
  );
  const [proposalOpen, setProposalOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/estimates/${estimateId}`);
      const j = (await r.json()) as {
        estimate?: EstPayload;
        leadTitle?: string;
        isCurrent?: boolean;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      if (!j.estimate) throw new Error("Немає смети");
      setEst(j.estimate);
      if (typeof j.leadTitle === "string") setLeadTitle(j.leadTitle);
      setIsCurrent(Boolean(j.isCurrent));

      const rv = await fetch(`/api/leads/${leadId}/estimates`);
      const vj = (await rv.json()) as {
        items?: VersionRow[];
        activeEstimateId?: string | null;
      };
      if (rv.ok) {
        setVersions(vj.items ?? []);
        setActiveEstimateId(vj.activeEstimateId ?? null);
      }
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

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(
        estimateVersionPreviewStorageKey(leadId, estimateId),
      );
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredPreview;
      if (parsed?.v === 1 && Array.isArray(parsed.lines)) {
        setStoredPreview(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [leadId, estimateId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const baselineLines: SnapshotLine[] = useMemo(() => {
    if (!est?.lineItems) return [];
    return est.lineItems.map(apiLineToSnapshotLine);
  }, [est]);

  const previewLines: SnapshotLine[] = useMemo(() => {
    if (storedPreview?.lines?.length) {
      return storedPreview.lines
        .filter((l) => l.productName.trim())
        .map((l) => draftLikeToSnapshotLine(l));
    }
    return baselineLines;
  }, [storedPreview, baselineLines]);

  const previewDiscount = storedPreview?.discountAmount ?? est?.discountAmount ?? 0;
  const previewDelivery = storedPreview?.deliveryCost ?? est?.deliveryCost ?? 0;
  const previewInstall =
    storedPreview?.installationCost ?? est?.installationCost ?? 0;

  const baselineSubtotal = useMemo(
    () => baselineLines.reduce((a, l) => a + l.amountSale, 0),
    [baselineLines],
  );
  const previewSubtotal = useMemo(
    () => previewLines.reduce((a, l) => a + l.amountSale, 0),
    [previewLines],
  );

  const baselineDiscount = est?.discountAmount ?? 0;
  const baselineDelivery = est?.deliveryCost ?? 0;
  const baselineInstall = est?.installationCost ?? 0;

  const baselineTotals = recalcTotals(
    baselineSubtotal,
    baselineDiscount,
    baselineDelivery,
    baselineInstall,
  );
  const previewTotals = recalcTotals(
    previewSubtotal,
    previewDiscount,
    previewDelivery,
    previewInstall,
  );

  const diff = useMemo(() => {
    return computeEstimateLineDiff(baselineLines, previewLines);
  }, [baselineLines, previewLines]);

  const diffRowsForPanel: DiffRow[] = useMemo(() => {
    const out: DiffRow[] = [];
    for (const p of previewLines) {
      const b = diff.byKeyBaseline.get(p.key);
      if (!b) {
        out.push({ kind: "added", line: p });
        continue;
      }
      const changed =
        Math.abs(b.amountSale - p.amountSale) > 0.5 ||
        Math.abs(b.qty - p.qty) > 0.0001 ||
        Math.abs(b.salePrice - p.salePrice) > 0.01;
      if (changed) out.push({ kind: "changed", baseline: b, preview: p });
      else out.push({ kind: "unchanged", line: p });
    }
    return out;
  }, [previewLines, diff.byKeyBaseline]);

  const summaryBullets = useMemo(() => {
    const lines = diff.summaryLines.slice(0, 12);
    if (lines.length === 0 && Math.abs(previewTotals.total - baselineTotals.total) > 0.5) {
      return [
        `Зміна суми: ${baselineTotals.total.toLocaleString("uk-UA")} → ${previewTotals.total.toLocaleString("uk-UA")} грн`,
      ];
    }
    return lines;
  }, [diff.summaryLines, previewTotals.total, baselineTotals.total]);

  const newVersionNum = (est?.version ?? 0) + 1;
  const discPctPreview = discountPercent(previewSubtotal, previewDiscount);
  const marginPreviewApprox =
    est?.grossMargin != null && baselineTotals.total > 0
      ? est.grossMargin * (previewTotals.total / baselineTotals.total)
      : null;
  const marginPctPreview = marginPercent(
    previewTotals.total,
    marginPreviewApprox,
  );
  const marginLow =
    marginPctPreview != null ? marginPctPreview < 8 : false;

  const duplicateEstimate = async () => {
    const j = await postJson<{ estimate?: { id: string }; error?: string }>(
      `/api/leads/${leadId}/estimates`,
      { cloneFromEstimateId: estimateId },
    );
    if (j.estimate?.id) {
      router.push(`/leads/${leadId}/estimate/${j.estimate.id}`);
    }
  };

  const createBlank = async () => {
    const j = await postJson<{ estimate?: { id: string }; error?: string }>(
      `/api/leads/${leadId}/estimates`,
      {},
    );
    if (j.estimate?.id) {
      router.push(`/leads/${leadId}/estimate/${j.estimate.id}`);
    }
  };

  const confirmCreateVersion = async () => {
    if (!est || !storedPreview) return;
    setConfirmBusy(true);
    setErr(null);
    try {
      const linePayload = buildEstimateLinePayload(storedPreview.lines);
      const j = await patchLeadEstimateById<{
        error?: string;
        estimate?: { id: string };
        estimateIdChanged?: boolean;
      }>(leadId, estimateId, {
        lineItems: linePayload,
        notes: storedPreview.notes,
        discountAmount: storedPreview.discountAmount,
        deliveryCost: storedPreview.deliveryCost,
        installationCost: storedPreview.installationCost,
        versioning: "fork",
        forceNewVersion: true,
        changeSummary:
          summaryBullets[0]?.slice(0, 500) ?? "Нова версія з екрану перегляду",
      });
      sessionStorage.removeItem(
        estimateVersionPreviewStorageKey(leadId, estimateId),
      );
      if (j.estimateIdChanged && j.estimate?.id) {
        router.replace(`/leads/${leadId}/estimate/${j.estimate.id}`);
        router.refresh();
      } else {
        await load();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setConfirmBusy(false);
    }
  };

  const summaryHint =
    summaryBullets.join(" · ").slice(0, 500) ||
    `Смета v${est?.version ?? "—"} → v${newVersionNum}`;

  const hasComparisonChanges =
    summaryBullets.length > 0 ||
    Math.abs(previewTotals.total - baselineTotals.total) > 0.5;

  if (loading && !est) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[var(--enver-bg)] text-sm text-slate-500">
        Завантаження…
      </div>
    );
  }

  if (err && !est) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-[var(--enver-bg)] px-4 py-8">
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </p>
      </div>
    );
  }

  if (!est) return null;

  const updatedIso = est.updatedAt ?? new Date().toISOString();

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[var(--enver-bg)] pb-44 text-[var(--enver-text)] antialiased">
      <CreateProposalModal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        leadId={leadId}
        estimateId={estimateId}
        estimateVersion={newVersionNum}
        totalPrice={previewTotals.total}
        defaultTitle={`КП v${newVersionNum}`}
        summaryHint={summaryHint}
        kpVisualizationRows={[]}
      />

      <EstimateVersionHeader
        newVersionLabel={`Смета v${newVersionNum}`}
        draftBadge
        projectTitle={leadTitle}
        onDuplicate={() => void duplicateEstimate()}
        onCreate={() => void createBlank()}
        onCreateProposal={() => setProposalOpen(true)}
        leadId={leadId}
        moreMenu={
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className={btnGhost}
              onClick={() => setMoreOpen((v) => !v)}
            >
              Ще ▾
            </button>
            {moreOpen ? (
              <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-[var(--enver-card)] py-1 text-xs shadow-lg">
                <Link
                  href={`/leads/${leadId}/estimate/${estimateId}`}
                  className="block px-3 py-2 hover:bg-[var(--enver-hover)]"
                  onClick={() => setMoreOpen(false)}
                >
                  Редактор смети
                </Link>
                <Link
                  href={`/leads/${leadId}`}
                  className="block px-3 py-2 hover:bg-[var(--enver-hover)]"
                  onClick={() => setMoreOpen(false)}
                >
                  Картка ліда
                </Link>
              </div>
            ) : null}
          </div>
        }
      />

      <EstimateVersionMetricsStrip
        updatedAtIso={updatedIso}
        subtotal={previewSubtotal}
        discountAmount={previewDiscount}
        discountPct={discPctPreview}
        total={previewTotals.total}
        marginPct={marginPctPreview}
        marginLow={marginLow}
      />

      <EstimateInfoBanner
        newVersion={newVersionNum}
        currentVersion={est.version}
      />

      <EstimateComparisonStrip
        currentVersion={est.version}
        currentTotal={baselineTotals.total}
        newVersion={newVersionNum}
        newTotal={previewTotals.total}
        hasChanges={hasComparisonChanges}
      />

      {err ? (
        <p className="mx-auto max-w-[1800px] px-4 py-2 text-xs text-rose-700 md:px-6">
          {err}
        </p>
      ) : null}

      <div className="mx-auto grid max-w-[1800px] gap-4 px-4 py-5 lg:grid-cols-[1.2fr_1.4fr_0.9fr] lg:items-start lg:gap-5 lg:px-6">
        <CurrentEstimatePanel
          version={est.version}
          total={baselineTotals.total}
          statusNote={
            isCurrent
              ? "Активна збережена версія (не перезаписується)"
              : "Збережена версія в БД"
          }
          lines={baselineLines}
        />

        <NewEstimatePreviewPanel
          newVersion={newVersionNum}
          oldTotal={baselineTotals.total}
          newTotal={previewTotals.total}
          diffRows={diffRowsForPanel}
          previewLines={previewLines}
          summaryBullets={summaryBullets}
        />

        <div className="flex flex-col gap-4">
          <EstimateSummarySidebar
            subtotal={previewSubtotal}
            discountAmount={previewDiscount}
            discountPct={discPctPreview}
            total={previewTotals.total}
            marginPct={marginPctPreview}
            marginLow={marginLow}
            newVersion={newVersionNum}
            newTotal={previewTotals.total}
            prevVersion={est.version}
            prevTotal={baselineTotals.total}
            prevNote="Перерахунок з нового вводу"
          />
          <VersionHistoryCard
            items={versions}
            leadId={leadId}
            activeEstimateId={activeEstimateId}
            highlightVersion={newVersionNum}
          />
          <MaterialSearchCard />
        </div>
      </div>

      {storedPreview ? (
        <CreateNewVersionPanel
          newVersion={newVersionNum}
          currentVersion={est.version}
          oldTotal={baselineTotals.total}
          newTotal={previewTotals.total}
          bullets={summaryBullets}
          busy={confirmBusy}
          onCancel={() =>
            router.push(`/leads/${leadId}/estimate/${estimateId}`)
          }
          onConfirm={() => void confirmCreateVersion()}
        />
      ) : (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4">
          <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[11px] text-amber-950 shadow-lg">
            Немає чернетки змін. Відкрийте{" "}
            <Link
              href={`/leads/${leadId}/estimate/${estimateId}`}
              className="font-bold text-blue-800 underline"
            >
              редактор смети
            </Link>
            , внесіть зміни та натисніть «Перегляд нової версії».
          </div>
        </div>
      )}
    </div>
  );
}
