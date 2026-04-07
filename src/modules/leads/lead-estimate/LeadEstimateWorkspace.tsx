"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildEstimateSuggestions } from "../../../lib/estimates/estimate-intelligence";
import {
  ESTIMATE_CATEGORY_KEYS,
  ESTIMATE_CATEGORY_LABELS,
  type EstimateCategoryKey,
  parseCategoryKey,
} from "../../../lib/estimates/estimate-categories";
import { buildEstimateLinePayload } from "../../../lib/estimates/build-estimate-line-payload";
import { estimateVersionPreviewStorageKey } from "../../../lib/estimates/estimate-version-preview-storage";
import type { CompareEstimateVersionsResult } from "../../../lib/estimates/compare-estimate-versions";
import { patchLeadEstimateById } from "../../../features/leads/lead-estimate-api";
import { postJson } from "../../../lib/api/patch-json";
import { cn } from "../../../lib/utils";
import { CreateProposalModal } from "./CreateProposalModal";

type LineMeta = {
  supplierProvider?: string | null;
  supplierMaterialId?: string | null;
  supplierMaterialName?: string | null;
  supplierPriceSnapshot?: number | null;
  coefficient?: string | null;
  baseItemId?: string | null;
  unitPriceSource?: "manual" | "supplier_snapshot" | null;
};

function parseLineMeta(raw: unknown): LineMeta {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    supplierProvider:
      typeof o.supplierProvider === "string" ? o.supplierProvider : null,
    supplierMaterialId:
      typeof o.supplierMaterialId === "string" ? o.supplierMaterialId : null,
    supplierMaterialName:
      typeof o.supplierMaterialName === "string"
        ? o.supplierMaterialName
        : null,
    supplierPriceSnapshot:
      typeof o.supplierPriceSnapshot === "number" &&
      Number.isFinite(o.supplierPriceSnapshot)
        ? o.supplierPriceSnapshot
        : null,
    coefficient:
      typeof o.coefficient === "string" ? o.coefficient : null,
    baseItemId: typeof o.baseItemId === "string" ? o.baseItemId : null,
    unitPriceSource:
      o.unitPriceSource === "manual" || o.unitPriceSource === "supplier_snapshot"
        ? o.unitPriceSource
        : null,
  };
}

type LineDraft = {
  key: string;
  categoryKey: EstimateCategoryKey;
  productName: string;
  qty: string;
  coefficient: string;
  unit: string;
  salePrice: string;
} & LineMeta;

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
  changeSummary?: string | null;
  updatedAt?: string;
  lineItems?: Array<{
    id?: string;
    type: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
    metadataJson?: unknown;
  }>;
};

