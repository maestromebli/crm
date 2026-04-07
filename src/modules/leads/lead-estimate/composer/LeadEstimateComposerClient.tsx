"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { patchLeadEstimateById } from "../../../../features/leads/lead-estimate-api";
import { parseResponseJson } from "../../../../lib/api/parse-response-json";
import type { CompareEstimateVersionsResult } from "../../../../lib/estimates/compare-estimate-versions";
import type { EstimateCategoryKey } from "../../../../lib/estimates/estimate-categories";
import {
  apiEstimateToVersionModel,
  compareApiToDiffResult,
  computeDiff,
  draftItemsToLinePayload,
  emptyDraftItem,
  materialHitToSnapshot,
  recalcDraftItem,
  recalcVersionTotals,
  roundMoney,
  toDraftItem,
} from "./lead-estimate-composer-mappers";
import type { DiffResult, DraftItem, EstimateVersionModel, LeadMini, MaterialSearchHit, PageMode } from "./lead-estimate-composer-types";
import { mapCatalogHitToMaterialHit } from "./LeadEstimateComposerUiAtoms";
import {
  BottomActionBar,
  ClipboardList,
  DiffPreview,
  DraftBanner,
  EditableItemCard,
  getDraftItemMarker,
  Layers3,
  MetaStrip,
  PageHeader,
  QuickAddPreset,
  ReadonlyItemCard,
  SidebarComposer,
  Sparkles,
  TotalsBlock,
  Wand2,
} from "./LeadEstimateComposerUi";
import { CreateProposalModal } from "../CreateProposalModal";