function newLineKey() {
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyLine(cat: EstimateCategoryKey): LineDraft {
  return {
    key: newLineKey(),
    categoryKey: cat,
    productName: "",
    qty: "1",
    coefficient: "1",
    unit: "шт",
    salePrice: "0",
    supplierProvider: null,
    supplierMaterialId: null,
    supplierMaterialName: null,
    supplierPriceSnapshot: null,
    baseItemId: undefined,
    unitPriceSource: null,
  };
}

function linesFromApi(items: EstPayload["lineItems"]): LineDraft[] {
  return (items ?? []).map((li) => {
    const m = parseLineMeta(li.metadataJson);
    const coeff =
      m.coefficient && num(m.coefficient) > 0 ? m.coefficient : "1";
    return {
      key: li.id ?? newLineKey(),
      categoryKey: parseCategoryKey(li.category),
      productName: li.productName,
      qty: String(li.qty),
      coefficient: coeff,
      unit: li.unit || "шт",
      salePrice: String(li.salePrice),
      supplierProvider: m.supplierProvider ?? null,
      supplierMaterialId: m.supplierMaterialId ?? null,
      supplierMaterialName: m.supplierMaterialName ?? null,
      supplierPriceSnapshot: m.supplierPriceSnapshot ?? null,
      baseItemId: m.baseItemId ?? (typeof li.id === "string" ? li.id : undefined),
      unitPriceSource: m.unitPriceSource ?? null,
    };
  });
}

function num(s: string) {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function rowAmount(row: LineDraft) {
  const c = num(row.coefficient ?? "1") || 1;
  return num(row.qty) * c * num(row.salePrice);
}

/** Макет: royal blue primary, світлий фон, помаранчевий Draft */
const btnPrimary =
  "rounded-lg border border-blue-700 bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/15 transition hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-[var(--enver-hover)] disabled:opacity-50";

type VersionRow = {
  id: string;
  version: number;
  status: string;
  totalPrice: number | null;
  changeSummary: string | null;
  updatedAt: string;
};

type EstimateWorkspaceJson = {
  lead?: { title?: string };
  estimate?: { currentVersionId?: string | null } | null;
  versionHistory?: Array<{
    id: string;
    versionNumber: number;
    status: string;
    total: number | null;
    changeNote?: string | null;
    createdAt: string;
  }>;
};

export function LeadEstimateWorkspace({
  leadId,
  estimateId,
  leadTitle: initialLeadTitle,
}: {
  leadId: string;
  estimateId: string;
  leadTitle: string;
}) {
  const router = useRouter();
  const [est, setEst] = useState<EstPayload | null>(null);
  const [leadTitle, setLeadTitle] = useState(initialLeadTitle);
  const [isCurrent, setIsCurrent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [delivery, setDelivery] = useState("0");
  const [install, setInstall] = useState("0");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [focusCategory, setFocusCategory] =
    useState<EstimateCategoryKey>("cabinets");
  const [selectedLineKey, setSelectedLineKey] = useState<string | null>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState<LineDraft[] | null>(null);

  const [matQ, setMatQ] = useState("");
  const [matHits, setMatHits] = useState<
    Array<{
      id: string;
      label: string;
      hint?: string;
      unit?: string;
      unitPrice?: number;
      providerKey?: string;
    }>
  >([]);

  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);

  const [compareFromId, setCompareFromId] = useState<string | null>(null);
  const [compareToId, setCompareToId] = useState<string | null>(null);
  const [compareResult, setCompareResult] =
    useState<CompareEstimateVersionsResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const [proposalOpen, setProposalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapRef = useRef({
    notes,
    discount,
    delivery,
    install,
    lines,
  });
  snapRef.current = { notes, discount, delivery, install, lines };

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
      const e = j.estimate;
      if (!e) throw new Error("Немає даних смети");
      setEst(e);
      if (typeof j.leadTitle === "string") setLeadTitle(j.leadTitle);
      setIsCurrent(Boolean(j.isCurrent));
      setNotes(String(e.notes ?? ""));
      setDiscount(String(e.discountAmount ?? 0));
      setDelivery(String(e.deliveryCost ?? 0));
      setInstall(String(e.installationCost ?? 0));
      setLines(linesFromApi(e.lineItems));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setEst(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, estimateId]);

  const loadWorkspace = useCallback(async () => {
    try {
      const r = await fetch(`/api/leads/${leadId}/estimate-workspace`);
      const j = (await r.json()) as EstimateWorkspaceJson;
      if (r.ok) {
        if (typeof j.lead?.title === "string") setLeadTitle(j.lead.title);
        const hist = j.versionHistory ?? [];
        setVersions(
          hist.map((v) => ({
            id: v.id,
            version: v.versionNumber,
            status: v.status,
            totalPrice: v.total,
            changeSummary: v.changeNote ?? null,
            updatedAt: v.createdAt,
          })),
        );
        setActiveEstimateId(j.estimate?.currentVersionId ?? null);
      }
    } catch {
      /* ignore */
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace, estimateId]);

  useEffect(() => {
    setCompareFromId(null);
    setCompareToId(null);
    setCompareResult(null);
  }, [estimateId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const subtotal = useMemo(
    () => lines.reduce((a, r) => a + rowAmount(r), 0),
    [lines],
  );

  const discountN = num(discount);
  const deliveryN = num(delivery);
  const installN = num(install);
  const totalPreview =
    subtotal - discountN + deliveryN + installN;

  const savedTotal = est?.totalPrice ?? null;
  const hasUnsavedTotalChange =
    savedTotal != null && Math.abs(savedTotal - totalPreview) > 0.5;

  const marginPct = useMemo(() => {
    if (est?.grossMargin == null || totalPreview <= 0) return null;
    return Math.round((est.grossMargin / totalPreview) * 100);
  }, [est?.grossMargin, totalPreview]);

  const suggestions = useMemo(() => {
    const like = lines
      .filter((l) => l.productName.trim())
      .map((l) => ({
        categoryKey: l.categoryKey,
        productName: l.productName,
        qty: num(l.qty),
        salePrice: num(l.salePrice),
        amountSale: rowAmount(l),
      }));
    return buildEstimateSuggestions(like, {
      totalPrice: totalPreview,
      grossMargin: est?.grossMargin ?? null,
      discountAmount: discountN,
    });
  }, [lines, totalPreview, est?.grossMargin, discountN]);

  const readOnly = useMemo(
    () => est != null && est.status !== "DRAFT",
    [est],
  );

  const persist = useCallback(
    async (
      linePayload: Record<string, unknown>[] | null,
      opts?: {
        changeSummary?: string;
        versioning?: "auto" | "fork" | "inline";
        forceNewVersion?: boolean;
      },
    ) => {
      if (!est || readOnly) return;
      const snap = snapRef.current;
      const dDisc = num(snap.discount);
      const dDel = num(snap.delivery);
      const dInst = num(snap.install);
      setSaveState("saving");
      setErr(null);
      try {
        const body: Record<string, unknown> = {
          notes: snap.notes.trim() || null,
          discountAmount: dDisc,
          deliveryCost: dDel,
          installationCost: dInst,
        };
        if (linePayload) {
          body.lineItems = linePayload;
          if (opts?.changeSummary) body.changeSummary = opts.changeSummary;
          body.versioning = opts?.versioning ?? "auto";
          if (opts?.forceNewVersion === true) body.forceNewVersion = true;
        }
        const j = await patchLeadEstimateById<{
          error?: string;
          estimate?: EstPayload;
          estimateIdChanged?: boolean;
          versioningDecision?: "fork" | "inline";
          versioningReason?: string;
          isCurrent?: boolean;
          leadTitle?: string;
        }>(leadId, estimateId, body);
        if (j.estimateIdChanged && j.estimate?.id) {
          setSaveState("idle");
          router.replace(`/leads/${leadId}/estimate/${j.estimate.id}`);
          router.refresh();
          return;
        }
        if (j.estimate) {
          setEst(j.estimate);
          if (linePayload) setLines(linesFromApi(j.estimate.lineItems));
        }
        if (typeof j.isCurrent === "boolean") setIsCurrent(j.isCurrent);
        if (typeof j.leadTitle === "string") setLeadTitle(j.leadTitle);
        setSaveState("idle");
        router.refresh();
        void loadWorkspace();
      } catch (e) {
        setSaveState("error");
        setErr(e instanceof Error ? e.message : "Помилка");
      }
    },
    [est, leadId, estimateId, router, loadWorkspace, readOnly],
  );

  const scheduleSave = useCallback(
    (includeLines: boolean) => {
      if (readOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persist(
          includeLines
            ? buildEstimateLinePayload(snapRef.current.lines)
            : null,
        );
      }, 750);
    },
    [persist, readOnly],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (!est) return "";
    if (isCurrent) return "ПОТОЧНА";
    if (est.status === "SUPERSEDED") return "АРХІВ";
    return "ЧЕРНЕТКА";
  }, [est, isCurrent]);

  const updatedLabel = est?.updatedAt
    ? new Date(est.updatedAt).toLocaleString("uk-UA", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const applyTemplate = () => {
    if (readOnly) return;
    setLines((prev) => {
      const add = [
        emptyLine("cabinets"),
        emptyLine("facades"),
        emptyLine("fittings"),
      ];
      add[0]!.productName = "Корпус / модулі (уточнити)";
      add[1]!.productName = "Фасади (уточнити)";
      add[2]!.productName = "Фурнітура (уточнити)";
      return [...prev, ...add];
    });
    scheduleSave(true);
  };

  const runAi = async () => {
    if (readOnly) return;
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    setErr(null);
    try {
      const j = await postJson<{
        error?: string;
        draft?: {
          lines: Array<{
            categoryKey?: EstimateCategoryKey;
            productName: string;
            qty: number;
            unit: string;
            salePrice: number;
          }>;
          assumptions?: string[];
        };
      }>(`/api/leads/${leadId}/estimates/ai-draft`, { prompt: aiPrompt });
      const raw = j.draft?.lines ?? [];
      const mapped: LineDraft[] = raw.map((l) => ({
        key: newLineKey(),
        categoryKey: l.categoryKey ?? "cabinets",
        productName: l.productName,
        qty: String(l.qty),
        coefficient: "1",
        unit: l.unit || "шт",
        salePrice: String(l.salePrice),
        supplierProvider: null,
        supplierMaterialId: null,
        supplierMaterialName: null,
        supplierPriceSnapshot: null,
        baseItemId: undefined,
        unitPriceSource: null,
      }));
      if (mapped.length) {
        setAiPreview(mapped);
        if (j.draft?.assumptions?.length) {
          setNotes((n) =>
            [n.trim(), j.draft!.assumptions!.join("\n")]
              .filter(Boolean)
              .join("\n\n"),
          );
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setAiBusy(false);
    }
  };

  const applyAiPreview = () => {
    if (readOnly) return;
    if (!aiPreview?.length) return;
    const next = aiPreview;
    setLines(next);
    setAiPreview(null);
    setAiPrompt("");
    void persist(buildEstimateLinePayload(next), {
      changeSummary: "AI: розбір тексту (нова версія смети)",
      versioning: "fork",
      forceNewVersion: true,
    });
  };

  const setCurrent = async () => {
    setErr(null);
    try {
      const j = await patchLeadEstimateById<{
        error?: string;
        isCurrent?: boolean;
        estimate?: EstPayload;
      }>(leadId, estimateId, { setCurrent: true });
      if (j.estimate) setEst(j.estimate);
      setIsCurrent(Boolean(j.isCurrent));
      router.refresh();
      void loadWorkspace();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  };

  const duplicateEstimate = async () => {
    setErr(null);
    try {
      const j = await postJson<{ error?: string; estimate?: { id: string } }>(
        `/api/leads/${leadId}/estimates`,
        { cloneFromEstimateId: estimateId },
      );
      if (j.estimate?.id) {
        router.push(`/leads/${leadId}/estimate/${j.estimate.id}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  };

  const createBlankEstimate = async () => {
    setErr(null);
    try {
      const j = await postJson<{
        error?: string;
        estimate?: { id: string };
      }>(`/api/leads/${leadId}/estimates`, {});
      if (j.estimate?.id) {
        router.push(`/leads/${leadId}/estimate/${j.estimate.id}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  };

  const goToVersionPreview = () => {
    if (readOnly) return;
    try {
      const payload = {
        v: 1 as const,
        lines: lines.map((l) => ({
          key: l.key,
          categoryKey: l.categoryKey,
          productName: l.productName,
          qty: l.qty,
          coefficient: l.coefficient,
          unit: l.unit,
          salePrice: l.salePrice,
          supplierProvider: l.supplierProvider ?? null,
          supplierMaterialId: l.supplierMaterialId ?? null,
          supplierMaterialName: l.supplierMaterialName ?? null,
          supplierPriceSnapshot: l.supplierPriceSnapshot ?? null,
          baseItemId: l.baseItemId ?? null,
          unitPriceSource: l.unitPriceSource ?? null,
        })),
        notes: notes.trim() || null,
        discountAmount: num(discount),
        deliveryCost: num(delivery),
        installationCost: num(install),
      };
      sessionStorage.setItem(
        estimateVersionPreviewStorageKey(leadId, estimateId),
        JSON.stringify(payload),
      );
    } catch {
      setErr("Не вдалося зберегти чернетку для перегляду");
      return;
    }
    router.push(`/leads/${leadId}/estimate/${estimateId}/version-preview`);
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
        items?: Array<{
          id: string;
          label: string;
          hint?: string;
          unit?: string;
          unitPrice?: number;
          providerKey?: string;
        }>;
      };
      if (r.ok) setMatHits(j.items ?? []);
    } catch {
      setMatHits([]);
    }
  };

  useEffect(() => {
    const q = matQ.trim();
    if (!q) {
      setMatHits([]);
      return;
    }
    if (matSearchTimer.current) clearTimeout(matSearchTimer.current);
    matSearchTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(
            `/api/materials/search?q=${encodeURIComponent(q)}&limit=12`,
          );
          const j = (await r.json()) as {
            items?: Array<{
              id: string;
              label: string;
              hint?: string;
              unit?: string;
              unitPrice?: number;
              providerKey?: string;
            }>;
          };
          if (r.ok) setMatHits(j.items ?? []);
        } catch {
          setMatHits([]);
        }
      })();
    }, 250);
    return () => {
      if (matSearchTimer.current) clearTimeout(matSearchTimer.current);
    };
  }, [matQ]);

  useEffect(() => {
    if (versions.length < 2) return;
    const newest = versions[0];
    const oldest = versions[versions.length - 1];
    if (!newest || !oldest) return;
    setCompareFromId((prev) => prev ?? oldest.id);
    setCompareToId((prev) => prev ?? newest.id);
  }, [versions]);

  const runCompare = async () => {
    if (!compareFromId || !compareToId) {
      setErr("Оберіть дві версії для порівняння");
      return;
    }
    if (compareFromId === compareToId) {
      setErr("Виберіть різні версії");
      return;
    }
    setCompareLoading(true);
    setCompareResult(null);
    setErr(null);
    try {
      const r = await fetch(
        `/api/leads/${leadId}/estimates/compare?from=${encodeURIComponent(compareFromId)}&to=${encodeURIComponent(compareToId)}`,
      );
      const j = (await r.json()) as CompareEstimateVersionsResult & {
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setCompareResult(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setCompareLoading(false);
    }
  };

  const attachMaterial = (h: {
    id: string;
    label: string;
    unit?: string;
    unitPrice?: number;
    providerKey?: string;
  }) => {
    if (readOnly) return;
    const targetKey = selectedLineKey;
    setLines((prev) => {
      if (prev.length === 0) {
        const row = emptyLine("cabinets");
        row.productName = h.label;
        row.unit = h.unit ?? row.unit;
        row.salePrice =
          h.unitPrice != null && h.unitPrice > 0
            ? String(h.unitPrice)
            : row.salePrice;
        row.supplierProvider = h.providerKey ?? "catalog";
        row.supplierMaterialId = h.id;
        row.supplierMaterialName = h.label;
        row.supplierPriceSnapshot = h.unitPrice ?? null;
        row.unitPriceSource = "supplier_snapshot";
        return [row];
      }
      const idx = targetKey
        ? prev.findIndex((r) => r.key === targetKey)
        : prev.length - 1;
      if (idx < 0) return prev;
      return prev.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          productName: row.productName.trim() ? row.productName : h.label,
          unit: h.unit ?? row.unit,
          salePrice:
            h.unitPrice != null && h.unitPrice > 0
              ? String(h.unitPrice)
              : row.salePrice,
          supplierProvider: h.providerKey ?? "catalog",
          supplierMaterialId: h.id,
          supplierMaterialName: h.label,
          supplierPriceSnapshot: h.unitPrice ?? null,
          unitPriceSource: "supplier_snapshot",
        };
      });
    });
    setMatHits([]);
    setMatQ("");
    scheduleSave(true);
  };

  const grouped = useMemo(() => {
    const m = new Map<EstimateCategoryKey, LineDraft[]>();
    for (const k of ESTIMATE_CATEGORY_KEYS) m.set(k, []);
    for (const row of lines) {
      const arr = m.get(row.categoryKey) ?? [];
      arr.push(row);
      m.set(row.categoryKey, arr);
    }
    return m;
  }, [lines]);

  const summaryHint =
    suggestions.find((s) => s.tone === "success")?.text ??
    `Смета v${est?.version ?? "—"} · ${lines.filter((l) => l.productName.trim()).length} поз. · ${totalPreview.toLocaleString("uk-UA")} грн`;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[var(--enver-bg)] px-4 text-sm font-medium text-slate-500">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-[var(--enver-card)] px-6 py-4 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Завантаження смети…
        </div>
      </div>
    );
  }

  if (err && !est) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-[var(--enver-bg)] px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
          {err}
        </p>
      </div>
    );
  }

  if (!est) return null;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[var(--enver-bg)] text-[var(--enver-text)]">
      <CreateProposalModal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        leadId={leadId}
        estimateId={estimateId}
        estimateVersion={est.version}
        totalPrice={est.totalPrice ?? totalPreview}
        defaultTitle={`КП v${est.version}`}
        summaryHint={summaryHint}
        kpVisualizationRows={[]}
      />

      {aiPreview && aiPreview.length > 0 ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/90 bg-[var(--enver-card)] p-5 shadow-2xl shadow-slate-900/10">
            <h3 className="text-sm font-semibold text-[var(--enver-text)]">
              Попередній перегляд (AI)
            </h3>
            <p className="mt-1 text-[11px] text-slate-600">
              Перевірте рядки перед додаванням до смети. Ціни 0 — заповніть
              вручну, якщо відомі.
            </p>
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-xs">
              {aiPreview.map((l) => (
                <li
                  key={l.key}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"
                >
                  <span className="font-medium text-slate-800">
                    {ESTIMATE_CATEGORY_LABELS[l.categoryKey]}
                  </span>
                  {" · "}
                  {l.productName}{" "}
                  <span className="text-slate-500">
                    ({l.qty} {l.unit} × {l.salePrice})
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setAiPreview(null)}
              >
                Скасувати
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => void applyAiPreview()}
              >
                Додати до смети
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Шапка як у макеті: назва, Draft, проєкт, дії */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-[var(--enver-card)] shadow-sm">
        <div className="mx-auto max-w-[1680px] px-4 py-4 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <Link
                  href={`/leads/${leadId}`}
                  className="font-medium text-blue-700 hover:text-blue-800 hover:underline"
                >
                  ← Назад до ліда
                </Link>
                <span className="text-slate-300">·</span>
                <span>Оновлено {updatedLabel}</span>
                {saveState === "saving" ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">
                    Збереження…
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-lg font-bold tracking-tight text-[var(--enver-text)] md:text-xl">
                  Смета v{est.version}
                </h1>
                <span
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
                    est.status === "DRAFT"
                      ? "bg-orange-100 text-orange-900"
                      : isCurrent
                        ? "bg-emerald-100 text-emerald-900"
                        : est.status === "SUPERSEDED"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-slate-100 text-slate-700",
                  )}
                >
                  {est.status === "DRAFT" ? "Чернетка" : statusLabel}
                </span>
              </div>
              <div className="flex max-w-md flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Проєкт
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-inner">
                  <span className="truncate">{leadTitle}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                type="button"
                className={btnGhost}
                disabled={isCurrent}
                title="Зробити активною версією ліда"
                onClick={() => void setCurrent()}
              >
                Поточна
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => void duplicateEstimate()}
              >
                Дублювати
              </button>
              <button
                type="button"
                className={btnGhost}
                onClick={() => void createBlankEstimate()}
              >
                Створити
              </button>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => setProposalOpen(true)}
              >
                Створити КП
              </button>
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  className={cn(btnGhost, "min-w-[5rem]")}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  Ще ▾
                </button>
                {moreOpen ? (
                  <div className="absolute right-0 z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-[var(--enver-card)] py-1 text-xs shadow-lg">
                    <Link
                      href={`/leads/${leadId}`}
                      className="block px-3 py-2 hover:bg-[var(--enver-hover)]"
                      onClick={() => setMoreOpen(false)}
                    >
                      Картка ліда
                    </Link>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left hover:bg-[var(--enver-hover)]"
                      onClick={() => {
                        setMoreOpen(false);
                        void duplicateEstimate();
                      }}
                    >
                      Нова версія (копія)
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Інфо-плашка про версії */}
      <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50/95 to-sky-50/90">
        <div className="mx-auto max-w-[1680px] px-4 py-2.5 text-[12px] leading-snug text-blue-950 md:px-8">
          <span className="font-semibold text-blue-900">Версії смети.</span>{" "}
          При значних змінах суми створюється нова версія; попередня зберігається в
          архіві. Дані не перезаписуються без створення версії.
        </div>
      </div>

      {readOnly ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-[1680px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <p className="text-sm font-bold text-amber-950">
                Ця версія лише для перегляду
              </p>
              <p className="mt-0.5 text-[11px] text-amber-900/90">
                Відправлені / затверджені / архівні смети не редагуються напряму.
                Створіть нову версію з копії або перегляньте зміни в окремому
                режимі.
              </p>
            </div>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void duplicateEstimate()}
            >
              Нова версія (копія)
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-b border-slate-200/80 bg-[var(--enver-card)]">
        <div className="mx-auto max-w-[1680px] px-4 py-2.5 md:px-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-600">
            <span>
              <span className="font-semibold text-slate-500">Валюта:</span> UAH
            </span>
            <span>
              <span className="font-semibold text-slate-500">База:</span> v
              {est.version}
            </span>
            <span>
              <span className="font-semibold text-slate-500">Лід:</span>{" "}
              <span className="text-slate-800">{leadTitle}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Смуга порівняння: збережено → перегляд */}
      <div className="border-b border-slate-200/90 bg-[var(--enver-card)]">
        <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-3 px-4 py-3 md:grid-cols-3 md:items-center md:gap-6 md:px-8">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Збережено (v{est.version})
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">
              {(savedTotal ?? totalPreview).toLocaleString("uk-UA")}{" "}
              <span className="text-xs font-normal text-slate-500">грн</span>
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Попередній перегляд змін
            </p>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-lg">→</span>
              {hasUnsavedTotalChange ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  Є незбережені зміни
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">Актуально</span>
              )}
            </div>
          </div>
          <div
            className={cn(
              "rounded-xl border px-4 py-3 shadow-sm",
              hasUnsavedTotalChange
                ? "border-emerald-200 bg-emerald-50/90"
                : "border-slate-200/90 bg-[var(--enver-card)]",
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Разом зараз
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-bold tabular-nums",
                hasUnsavedTotalChange ? "text-emerald-700" : "text-slate-800",
              )}
            >
              {totalPreview.toLocaleString("uk-UA")}{" "}
              <span className="text-xs font-normal text-slate-500">грн</span>
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200/80 bg-[var(--enver-card)]">
        <div className="mx-auto max-w-[1680px] px-4 py-3 md:px-8">
          <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/90 to-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--enver-text)]">
                Перегляд нової версії смети
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                Три колонки: збережена версія, чернетка змін, підсумок та історія.
                Поточна смета в БД не перезаписується без підтвердження.
              </p>
            </div>
            <button
              type="button"
              disabled={readOnly}
              className={btnPrimary}
              onClick={goToVersionPreview}
            >
              Перегляд нової версії
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1680px] gap-6 px-4 py-6 md:px-8 lg:grid-cols-[1fr_340px]">
        {/* Основна колонка — таблиця позицій */}
        <div className="space-y-5 pb-28 md:pb-10">
          {err ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800 shadow-sm">
              {err}
            </p>
          ) : null}

          <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[var(--enver-text)]">
              Швидкий ввід (AI)
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Опишіть проєкт — система розкладе позиції по категоріях. Перевірте
              перегляд перед застосуванням.
            </p>
            <textarea
              value={aiPrompt}
              disabled={readOnly}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={2}
              placeholder='Напр.: "Кухня 3 м, МДФ Egger, Blum, доставка та монтаж"'
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm shadow-inner focus:border-blue-400 focus:bg-[var(--enver-card)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={aiBusy || readOnly}
                className={btnPrimary}
                onClick={() => void runAi()}
              >
                {aiBusy ? "Розбір…" : "Розібрати з AI"}
              </button>
              <button
                type="button"
                disabled={readOnly}
                className={btnGhost}
                onClick={applyTemplate}
              >
                Шаблон (кухня)
              </button>
            </div>
          </section>

          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200/80 pb-2">
            <div>
              <h2 className="text-base font-bold text-[var(--enver-text)]">
                Позиції за категоріями
              </h2>
              <p className="text-[11px] text-slate-500">
                Згортайте блоки; клік по рядку — вибір для каталогу
              </p>
            </div>
            <button
              type="button"
              disabled={readOnly}
              className={btnGhost}
              onClick={() => {
                const row = emptyLine(focusCategory);
                setLines((d) => [...d, row]);
                setSelectedLineKey(row.key);
                scheduleSave(true);
              }}
            >
              + Додати позицію
            </button>
          </div>

          {ESTIMATE_CATEGORY_KEYS.map((cat) => {
            const catLines = grouped.get(cat) ?? [];
            const catSub = catLines.reduce((a, r) => a + rowAmount(r), 0);
            return (
              <details
                key={cat}
                open
                className="group rounded-xl border border-slate-200/90 bg-[var(--enver-card)] shadow-sm open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-50/30 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span className="inline-block text-slate-400 transition-transform duration-200 group-open:rotate-90">
                      ▸
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                      {ESTIMATE_CATEGORY_LABELS[cat]}
                    </h3>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-500">
                      {catSub.toLocaleString("uk-UA")} грн
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={readOnly}
                    className="text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-40"
                    onClick={(e) => {
                      e.preventDefault();
                      setFocusCategory(cat);
                      const row = emptyLine(cat);
                      setLines((d) => [...d, row]);
                      setSelectedLineKey(row.key);
                      scheduleSave(true);
                    }}
                  >
                    + у групу
                  </button>
                </summary>
                <div className="divide-y divide-slate-100">
                  {catLines.length === 0 ? (
                    <p className="px-4 py-4 text-[11px] text-slate-400">
                      Порожньо — додайте позицію
                    </p>
                  ) : (
                    catLines.map((row) => (
                      <div
                        key={row.key}
                        className={cn(
                          "grid cursor-pointer gap-2 px-2 py-2.5 sm:grid-cols-[40px_minmax(0,1fr)_52px_44px_52px_72px_88px_auto] sm:items-center sm:gap-3",
                          selectedLineKey === row.key
                            ? "bg-blue-50/70"
                            : "hover:bg-[var(--enver-hover)]/80",
                        )}
                        onClick={() => setSelectedLineKey(row.key)}
                      >
                        <div
                          className="hidden h-9 w-9 shrink-0 rounded-md border border-slate-200 bg-slate-100 sm:block"
                          aria-hidden
                          title="Позиція"
                        />
                        <label className="min-w-0 text-[11px]">
                          <span className="text-slate-500">Назва</span>
                          <input
                            value={row.productName}
                            disabled={readOnly}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((d) =>
                                d.map((x) =>
                                  x.key === row.key
                                    ? { ...x, productName: v }
                                    : x,
                                ),
                              );
                              scheduleSave(true);
                            }}
                            className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
                          />
                        </label>
                        <label className="text-[11px]">
                          <span className="text-slate-500">К-ть</span>
                          <input
                            value={row.qty}
                            disabled={readOnly}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((d) =>
                                d.map((x) =>
                                  x.key === row.key ? { ...x, qty: v } : x,
                                ),
                              );
                              scheduleSave(true);
                            }}
                            className="mt-0.5 w-full rounded-lg border border-slate-200 px-1 py-1 text-sm disabled:bg-slate-100"
                            inputMode="decimal"
                          />
                        </label>
                        <label className="text-[11px]">
                          <span className="text-slate-500">К</span>
                          <input
                            value={row.coefficient ?? "1"}
                            disabled={readOnly}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((d) =>
                                d.map((x) =>
                                  x.key === row.key
                                    ? { ...x, coefficient: v }
                                    : x,
                                ),
                              );
                              scheduleSave(true);
                            }}
                            className="mt-0.5 w-full rounded-lg border border-slate-200 px-1 py-1 text-sm disabled:bg-slate-100"
                            inputMode="decimal"
                            title="Коефіцієнт (множник)"
                          />
                        </label>
                        <label className="text-[11px]">
                          <span className="text-slate-500">Од.</span>
                          <input
                            value={row.unit}
                            disabled={readOnly}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((d) =>
                                d.map((x) =>
                                  x.key === row.key ? { ...x, unit: v } : x,
                                ),
                              );
                              scheduleSave(true);
                            }}
                            className="mt-0.5 w-full rounded-lg border border-slate-200 px-1 py-1 text-sm disabled:bg-slate-100"
                          />
                        </label>
                        <label className="text-[11px]">
                          <span className="text-slate-500">Ціна/од.</span>
                          <input
                            value={row.salePrice}
                            disabled={readOnly}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((d) =>
                                d.map((x) =>
                                  x.key === row.key
                                    ? {
                                        ...x,
                                        salePrice: v,
                                        unitPriceSource: "manual",
                                      }
                                    : x,
                                ),
                              );
                              scheduleSave(true);
                            }}
                            className="mt-0.5 w-full rounded-lg border border-slate-200 px-1 py-1 text-sm disabled:bg-slate-100"
                            inputMode="decimal"
                          />
                        </label>
                        <div className="text-[11px]">
                          <span className="text-slate-500">Разом</span>
                          <p className="mt-0.5 font-medium tabular-nums text-[var(--enver-text)]">
                            {rowAmount(row).toLocaleString("uk-UA")}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 sm:items-end">
                          <select
                            value={row.categoryKey}
                            disabled={readOnly}
                            onChange={(e) => {
                              const v = e.target
                                .value as EstimateCategoryKey;
                              setLines((d) =>
                                d.map((x) =>
                                  x.key === row.key
                                    ? { ...x, categoryKey: v }
                                    : x,
                                ),
                              );
                              scheduleSave(true);
                            }}
                            className="max-w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] disabled:bg-slate-100"
                          >
                            {ESTIMATE_CATEGORY_KEYS.map((k) => (
                              <option key={k} value={k}>
                                {ESTIMATE_CATEGORY_LABELS[k]}
                              </option>
                            ))}
                          </select>
                          {row.supplierMaterialName ? (
                            <span className="max-w-[140px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                              {row.supplierProvider}: {row.supplierMaterialName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              постачальник —
                            </span>
                          )}
                          {row.unitPriceSource === "manual" &&
                          row.supplierPriceSnapshot != null ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-900">
                              Ручна ціна
                            </span>
                          ) : null}
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={readOnly}
                              className="text-[10px] font-semibold text-blue-700 underline disabled:opacity-40"
                              onClick={() => {
                                setSelectedLineKey(row.key);
                                const copy = {
                                  ...row,
                                  key: newLineKey(),
                                  productName: `${row.productName} (копія)`,
                                  baseItemId: undefined,
                                };
                                setLines((d) => [...d, copy]);
                                scheduleSave(true);
                              }}
                            >
                              дубль
                            </button>
                            <button
                              type="button"
                              disabled={readOnly}
                              className="text-[10px] font-semibold text-rose-700 underline disabled:opacity-40"
                              onClick={() => {
                                setLines((d) =>
                                  d.filter((x) => x.key !== row.key),
                                );
                                scheduleSave(true);
                              }}
                            >
                              видалити
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </details>
            );
          })}
        </div>

        {/* Права панель — розрахунок + історія версій */}
        <aside className="space-y-5 md:sticky md:top-4 md:self-start">
          <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Розрахунок
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                <span className="text-slate-600">Підсумок позицій</span>
                <span className="font-semibold tabular-nums text-[var(--enver-text)]">
                  {subtotal.toLocaleString("uk-UA")}
                </span>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">
                  Знижка (грн)
                </label>
                <input
                  value={discount}
                  disabled={readOnly}
                  onChange={(e) => {
                    setDiscount(e.target.value);
                    scheduleSave(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:bg-[var(--enver-card)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">
                  Доставка
                </label>
                <input
                  value={delivery}
                  disabled={readOnly}
                  onChange={(e) => {
                    setDelivery(e.target.value);
                    scheduleSave(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:bg-[var(--enver-card)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">
                  Монтаж
                </label>
                <input
                  value={install}
                  disabled={readOnly}
                  onChange={(e) => {
                    setInstall(e.target.value);
                    scheduleSave(false);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:bg-[var(--enver-card)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                  inputMode="decimal"
                />
              </div>
              <div className="flex justify-between gap-2 border-t border-slate-200 pt-3">
                <span className="text-sm font-bold text-slate-800">Всього</span>
                <span className="text-lg font-bold tabular-nums text-emerald-700">
                  {totalPreview.toLocaleString("uk-UA")}{" "}
                  <span className="text-xs font-normal text-slate-500">грн</span>
                </span>
              </div>
              {est.grossMargin != null ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/90 px-3 py-2">
                  <span className="text-xs font-semibold text-emerald-900">
                    Маржа
                  </span>
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums text-emerald-800",
                        est.grossMargin < totalPreview * 0.08 && "text-amber-800",
                      )}
                    >
                      {est.grossMargin.toLocaleString("uk-UA")} грн
                    </span>
                    {marginPct != null ? (
                      <span className="ml-2 text-xs font-bold text-emerald-700">
                        ({marginPct}%)
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <label className="mt-4 block text-[11px]">
              <span className="font-medium text-slate-500">Нотатки</span>
              <textarea
                value={notes}
                disabled={readOnly}
                onChange={(e) => {
                  setNotes(e.target.value);
                  scheduleSave(false);
                }}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm focus:border-blue-400 focus:bg-[var(--enver-card)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
              />
            </label>
          </section>

          <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Підказки
            </h3>
            <ul className="mt-3 space-y-2">
              {suggestions.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-[11px] leading-snug",
                    s.tone === "warning" &&
                      "border-amber-200 bg-amber-50 text-amber-950",
                    s.tone === "info" &&
                      "border-slate-200 bg-slate-50 text-slate-800",
                    s.tone === "success" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-900",
                  )}
                >
                  {s.text}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Історія версій
            </h3>
            <div className="relative mt-4 max-h-64 overflow-y-auto pl-6">
              <div
                className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200"
                aria-hidden
              />
              <ul className="space-y-4 text-[11px]">
                {versions.map((v) => (
                  <li key={v.id} className="relative">
                    <span
                      className={cn(
                        "absolute left-[-19px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm",
                        activeEstimateId === v.id
                          ? "bg-emerald-500"
                          : "bg-slate-300",
                      )}
                    />
                    <div className="rounded-lg border border-slate-100 bg-slate-50/90 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[var(--enver-text)]">
                          v{v.version}
                          {est.status === "DRAFT" && v.id === estimateId ? (
                            <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-900">
                              чернетка
                            </span>
                          ) : null}
                          {activeEstimateId === v.id ? (
                            <span className="ml-1.5 text-emerald-700">
                              · активна
                            </span>
                          ) : (
                            <span className="ml-1.5 text-slate-500">
                              · архів
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums font-semibold text-slate-700">
                          {v.totalPrice != null
                            ? `${v.totalPrice.toLocaleString("uk-UA")} грн`
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-500">
                        {new Date(v.updatedAt).toLocaleDateString("uk-UA")}
                        {v.changeSummary ? ` · ${v.changeSummary}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <Link
                          href={`/leads/${leadId}/estimate/${v.id}`}
                          className="font-semibold text-blue-700 hover:underline"
                        >
                          Відкрити
                        </Link>
                        {v.id !== estimateId ? (
                          <button
                            type="button"
                            className="font-semibold text-blue-700 hover:underline"
                            onClick={() => {
                              void (async () => {
                                const j = await postJson<{
                                  estimate?: { id: string };
                                }>(`/api/leads/${leadId}/estimates`, {
                                  cloneFromEstimateId: v.id,
                                });
                                if (j.estimate?.id) {
                                  router.push(
                                    `/leads/${leadId}/estimate/${j.estimate.id}`,
                                  );
                                }
                              })();
                            }}
                          >
                            Копія
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Порівняння версій
            </h3>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Оберіть стару та нову версію (за замовчуванням найстаріша → найновіша).
            </p>
            <div className="mt-3 space-y-2 text-[11px]">
              <div>
                <span className="text-slate-500">З (база)</span>
                <select
                  value={compareFromId ?? ""}
                  onChange={(e) =>
                    setCompareFromId(e.target.value || null)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs"
                >
                  <option value="">—</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} ·{" "}
                      {v.totalPrice != null
                        ? `${v.totalPrice.toLocaleString("uk-UA")} грн`
                        : "—"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-slate-500">До (ціль)</span>
                <select
                  value={compareToId ?? ""}
                  onChange={(e) => setCompareToId(e.target.value || null)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs"
                >
                  <option value="">—</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} ·{" "}
                      {v.totalPrice != null
                        ? `${v.totalPrice.toLocaleString("uk-UA")} грн`
                        : "—"}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={btnPrimary}
                disabled={compareLoading || versions.length < 2}
                onClick={() => void runCompare()}
              >
                {compareLoading ? "Завантаження…" : "Порівняти"}
              </button>
            </div>
            {compareResult ? (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 text-[11px]">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">
                    +{compareResult.summary.added}
                  </span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-900">
                    −{compareResult.summary.removed}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                    ~{compareResult.summary.changed}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-800">
                    Δ{" "}
                    {compareResult.summary.totalDelta >= 0 ? "+" : ""}
                    {compareResult.summary.totalDelta.toLocaleString("uk-UA")}{" "}
                    грн
                  </span>
                </div>
                {compareResult.addedItems.length > 0 ? (
                  <div>
                    <p className="font-semibold text-slate-700">Додано</p>
                    <ul className="mt-1 flex max-h-28 list-disc flex-col gap-0.5 overflow-y-auto pl-4 text-slate-600">
                      {compareResult.addedItems.map((a, i) => (
                        <li key={`a-${i}`}>
                          {a.title} · {a.totalPrice.toLocaleString("uk-UA")} грн
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {compareResult.removedItems.length > 0 ? (
                  <div>
                    <p className="font-semibold text-slate-700">Видалено</p>
                    <ul className="mt-1 flex max-h-28 list-disc flex-col gap-0.5 overflow-y-auto pl-4 text-slate-600">
                      {compareResult.removedItems.map((a, i) => (
                        <li key={`r-${i}`}>
                          {a.title} · {a.totalPrice.toLocaleString("uk-UA")} грн
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {compareResult.changedItems.length > 0 ? (
                  <div>
                    <p className="font-semibold text-slate-700">Змінено</p>
                    <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto text-slate-600">
                      {compareResult.changedItems.map((c, i) => (
                        <li key={`c-${i}`} className="rounded border border-slate-100 bg-slate-50/80 px-2 py-1">
                          <span className="font-medium">{c.title}</span>
                          {c.fields.map((f) => (
                            <div key={f.field} className="text-[10px]">
                              {f.field}: {f.from} → {f.to}
                            </div>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200/90 bg-[var(--enver-card)] p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Матеріали / каталог
            </h3>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
              Оберіть рядок у сметі, потім позицію з пошуку — поля
              заповняться автоматично.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={matQ}
                disabled={readOnly}
                onChange={(e) => setMatQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void searchMat();
                }}
                placeholder="Знайти матеріал або код"
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-sm focus:border-blue-400 focus:bg-[var(--enver-card)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
              />
              <button
                type="button"
                disabled={readOnly}
                className={btnGhost}
                onClick={() => void searchMat()}
              >
                Пошук
              </button>
            </div>
            {matHits.length > 0 ? (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">
                {matHits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      disabled={readOnly}
                      className="w-full rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50/50 disabled:opacity-40"
                      onClick={() => attachMaterial(h)}
                    >
                      <span className="font-medium text-slate-800">
                        {h.label}
                      </span>
                      {h.unitPrice != null ? (
                        <span className="text-slate-600">
                          {" "}
                          · {h.unitPrice.toLocaleString("uk-UA")}{" "}
                          {h.hint ? `(${h.hint})` : ""}
                        </span>
                      ) : h.hint ? (
                        <span className="text-slate-500"> — {h.hint}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </aside>
      </div>

      <footer className="border-t border-slate-200/80 bg-[var(--enver-card)]/90 px-4 py-3 text-slate-400 md:px-8">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-5 w-5 rounded border border-slate-200 bg-slate-50" />
            Документ / журнал
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-5 w-5 rounded border border-slate-200 bg-slate-50" />
            Дані смети
          </span>
        </div>
      </footer>
    </div>
  );
}