type EstPayload = {
  id: string;
  version: number;
  status: string;
  totalPrice?: number | null;
  grossMargin?: number | null;
  discountAmount?: number | null;
  deliveryCost?: number | null;
  installationCost?: number | null;
  notes?: string | null;
  changeSummary?: string | null;
  updatedAt?: string;
  lineItems?: Array<{
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

type WorkspaceJson = {
  lead?: {
    title?: string;
    customerName?: string | null;
    phone?: string | null;
    stage?: string | null;
  };
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

function mapStatusUi(s: string, isActive: boolean): "draft" | "current" | "archived" {
  if (isActive) return "current";
  if (s === "DRAFT") return "draft";
  return "archived";
}

export function LeadEstimateComposerClient({
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
  const [leadMini, setLeadMini] = useState<LeadMini>({
    id: leadId,
    title: initialLeadTitle,
    customerName: "",
    phone: "",
    stage: "",
  });
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  const [versionsLight, setVersionsLight] = useState<EstimateVersionModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<PageMode>("view");
  const [draftItems, setDraftItems] = useState<DraftItem[] | null>(null);
  /** Версія, від якої рахуємо diff і fork (зазвичай активна смета ліда). */
  const [forkBaseEstimateId, setForkBaseEstimateId] = useState<string | null>(null);
  const [forkBaseModel, setForkBaseModel] = useState<EstimateVersionModel | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [estimateName, setEstimateName] = useState("Розрахунок");
  const [searchState, setSearchState] = useState<Record<string, string>>({});
  const [matHits, setMatHits] = useState<Record<string, MaterialSearchHit[]>>({});
  const matTimer = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const [compareFromId, setCompareFromId] = useState<string>("");
  const [compareToId, setCompareToId] = useState<string>("");
  const [compareDiff, setCompareDiff] = useState<DiffResult | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [rEst, rWs] = await Promise.all([
        fetch(`/api/leads/${leadId}/estimates/${estimateId}`),
        fetch(`/api/leads/${leadId}/estimate-workspace`),
      ]);
      const j = await parseResponseJson<{
        estimate?: EstPayload;
        leadTitle?: string;
        isCurrent?: boolean;
        error?: string;
      }>(rEst);
      if (!rEst.ok) throw new Error(j.error ?? "Помилка");
      if (!j.estimate) throw new Error("Немає даних");
      setEst(j.estimate);
      if (typeof j.leadTitle === "string") {
        setLeadMini((m) => ({ ...m, title: j.leadTitle! }));
      }

      const ws = await parseResponseJson<WorkspaceJson>(rWs);
      if (rWs.ok && ws.lead) {
        const titleFromWs = ws.lead.title?.trim();
        setLeadMini({
          id: leadId,
          title: titleFromWs || initialLeadTitle,
          customerName: ws.lead.customerName ?? "",
          phone: ws.lead.phone ?? "",
          stage: ws.lead.stage ?? "",
        });
        const cur = ws.estimate?.currentVersionId ?? null;
        setActiveEstimateId(cur);
        const hist = ws.versionHistory ?? [];
        setVersionsLight(
          hist.map((h) => ({
            id: h.id,
            versionNumber: h.versionNumber,
            status: mapStatusUi(h.status, h.id === cur),
            changeNote: h.changeNote ?? null,
            currency: "UAH",
            createdAt: h.createdAt,
            createdBy: "—",
            items: [],
            subtotal: h.total ?? 0,
            total: h.total ?? 0,
          })),
        );
        if (hist.length >= 2) {
          setCompareFromId(hist[hist.length - 1]!.id);
          setCompareToId(hist[0]!.id);
        } else if (hist.length === 1) {
          setCompareFromId(hist[0]!.id);
          setCompareToId(hist[0]!.id);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
      setEst(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, estimateId, initialLeadTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedModel = useMemo(() => {
    if (!est) return null;
    return apiEstimateToVersionModel({
      id: est.id,
      version: est.version,
      status: est.status,
      totalPrice: est.totalPrice ?? null,
      changeSummary: est.changeSummary ?? null,
      createdAt: est.updatedAt ?? new Date().toISOString(),
      createdByName: null,
      isActiveCurrent: activeEstimateId === est.id,
      lineItems: est.lineItems ?? [],
    });
  }, [est, activeEstimateId]);

  /** Поточна (активна для ліда) версія — для кнопки «Нова версія з v…». */
  const headerCurrentVersion = useMemo(() => {
    const row =
      activeEstimateId && versionsLight.length
        ? versionsLight.find((v) => v.id === activeEstimateId)
        : null;
    if (!row) return selectedModel;
    return {
      ...selectedModel,
      id: row.id,
      versionNumber: row.versionNumber,
      status: row.status,
      total: row.total,
      subtotal: row.subtotal,
    };
  }, [activeEstimateId, versionsLight, selectedModel]);

  const liveDiff = useMemo(() => {
    if (!draftItems || !forkBaseModel) return null;
    return computeDiff(forkBaseModel, draftItems);
  }, [draftItems, forkBaseModel]);

  const draftTotals = useMemo(() => {
    if (!draftItems) return { subtotal: 0, total: 0 };
    return recalcVersionTotals(draftItems);
  }, [draftItems]);

  const publishDisabled = useMemo(() => {
    if (!draftItems || !liveDiff) return true;
    const hasChanges =
      liveDiff.added.length ||
      liveDiff.removed.length ||
      liveDiff.changed.length;
    const hasValidItem = draftItems.some((item) => item.title.trim().length > 0);
    return !hasChanges || !hasValidItem;
  }, [draftItems, liveDiff]);

  const fetchEstimateById = async (id: string): Promise<EstPayload | null> => {
    const r = await fetch(`/api/leads/${leadId}/estimates/${id}`);
    const j = await parseResponseJson<{ estimate?: EstPayload; error?: string }>(
      r,
    );
    if (!r.ok || !j.estimate) return null;
    return j.estimate;
  };

  const startNewVersion = async () => {
    const baseId = activeEstimateId ?? est?.id;
    if (!baseId) return;
    const baseEst = await fetchEstimateById(baseId);
    if (!baseEst) return;
    const model = apiEstimateToVersionModel({
      id: baseEst.id,
      version: baseEst.version,
      status: baseEst.status,
      totalPrice: baseEst.totalPrice ?? null,
      changeSummary: baseEst.changeSummary ?? null,
      createdAt: baseEst.updatedAt ?? new Date().toISOString(),
      createdByName: null,
      isActiveCurrent: activeEstimateId === baseEst.id,
      lineItems: baseEst.lineItems ?? [],
    });
    setForkBaseEstimateId(baseEst.id);
    setForkBaseModel(model);
    if (model.items.length) {
      setDraftItems(model.items.map((vi) => recalcDraftItem(toDraftItem(vi))));
    } else {
      setDraftItems([recalcDraftItem(emptyDraftItem(1))]);
    }
    setChangeNote("");
    setMode("draft");
  };

  const discardDraft = () => {
    setMode("view");
    setDraftItems(null);
    setForkBaseModel(null);
    setForkBaseEstimateId(null);
    setChangeNote("");
    setSearchState({});
  };

  const publishVersion = async () => {
    if (!draftItems || !forkBaseEstimateId || publishDisabled) return;
    setErr(null);
    try {
      const linePayload = draftItemsToLinePayload(draftItems);
      const j = await patchLeadEstimateById<{
        error?: string;
        estimate?: { id: string };
        estimateIdChanged?: boolean;
      }>(leadId, forkBaseEstimateId, {
        lineItems: linePayload,
        changeSummary: changeNote.trim().slice(0, 500) || "Нова версія (composer)",
        versioning: "fork",
        forceNewVersion: true,
      });
      discardDraft();
      if (j.estimateIdChanged && j.estimate?.id) {
        router.replace(`/leads/${leadId}/estimate/${j.estimate.id}`);
        router.refresh();
      } else {
        await load();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  };

  const updateDraftItem = (tempId: string, patch: Partial<DraftItem>) => {
    setDraftItems((prev) => {
      if (!prev) return prev;
      return prev.map((item) => {
        if (item.tempId !== tempId) return item;
        return recalcDraftItem({ ...item, ...patch });
      });
    });
  };

  const addDraftItem = (preset?: Partial<DraftItem>) => {
    setDraftItems((prev) => {
      const current = prev ?? [];
      const created = recalcDraftItem({
        ...emptyDraftItem(current.length + 1),
        ...preset,
      });
      return [...current, created].map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }));
    });
  };

  const duplicateDraftItem = (tempId: string) => {
    setDraftItems((prev) => {
      if (!prev) return prev;
      const source = prev.find((item) => item.tempId === tempId);
      if (!source) return prev;
      const clone = recalcDraftItem({
        ...source,
        tempId: `temp_${Math.random().toString(36).slice(2)}`,
        baseItemId: undefined,
      });
      return [...prev, clone].map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }));
    });
  };

  const removeDraftItem = (tempId: string) => {
    setDraftItems((prev) => {
      if (!prev) return prev;
      return prev
        .filter((item) => item.tempId !== tempId)
        .map((item, index) => ({ ...item, sortOrder: index + 1 }));
    });
  };

  const applyMaterial = (tempId: string, material: MaterialSearchHit) => {
    const snap = materialHitToSnapshot(material);
    updateDraftItem(tempId, {
      title: material.name,
      supplier: material.supplier,
      supplierMaterialId: material.materialId,
      supplierMaterialCode: material.code,
      supplierMaterialName: material.name,
      supplierPriceSnapshot: snap,
      unitPrice: material.price,
      unitPriceSource: "supplier_snapshot",
    });
  };

  const resetSupplierPrice = (tempId: string) => {
    const target = draftItems?.find((item) => item.tempId === tempId);
    if (!target?.supplierPriceSnapshot) return;
    updateDraftItem(tempId, {
      unitPrice: target.supplierPriceSnapshot.price,
      unitPriceSource: "supplier_snapshot",
    });
  };

  const scheduleMaterialSearch = (tempId: string, raw: string) => {
    if (matTimer.current[tempId]) clearTimeout(matTimer.current[tempId]!);
    matTimer.current[tempId] = setTimeout(async () => {
      const q = raw.trim();
      if (!q) {
        setMatHits((h) => ({ ...h, [tempId]: [] }));
        return;
      }
      try {
        const r = await fetch(
          `/api/materials/search?q=${encodeURIComponent(q)}&limit=8`,
        );
        const j = await parseResponseJson<{
          items?: Array<{
            id: string;
            label: string;
            hint?: string;
            unitPrice?: number;
            providerKey?: string;
          }>;
        }>(r);
        const hits = (j.items ?? []).map(mapCatalogHitToMaterialHit);
        setMatHits((h) => ({ ...h, [tempId]: hits }));
      } catch {
        setMatHits((h) => ({ ...h, [tempId]: [] }));
      }
    }, 250);
  };

  useEffect(() => {
    const box = matTimer;
    return () => {
      const timers = box.current;
      for (const t of Object.values(timers)) {
        if (t) clearTimeout(t);
      }
    };
  }, []);

  const fetchCompare = useCallback(
    async (fromId: string, toId: string) => {
      if (!fromId || !toId || fromId === toId) return;
      setErr(null);
      try {
        const r = await fetch(
          `/api/leads/${leadId}/estimates/compare?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`,
        );
        const j = await parseResponseJson<
          { error?: string } & CompareEstimateVersionsResult
        >(r);
        if (!r.ok) throw new Error(j.error ?? "Помилка");
        setCompareDiff(compareApiToDiffResult(j));
        setCompareFromId(fromId);
        setCompareToId(toId);
        setMode("compare");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Помилка");
      }
    },
    [leadId],
  );

  const applyVersionAsBase = async (versionId: string) => {
    const e = await fetchEstimateById(versionId);
    if (!e) return;
    const model = apiEstimateToVersionModel({
      id: e.id,
      version: e.version,
      status: e.status,
      totalPrice: e.totalPrice ?? null,
      changeSummary: e.changeSummary ?? null,
      createdAt: e.updatedAt ?? new Date().toISOString(),
      createdByName: null,
      isActiveCurrent: activeEstimateId === e.id,
      lineItems: e.lineItems ?? [],
    });
    setForkBaseEstimateId(e.id);
    setForkBaseModel(model);
    setDraftItems(
      model.items.length
        ? model.items.map((vi) => recalcDraftItem(toDraftItem(vi)))
        : [recalcDraftItem(emptyDraftItem(1))],
    );
    setChangeNote(`На базі v${e.version}`);
    setMode("draft");
  };

  const onSelectVersion = (id: string) => {
    router.push(`/leads/${leadId}/estimate/${id}`);
  };

  const summaryHint =
    est && selectedModel
      ? `v${est.version} · ${selectedModel.items.length} поз. · ${roundMoney(selectedModel.total)} грн`
      : "";

  if (loading || !est || !selectedModel) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-zinc-50 text-zinc-500">
        {err && !est ? err : "Завантаження…"}
      </div>
    );
  }

  const viewItems = mode === "view" ? selectedModel.items : [];
  const compareFromModel =
    versionsLight.find((v) => v.id === compareFromId) ?? versionsLight[0] ?? selectedModel;
  const compareToModel =
    versionsLight.find((v) => v.id === compareToId) ?? versionsLight[0] ?? selectedModel;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-zinc-50 text-zinc-950">
      <CreateProposalModal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        leadId={leadId}
        estimateId={activeEstimateId ?? estimateId}
        estimateVersion={est.version}
        totalPrice={est.totalPrice ?? selectedModel.total}
        defaultTitle={`КП v${est.version}`}
        summaryHint={summaryHint}
        kpVisualizationRows={[]}
      />

      <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
        {err ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
            {err}
          </p>
        ) : null}

        <PageHeader
          lead={leadMini}
          leadHref={`/leads/${leadId}`}
          currentVersion={headerCurrentVersion}
          selectedVersion={selectedModel}
          mode={mode}
          onBackToView={() => {
            setMode("view");
            setCompareDiff(null);
          }}
          onNewVersion={() => void startNewVersion()}
          onCreateProposal={() => setProposalOpen(true)}
        />

        {mode === "draft" && forkBaseModel ? (
          <DraftBanner
            baseVersion={forkBaseModel.versionNumber}
            nextVersion={forkBaseModel.versionNumber + 1}
            onDiscard={discardDraft}
            onPreview={() => {
              document.getElementById("diff-preview")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            onPublish={() => void publishVersion()}
            disabled={publishDisabled}
          />
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <MetaStrip
              estimateName={estimateName}
              setEstimateName={setEstimateName}
              mode={mode}
              currency="UAH"
              basedOn={
                mode === "draft" && forkBaseModel
                  ? `v${forkBaseModel.versionNumber}`
                  : undefined
              }
              changeNote={changeNote}
              setChangeNote={setChangeNote}
            />

            {mode === "view" && (
              <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
                <SectionTitleLocal
                  icon={<ClipboardList className="h-4 w-4" />}
                  title={`Позиції v${selectedModel.versionNumber}`}
                  description="Перегляд збереженої версії. Для змін створіть нову версію."
                />
                <div className="mt-5 space-y-4">
                  {viewItems.map((item) => (
                    <ReadonlyItemCard
                      key={item.id}
                      item={item}
                      currency={selectedModel.currency}
                    />
                  ))}
                </div>
                <TotalsBlock
                  total={selectedModel.total}
                  subtotal={selectedModel.subtotal}
                  itemsCount={selectedModel.items.length}
                  manualAdjustments={
                    selectedModel.items.filter((i) => i.unitPriceSource === "manual")
                      .length
                  }
                  delta={0}
                  currency={selectedModel.currency}
                />
              </section>
            )}

            {mode === "draft" && draftItems && forkBaseModel ? (
              <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
                <SectionTitleLocal
                  icon={<Wand2 className="h-4 w-4" />}
                  title={`Нова версія (база v${forkBaseModel.versionNumber})`}
                  description="Редагується чернетка. Публікація створить нову версію смети."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <QuickAddPreset
                        label="Фасад"
                        onClick={() =>
                          addDraftItem({ categoryKey: "facades" as EstimateCategoryKey })
                        }
                      />
                      <QuickAddPreset
                        label="Корпус"
                        onClick={() =>
                          addDraftItem({ categoryKey: "cabinets" as EstimateCategoryKey })
                        }
                      />
                      <QuickAddPreset
                        label="Фурнітура"
                        onClick={() =>
                          addDraftItem({ categoryKey: "fittings" as EstimateCategoryKey })
                        }
                      />
                      <QuickAddPreset
                        label="Монтаж"
                        onClick={() =>
                          addDraftItem({
                            categoryKey: "installation" as EstimateCategoryKey,
                          })
                        }
                      />
                    </div>
                  }
                />

                <div className="mt-5 space-y-4">
                  {draftItems.map((item) => {
                    const marker = forkBaseModel
                      ? getDraftItemMarker(item, forkBaseModel, liveDiff)
                      : null;
                    return (
                      <EditableItemCard
                        key={item.tempId}
                        item={item}
                        marker={marker}
                        searchQuery={searchState[item.tempId] ?? ""}
                        onSearchQueryChange={(value) => {
                          setSearchState((prev) => ({ ...prev, [item.tempId]: value }));
                          scheduleMaterialSearch(item.tempId, value);
                        }}
                        materialHits={matHits[item.tempId] ?? []}
                        onChange={(patch) => updateDraftItem(item.tempId, patch)}
                        onSelectMaterial={(m) => applyMaterial(item.tempId, m)}
                        onDuplicate={() => duplicateDraftItem(item.tempId)}
                        onRemove={() => removeDraftItem(item.tempId)}
                        onResetSupplierPrice={() => resetSupplierPrice(item.tempId)}
                      />
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => addDraftItem()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
                  >
                    <Plus className="h-4 w-4" />
                    Додати позицію
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
                    <Sparkles className="h-4 w-4" />
                    Швидкий комерційний ввід
                  </div>
                </div>

                <TotalsBlock
                  total={draftTotals.total}
                  subtotal={draftTotals.subtotal}
                  itemsCount={draftItems.length}
                  manualAdjustments={
                    draftItems.filter((i) => i.unitPriceSource === "manual").length
                  }
                  delta={draftTotals.total - forkBaseModel.total}
                  currency={forkBaseModel.currency}
                />
              </section>
            ) : null}

            {mode === "compare" && compareDiff ? (
              <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
                <SectionTitleLocal
                  icon={<Layers3 className="h-4 w-4" />}
                  title={`Порівняння v${compareFromModel.versionNumber} → v${compareToModel.versionNumber}`}
                  description="Зміни між вибраними версіями."
                />
                <DiffPreview
                  diff={compareDiff}
                  currency={compareToModel.currency}
                  title="Результат порівняння"
                />
              </section>
            ) : null}

            {mode === "draft" && liveDiff ? (
              <div id="diff-preview">
                <DiffPreview
                  diff={liveDiff}
                  currency={forkBaseModel!.currency}
                  title={`Перегляд змін перед v${forkBaseModel!.versionNumber + 1}`}
                />
              </div>
            ) : null}

            {mode === "draft" && forkBaseModel ? (
              <BottomActionBar
                nextVersion={forkBaseModel.versionNumber + 1}
                total={draftTotals.total}
                disabled={publishDisabled}
                onDiscard={discardDraft}
                onPublish={() => void publishVersion()}
              />
            ) : null}
          </div>

          <SidebarComposer
            mode={mode}
            currentVersion={
              mode === "draft" && forkBaseModel ? forkBaseModel : headerCurrentVersion
            }
            selectedVersion={selectedModel}
            compareFrom={compareFromModel}
            compareTo={compareToModel}
            draftTotal={draftTotals.total}
            draftItemsCount={draftItems?.length ?? 0}
            diff={mode === "draft" ? liveDiff : mode === "compare" ? compareDiff : null}
            versions={versionsLight}
            compareFromId={compareFromId}
            compareToId={compareToId}
            onSelectVersion={onSelectVersion}
            onUseAsBase={(id) => void applyVersionAsBase(id)}
            onCompare={(id) => {
              const to = activeEstimateId ?? estimateId;
              void fetchCompare(id, to);
            }}
            onChangeCompareFrom={setCompareFromId}
            onChangeCompareTo={setCompareToId}
            onOpenCompareMode={() => void fetchCompare(compareFromId, compareToId)}
            onNewVersion={() => void startNewVersion()}
            onCreateProposal={() => setProposalOpen(true)}
            leadId={leadId}
          />
        </div>
      </div>
    </div>
  );
}

function SectionTitleLocal({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <span className="rounded-xl bg-zinc-100 p-2 text-zinc-700">{icon}</span>
          {title}
        </div>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
      </div>
      {action}
    </div>
  );
}
