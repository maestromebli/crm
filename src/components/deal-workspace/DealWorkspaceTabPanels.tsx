"use client";

import type {
  AttachmentCategory,
  DealContractStatus,
  HandoffStatus,
} from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DealAttachmentSummary,
  DealContractDraft,
  DealWorkspacePayload,
  HandoffManifest,
} from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { DEAL_WORKSPACE_TABS } from "./deal-workspace-tabs";
import { EstimateWorkspaceTab } from "./tabs/EstimateWorkspaceTab";
import { TasksWorkspaceTab } from "./tabs/TasksWorkspaceTab";
import { DealFinanceProcurementTab } from "./tabs/DealFinanceProcurementTab";
import { ConstructorRoomPanel } from "./ConstructorRoomPanel";
import { dispatchDealTasksUpdated } from "../../features/ai-assistant/utils/dispatchDealTasksUpdated";
import { cn } from "../../lib/utils";
import type { DealStageAiId, DealStageInsight } from "../../lib/ai-workflow/types";
import { DEAL_CORE_STAGE_FORMS } from "../../config/forms";
import { useDealWorkspaceToast } from "./DealWorkspaceToast";
import { CommunicationHub } from "../../features/communication/ui/CommunicationHub";
import { readResponseJson } from "@/lib/http/read-response-json";
import { ProductionOrchestrationHandoffPanel } from "./ProductionOrchestrationHandoffPanel";
import {
  getEstimateVersusDealValueHint,
} from "../../features/deal-workspace/deal-workspace-warnings";
import {
  patchDealContractByDealId,
  patchDealHandoffByDealId,
  patchDealProductionLaunchByDealId,
  patchTaskById,
  patchWorkspaceMetaByDealId,
} from "../../features/deal-workspace/use-deal-mutation-actions";
import { postJson } from "../../lib/api/patch-json";
import { SyncDealValueFromEstimateButton } from "./SyncDealValueFromEstimateButton";
import { derivePaymentStripSummaryForPayload } from "../../features/deal-workspace/payment-aggregate";
import { REALTIME_POLICY } from "../../config/realtime-policy";
import { dealQueryKeys } from "../../features/deal-workspace/deal-query-keys";
import { DealHubPage } from "@/modules/deal-hub/ui/components/DealHubPage";
import {
  getConstructorWorkspaceState,
  getCriticalBlockers,
  getDealViewRole,
  getProductionPackageStatus,
  getProductionReadiness,
  type DealViewRole,
} from "../../features/deal-workspace/deal-view-selectors";
import {
  ConstructorWorkspace,
  ConstructorWorkspaceTabs,
  DealTransferHub,
  FinalActionArea,
  HandoffChecklist,
  HandoffHistory,
  ProductionPackage,
  ProductionReadiness,
} from "./DealTransferHub";

function renderTemplatePreview(
  contentHtml: string,
  variables: Record<string, string> | undefined,
): string {
  const vars = variables ?? {};
  return contentHtml.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, k: string) => {
    return (vars[k] ?? "").trim();
  });
}

function sanitizePreviewHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
}

const DEAL_CONTRACT_PREVIEW_STORAGE = "enver:dealContractPreview:";

type DealContractPreviewPrefs = {
  tab: "pdf" | "html";
  zoom: number;
};

function clampPdfZoom(z: number): number {
  return Math.min(200, Math.max(50, Math.round(z / 10) * 10));
}

function readDealContractPreviewPrefs(
  dealId: string,
): Partial<Pick<DealContractPreviewPrefs, "tab" | "zoom">> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEAL_CONTRACT_PREVIEW_STORAGE + dealId);
    if (!raw) return null;
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return null;
    const o = j as Record<string, unknown>;
    const tab = o.tab === "pdf" || o.tab === "html" ? o.tab : undefined;
    const zoom = typeof o.zoom === "number" && Number.isFinite(o.zoom) ? o.zoom : undefined;
    return { ...(tab ? { tab } : {}), ...(zoom != null ? { zoom } : {}) };
  } catch {
    return null;
  }
}

function writeDealContractPreviewPrefs(dealId: string, prefs: DealContractPreviewPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEAL_CONTRACT_PREVIEW_STORAGE + dealId, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode
  }
}

import { DEAL_DOCUMENT_TEMPLATES } from "../../lib/deals/document-templates";

function extractTemplateVariableKeys(contentHtml: string): string[] {
  const out = new Set<string>();
  const matches = contentHtml.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g);
  for (const m of matches) {
    if (m[1]) out.add(m[1]);
  }
  return [...out];
}

function statusUa(s: DealContractStatus): string {
  const m: Record<DealContractStatus, string> = {
    DRAFT: "Чернетка",
    GENERATED: "Згенеровано",
    EDITED: "Відредаговано",
    PENDING_INTERNAL_APPROVAL: "На погодженні",
    APPROVED_INTERNAL: "Погоджено",
    SENT_FOR_SIGNATURE: "Надіслано на підпис",
    VIEWED_BY_CLIENT: "Переглянуто клієнтом",
    CLIENT_SIGNED: "Підпис клієнта",
    COMPANY_SIGNED: "Підпис компанії",
    FULLY_SIGNED: "Повністю підписано",
    DECLINED: "Відхилено",
    EXPIRED: "Прострочено",
    SUPERSEDED: "Замінено версією",
  };
  return m[s];
}

const CONTRACT_STATUSES: DealContractStatus[] = [
  "DRAFT",
  "GENERATED",
  "EDITED",
  "PENDING_INTERNAL_APPROVAL",
  "APPROVED_INTERNAL",
  "SENT_FOR_SIGNATURE",
  "VIEWED_BY_CLIENT",
  "CLIENT_SIGNED",
  "COMPANY_SIGNED",
  "FULLY_SIGNED",
  "DECLINED",
  "EXPIRED",
  "SUPERSEDED",
];

const ATTACH_CATEGORIES: { value: AttachmentCategory; label: string }[] = [
  { value: "DRAWING", label: "Креслення" },
  { value: "MEASUREMENT_SHEET", label: "Лист заміру" },
  { value: "QUOTE_PDF", label: "КП (PDF)" },
  { value: "CONTRACT", label: "Договір" },
  { value: "PAYMENT_CONFIRMATION", label: "Підтвердження оплати" },
  { value: "OTHER", label: "Інше" },
];

const btn =
  "rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[var(--enver-hover)]";

const patchMeta = patchWorkspaceMetaByDealId;
const patchHandoff = patchDealHandoffByDealId;
const patchProductionLaunch = patchDealProductionLaunchByDealId;

function handoffStatusUa(s: HandoffStatus): string {
  const m: Record<HandoffStatus, string> = {
    DRAFT: "Чернетка",
    SUBMITTED: "На прийнятті",
    ACCEPTED: "Прийнято",
    REJECTED: "Повернуто",
  };
  return m[s];
}

function attachmentCategoryLabel(category: AttachmentCategory): string {
  return ATTACH_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/** Повертає id вкладень для UI з маніфесту (у т.ч. legacy лише по fileAssetId). */
function initialHandoffSelectedAttachmentIds(
  attachments: DealAttachmentSummary[],
  manifest: HandoffManifest,
): string[] {
  if (manifest.selectedAttachmentIds.length > 0) return manifest.selectedAttachmentIds;
  if (manifest.selectedFileAssetIds.length === 0) return [];
  const assetSet = new Set(manifest.selectedFileAssetIds);
  const ids: string[] = [];
  for (const a of attachments) {
    if (a.fileAssetId && assetSet.has(a.fileAssetId)) ids.push(a.id);
  }
  return ids;
}

function deriveHandoffManifestFiles(
  attachments: DealAttachmentSummary[],
  selectedAttachmentIds: string[],
): Pick<HandoffManifest, "selectedAttachmentIds" | "selectedFileAssetIds"> {
  const sel = new Set(selectedAttachmentIds);
  const fileAssetIds: string[] = [];
  for (const a of attachments) {
    if (sel.has(a.id) && a.fileAssetId) fileAssetIds.push(a.fileAssetId);
  }
  return {
    selectedAttachmentIds: [...selectedAttachmentIds],
    selectedFileAssetIds: [...new Set(fileAssetIds)],
  };
}

function useWorkspaceRun(dealId: string) {
  const queryClient = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setErr(null);
      setBusy(true);
      try {
        await fn();
        await queryClient.invalidateQueries({
          queryKey: dealQueryKeys.workspace(dealId),
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Помилка");
      } finally {
        setBusy(false);
      }
    },
    [dealId, queryClient],
  );
  return { err, busy, run };
}

function StageAiAssistantCard({
  stage,
  data,
}: {
  stage: DealStageAiId;
  data: DealWorkspacePayload;
}) {
  const [insight, setInsight] = useState<DealStageInsight | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/deals/${data.deal.id}/ai-stage-insight?stage=${stage}`,
          { cache: "no-store" },
        );
        const j = (await r.json().catch(() => ({}))) as {
          insight?: DealStageInsight;
        };
        if (!cancelled) setInsight(j.insight ?? null);
      } catch {
        if (!cancelled) setInsight(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.deal.id, stage]);

  const risks = insight?.risks?.length
    ? insight.risks
    : ["Етап у доброму стані. Перевірте наступний крок у командному центрі."];
  const updates = insight?.recommendedUpdates ?? [];

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
        AI Асистент етапу
      </p>
      <p className="mt-1 text-xs text-indigo-900">
        {insight?.summary ?? "Формуємо інсайт..."}
      </p>
      <p className="mt-1 text-xs text-indigo-800/90">
        Наступний крок: {insight?.nextAction ?? "очікується"}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-indigo-900">
        {risks.slice(0, 3).map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {updates.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-indigo-700">
          {updates.slice(0, 2).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StageFormTemplateCard({
  stage,
  roleView,
}: {
  stage: keyof typeof DEAL_CORE_STAGE_FORMS;
  roleView: "director" | "head" | "sales";
}) {
  const tpl = DEAL_CORE_STAGE_FORMS[stage];
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
        Шаблон форми етапу
      </p>
      <ul className="mt-2 space-y-1 text-xs text-slate-700">
        {tpl.sections
          .filter((s) => !s.roleVisibility || s.roleVisibility.includes(roleView))
          .slice(0, 3)
          .map((s) => (
            <li key={s.id}>
              <span className="font-medium">{s.label}:</span>{" "}
              {(s.requiredFields ?? []).join(", ") || "без обов'язкових полів"}
            </li>
          ))}
      </ul>
    </div>
  );
}

function ContractTab({
  data,
  roleView,
}: {
  data: DealWorkspacePayload;
  roleView: "director" | "head" | "sales";
}) {
  const { err, busy, run } = useWorkspaceRun(data.deal.id);
  const [cStatus, setCStatus] = useState(
    data.contract?.status ?? "DRAFT",
  );
  const [draft, setDraft] = useState<DealContractDraft | null>(
    data.contract?.draft ?? null,
  );
  const [savedSnapshot, setSavedSnapshot] = useState<string>(
    JSON.stringify(data.contract?.draft ?? null),
  );
  const [lastSavedDraft, setLastSavedDraft] = useState<DealContractDraft | null>(
    data.contract?.draft ?? null,
  );
  const [autoSaveBusy, setAutoSaveBusy] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const [requiredOnlyMode, setRequiredOnlyMode] = useState(false);
  const [fieldActivity, setFieldActivity] = useState<
    Array<{ key: string; label: string; at: string }>
  >([]);
  const [diiaTaskBusyId, setDiiaTaskBusyId] = useState<string | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [docPreviewTab, setDocPreviewTab] = useState<"pdf" | "html">("pdf");
  const [pdfZoom, setPdfZoom] = useState(100);
  const previewPrefsReady = useRef(false);
  const skipNextPreviewPersist = useRef(false);
  const previewPersistZoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedPreviewTab = useRef<"pdf" | "html">(docPreviewTab);
  const lastPersistedPreviewZoom = useRef(pdfZoom);
  const [diiaTasks, setDiiaTasks] = useState<
    Array<{
      id: string;
      title: string;
      status: string;
      dueAt: string | null;
      updatedAt: string;
      resultComment?: string | null;
    }>
  >([]);
  const [diiaTasksLoading, setDiiaTasksLoading] = useState(false);
  const [diiaTasksErr, setDiiaTasksErr] = useState<string | null>(null);
  const [highlightedStep, setHighlightedStep] = useState<1 | 2 | 3 | null>(null);
  const { showToast } = useDealWorkspaceToast();
  useEffect(() => {
    setCStatus(data.contract?.status ?? "DRAFT");
    setDraft(data.contract?.draft ?? null);
    setSavedSnapshot(JSON.stringify(data.contract?.draft ?? null));
    setLastSavedDraft(data.contract?.draft ?? null);
    setAutoSavedAt(null);
  }, [data.contract?.status, data.contract?.draft]);

  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  const availableTemplates = useMemo(
    () =>
      DEAL_DOCUMENT_TEMPLATES.filter(
        (t) =>
          t.documentType === (draft?.documentType ?? "CONTRACT") &&
          t.format === (draft?.format ?? "HTML"),
      ),
    [draft?.documentType, draft?.format],
  );
  useEffect(() => {
    if (!draft) return;
    const exists = availableTemplates.some((t) => t.key === draft.templateKey);
    if (!exists && availableTemplates[0]) {
      setDraft({ ...draft, templateKey: availableTemplates[0].key });
    }
  }, [availableTemplates, draft]);
  const draftJson = JSON.stringify(draft ?? null);
  const hasUnsavedChanges = draftJson !== savedSnapshot;
  const requiredKeys = [
    "customerFullName",
    "contractSubject",
    "contractAmount",
    "paymentTerms",
  ] as const;
  const missingRequired =
    draft == null
      ? []
      : requiredKeys.filter((k) => !(draft.variables?.[k] ?? "").trim());
  const requiredLabelByKey: Record<(typeof requiredKeys)[number], string> = {
    customerFullName: "ПІБ/Назва замовника",
    contractSubject: "Предмет договору",
    contractAmount: "Сума договору",
    paymentTerms: "Умови оплати",
  };
  const requiredSet = new Set<string>(requiredKeys);
  const templateVariableKeys = draft
    ? extractTemplateVariableKeys(draft.contentHtml)
    : [];
  const emptyTemplateKeys = templateVariableKeys.filter(
    (k) => !(draft?.variables?.[k] ?? "").trim(),
  );
  const templateQualityScore =
    templateVariableKeys.length === 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((templateVariableKeys.length - emptyTemplateKeys.length) /
                templateVariableKeys.length) *
                100,
            ),
          ),
        );
  const blockVersionActions =
    missingRequired.length > 0 || emptyTemplateKeys.length > 0;
  const qualityScore = Math.max(
    0,
    Math.min(100, Math.round(((requiredKeys.length - missingRequired.length) / requiredKeys.length) * 100)),
  );
  const overallReadiness = Math.round((qualityScore + templateQualityScore) / 2);
  const nextActionLabel = !data.contract
    ? "Створіть чернетку договору"
    : missingRequired.length > 0
      ? "Заповніть обовʼязкові поля"
      : emptyTemplateKeys.length > 0
        ? "Заповніть змінні шаблону ({{...}})"
        : data.contract.version > 1
          ? "Експортуйте PDF/DOCX"
          : "Створіть версію документа";
  const markStepDone = useCallback(
    (step: 1 | 2 | 3, message: string) => {
      setHighlightedStep(step);
      showToast(message, { onDismiss: () => setHighlightedStep(null) });
    },
    [showToast],
  );
  const buildQuickFilledDraft = (base: DealContractDraft): DealContractDraft => {
    const today = new Date().toLocaleDateString("uk-UA");
    const expectedCloseDate = data.deal.expectedCloseDate
      ? new Date(data.deal.expectedCloseDate).toLocaleDateString("uk-UA")
      : "";
    const contractNumberFallback = `DL-${data.deal.id.slice(-6).toUpperCase()}`;
    const templateKeys = extractTemplateVariableKeys(base.contentHtml);
    const knownKeys = [
      "dealNumber",
      "clientName",
      "dealTitle",
      "dealValue",
      "dealCurrency",
      "contractNumber",
      "contractDate",
      "customerFullName",
      "customerTaxId",
      "customerAddress",
      "contractSubject",
      "contractAmount",
      "executionTerm",
      "paymentTerms",
      "contractorFullName",
      "contractorTaxId",
      "contractorAddress",
    ];
    const allKeys = [...new Set([...knownKeys, ...templateKeys])];
    const customerLabel =
      base.recipientType === "CLIENT_COMPANY"
        ? data.client.name
        : data.primaryContact?.fullName || data.client.name;
    const valueAsText =
      typeof data.deal.value === "number" ? String(data.deal.value) : "";
    const currency = (data.deal.currency ?? "UAH").trim() || "UAH";
    const seededVariables: Record<string, string> = {
      ...(base.variables ?? {}),
      dealNumber:
        base.variables?.dealNumber ||
        base.variables?.contractNumber ||
        contractNumberFallback,
      clientName: base.variables?.clientName || data.client.name,
      dealTitle: base.variables?.dealTitle || data.deal.title,
      dealValue: base.variables?.dealValue || valueAsText,
      dealCurrency: base.variables?.dealCurrency || currency,
      contractNumber:
        base.variables?.contractNumber ||
        base.variables?.dealNumber ||
        contractNumberFallback,
      contractDate: base.variables?.contractDate || today,
      customerFullName: base.variables?.customerFullName || customerLabel,
      customerTaxId:
        base.variables?.customerTaxId ||
        (base.recipientType === "CLIENT_COMPANY"
          ? "ЄДРПОУ уточнюється"
          : "РНОКПП уточнюється"),
      customerAddress:
        base.variables?.customerAddress || data.deal.description || "уточнюється",
      contractSubject: base.variables?.contractSubject || data.deal.title,
      contractAmount:
        base.variables?.contractAmount ||
        [valueAsText, currency].filter(Boolean).join(" "),
      executionTerm:
        base.variables?.executionTerm || expectedCloseDate || "за погодженим графіком",
      paymentTerms:
        base.variables?.paymentTerms || "Оплата згідно погодженого графіка.",
      contractorFullName:
        base.variables?.contractorFullName ||
        data.owner.name ||
        data.owner.email,
      contractorTaxId: base.variables?.contractorTaxId || "уточнюється",
      contractorAddress: base.variables?.contractorAddress || "уточнюється",
    };
    for (const key of allKeys) {
      if ((seededVariables[key] ?? "").trim()) continue;
      seededVariables[key] = "уточнюється";
    }
    return {
      ...base,
      variables: seededVariables,
    };
  };
  const draftReady = !blockVersionActions;
  const hasDocumentArtifacts =
    Boolean(data.contract?.signedPdfUrl) ||
    data.attachmentsByCategory.CONTRACT > 0 ||
    data.attachmentsByCategory.SPEC > 0;
  const step1Done = draftReady;
  const step2Done = data.contract ? data.contract.version > 1 : false;
  const step3Done = hasDocumentArtifacts;
  const paymentStripContract = useMemo(
    () => derivePaymentStripSummaryForPayload(data),
    [data],
  );
  const estimateVersusDealHint = useMemo(
    () => getEstimateVersusDealValueHint(data),
    [data],
  );
  const contractHappySteps = useMemo(() => {
    if (!data.contract) return null;
    const c = data.contract;
    const signed =
      c.status === "FULLY_SIGNED" ||
      c.status === "CLIENT_SIGNED" ||
      c.status === "COMPANY_SIGNED" ||
      Boolean(c.signedPdfUrl);
    const exportedOrSent =
      hasDocumentArtifacts ||
      c.status === "SENT_FOR_SIGNATURE" ||
      signed;
    return [
      {
        id: "h1",
        label: "Реквізити та умови договору",
        done: draftReady,
      },
      {
        id: "h2",
        label: "Зафіксувати версію документа",
        done: c.version > 1,
      },
      {
        id: "h3",
        label: "Експорт PDF / відправка на підпис",
        done: exportedOrSent,
      },
      {
        id: "h4",
        label: "Підпис сторін",
        done: signed,
      },
      {
        id: "h5",
        label: "Підтвердження оплати (віха)",
        done: paymentStripContract.done > 0,
      },
    ];
  }, [data.contract, draftReady, hasDocumentArtifacts, paymentStripContract.done]);
  const nextBestAction = !data.contract
    ? {
        id: "create_draft" as const,
        title: "Створити чернетку договору",
        description: "Натисніть кнопку нижче — після цього з’являться реквізити та прев’ю.",
      }
    : missingRequired.length > 0
      ? {
          id: "fill_required" as const,
          title: "Заповнити обов'язкові поля",
          description: "Без них система блокує створення версії документа.",
        }
      : emptyTemplateKeys.length > 0
        ? {
            id: "fill_template" as const,
            title: "Заповнити змінні шаблону",
            description: `У HTML залишились порожні {{...}}: ${emptyTemplateKeys.slice(0, 6).join(", ")}${emptyTemplateKeys.length > 6 ? "…" : ""}.`,
          }
        : data.contract.status === "SENT_FOR_SIGNATURE"
          ? {
              id: "watch_signature",
              title: "Контроль підпису клієнта",
              description: "Перевірте події Дія.Підпис та оновіть статус задач.",
            }
          : data.contract.version <= 1
            ? {
                id: "create_version",
                title: "Зафіксувати версію документа",
                description: "Збережіть стан договору як офіційну ревізію.",
              }
            : {
                id: "export_and_sign",
                title: "Експорт і відправка на підпис",
                description: "Згенеруйте PDF/DOCX і запустіть процес підпису.",
              };
  const contractHealthLabel = !data.contract
    ? "Чернетка ще не створена"
    : missingRequired.length > 0
      ? "Потрібне заповнення (обов'язкові поля)"
      : emptyTemplateKeys.length > 0
        ? "Шаблон неповний (порожні змінні)"
        : data.contract.status === "SENT_FOR_SIGNATURE"
          ? "Очікує підпис"
          : data.contract.status === "FULLY_SIGNED"
            ? "Успішно завершено"
            : "Готово до наступного кроку";
  const contractHealthTone = !data.contract
    ? "border-slate-200 bg-slate-50 text-slate-700"
    : blockVersionActions
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : data.contract.status === "FULLY_SIGNED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-blue-200 bg-blue-50 text-blue-800";
  const requisitesFields = [
    ["contractNumber", "Номер договору", "Напр. 24/03-15"],
    ["contractDate", "Дата договору", "дд.мм.рррр"],
    ["customerFullName", "ПІБ/Назва замовника *", "Повна назва або ПІБ"],
    ["customerTaxId", "РНОКПП/ЄДРПОУ", "ІПН або ЄДРПОУ"],
    ["customerAddress", "Адреса замовника", "Адреса об'єкта/реєстрації"],
  ] as const;
  const termsFields = [
    ["contractSubject", "Предмет договору *", "Що саме виконуємо"],
    ["contractAmount", "Сума договору *", "Напр. 125000 UAH"],
    ["executionTerm", "Термін виконання", "Строк або графік"],
    ["paymentTerms", "Умови оплати *", "Передоплата/етапи/післяплата"],
  ] as const;
  const requisitesCompletion = requisitesFields.reduce(
    (acc, [key]) => acc + ((draft?.variables?.[key] ?? "").trim() ? 1 : 0),
    0,
  );
  const termsCompletion = termsFields.reduce(
    (acc, [key]) => acc + ((draft?.variables?.[key] ?? "").trim() ? 1 : 0),
    0,
  );
  const visibleRequisitesFields = requiredOnlyMode
    ? requisitesFields.filter(([key]) => requiredSet.has(key))
    : requisitesFields;
  const visibleTermsFields = requiredOnlyMode
    ? termsFields.filter(([key]) => requiredSet.has(key))
    : termsFields;
  const updateDraftVariable = (key: string, value: string, label: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            variables: {
              ...(prev.variables ?? {}),
              [key]: value,
            },
          }
        : prev,
    );
    setFieldActivity((prev) => [
      { key, label, at: new Date().toISOString() },
      ...prev.filter((x) => x.key !== key),
    ].slice(0, 8));
  };
  const scrollToContractSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);
  const dealValueFormatted =
    typeof data.deal.value === "number"
      ? new Intl.NumberFormat("uk-UA", {
          style: "currency",
          currency: (data.deal.currency ?? "UAH").trim() || "UAH",
          maximumFractionDigits: 0,
        }).format(data.deal.value)
      : null;
  useEffect(() => {
    if (!draft || !hasUnsavedChanges) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setAutoSaveBusy(true);
          await patchDealContractByDealId(data.deal.id, {
            action: "saveDraft",
            status: cStatus,
            ...draft,
          });
          setSavedSnapshot(JSON.stringify(draft));
          setLastSavedDraft(draft);
          setAutoSavedAt(new Date().toISOString());
        } finally {
          setAutoSaveBusy(false);
        }
      })();
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, hasUnsavedChanges, data.deal.id, cStatus]);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);
  const contractAgeHours = data.contract
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - +new Date(data.contract.updatedAt)) / (60 * 60 * 1000),
        ),
      )
    : 0;
  const staleSignature =
    data.contract?.status === "SENT_FOR_SIGNATURE" && contractAgeHours >= 48;
  const diiaEvents = (() => {
    const raw = draft?.contentJson?.diiaEvents;
    if (!Array.isArray(raw)) return [] as Array<{
      at: string;
      incomingEvent: string | null;
      incomingStatus: string | null;
      resolvedStatus: DealContractStatus;
      providerEventId: string | null;
    }>;
    return raw
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
      .map((x) => ({
        at: typeof x.at === "string" ? x.at : "",
        incomingEvent: typeof x.incomingEvent === "string" ? x.incomingEvent : null,
        incomingStatus: typeof x.incomingStatus === "string" ? x.incomingStatus : null,
        resolvedStatus:
          typeof x.resolvedStatus === "string" &&
          CONTRACT_STATUSES.includes(x.resolvedStatus as DealContractStatus)
            ? (x.resolvedStatus as DealContractStatus)
            : "SENT_FOR_SIGNATURE",
        providerEventId: typeof x.providerEventId === "string" ? x.providerEventId : null,
      }))
      .filter((x) => x.at)
      .sort((a, b) => +new Date(b.at) - +new Date(a.at));
  })();
  const contractDocs = useMemo(
    () =>
      data.attachments
        .filter((a) => a.category === "CONTRACT" || a.category === "SPEC")
        .slice(0, 12),
    [data.attachments],
  );

  useEffect(() => {
    previewPrefsReady.current = false;
  }, [data.deal.id]);

  useEffect(() => {
    const preferred = data.contract?.signedPdfUrl ?? null;
    const firstPdf =
      contractDocs.find((d) => d.fileName.toLowerCase().endsWith(".pdf"))?.fileUrl ?? null;
    setDocPreviewUrl(preferred ?? firstPdf);
    const hasPdf = Boolean(preferred || firstPdf);
    const stored = readDealContractPreviewPrefs(data.deal.id);
    let nextTab: "pdf" | "html";
    if (stored?.tab === "pdf" && hasPdf) nextTab = "pdf";
    else if (stored?.tab === "html") nextTab = "html";
    else nextTab = hasPdf ? "pdf" : "html";
    const nextZoom =
      stored?.zoom != null ? clampPdfZoom(stored.zoom) : 100;
    setDocPreviewTab(nextTab);
    setPdfZoom(nextZoom);
    skipNextPreviewPersist.current = true;
    writeDealContractPreviewPrefs(data.deal.id, {
      tab: nextTab,
      zoom: nextZoom,
    });
    previewPrefsReady.current = true;
  }, [data.deal.id, data.contract?.signedPdfUrl, contractDocs]);

  useEffect(() => {
    if (!previewPrefsReady.current) return;
    if (skipNextPreviewPersist.current) {
      skipNextPreviewPersist.current = false;
      lastPersistedPreviewTab.current = docPreviewTab;
      lastPersistedPreviewZoom.current = pdfZoom;
      return;
    }

    const tabChanged = lastPersistedPreviewTab.current !== docPreviewTab;
    lastPersistedPreviewTab.current = docPreviewTab;

    const persist = () => {
      lastPersistedPreviewZoom.current = pdfZoom;
      writeDealContractPreviewPrefs(data.deal.id, {
        tab: docPreviewTab,
        zoom: pdfZoom,
      });
    };

    if (tabChanged) {
      if (previewPersistZoomTimer.current) {
        clearTimeout(previewPersistZoomTimer.current);
        previewPersistZoomTimer.current = null;
      }
      persist();
      return;
    }

    if (lastPersistedPreviewZoom.current === pdfZoom) return;

    if (previewPersistZoomTimer.current) {
      clearTimeout(previewPersistZoomTimer.current);
    }
    previewPersistZoomTimer.current = setTimeout(() => {
      previewPersistZoomTimer.current = null;
      persist();
    }, 450);

    return () => {
      if (previewPersistZoomTimer.current) {
        clearTimeout(previewPersistZoomTimer.current);
        previewPersistZoomTimer.current = null;
      }
    };
  }, [data.deal.id, docPreviewTab, pdfZoom]);
  const reloadDiiaTasks = useCallback(async () => {
    if (!data.contract) {
      setDiiaTasks([]);
      setDiiaTasksErr(null);
      return;
    }
    setDiiaTasksLoading(true);
    setDiiaTasksErr(null);
    try {
      const q = new URLSearchParams({
        entityType: "DEAL",
        entityId: data.deal.id,
        titlePrefix: "[DIIA]",
      });
      const r = await fetch(`/api/tasks?${q.toString()}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        items?: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: string | null;
          updatedAt: string;
          resultComment?: string | null;
        }>;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити задачі Дія");
      setDiiaTasks(j.items ?? []);
    } catch (e) {
      setDiiaTasks([]);
      setDiiaTasksErr(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setDiiaTasksLoading(false);
    }
  }, [data.contract, data.deal.id]);

  const runDiiaTaskAction = useCallback(
    async (
      taskId: string,
      status: "IN_PROGRESS" | "DONE" | "CANCELLED",
      resultComment?: string,
    ) => {
      try {
        setDiiaTaskBusyId(taskId);
        await patchTaskById(taskId, {
          status,
          ...(resultComment ? { resultComment } : {}),
        });
        await reloadDiiaTasks();
        dispatchDealTasksUpdated({ dealId: data.deal.id });
      } catch (e) {
        setDiiaTasksErr(e instanceof Error ? e.message : "Помилка оновлення");
      } finally {
        setDiiaTaskBusyId(null);
      }
    },
    [data.deal.id, reloadDiiaTasks],
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await reloadDiiaTasks();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadDiiaTasks]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "s") return;
      e.preventDefault();
      if (!draft || busy) return;
      void run(async () => {
        await patchDealContractByDealId(data.deal.id, {
          action: "saveDraft",
          status: cStatus,
          ...draft,
        });
        setSavedSnapshot(JSON.stringify(draft));
        markStepDone(1, "Чернетку збережено (Ctrl+S)");
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, busy, cStatus, data.deal.id, run, markStepDone]);

  return (
    <div className="space-y-4">
      {err ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </p>
      ) : null}
      {estimateVersusDealHint ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 sm:flex-row sm:items-start sm:justify-between">
          <p className="min-w-0 flex-1 leading-relaxed">
            <span className="font-semibold">Смета та сума угоди: </span>
            {estimateVersusDealHint}
          </p>
          <SyncDealValueFromEstimateButton
            data={data}
            tone="amber"
            className="shrink-0 sm:max-w-[min(100%,280px)]"
          />
        </div>
      ) : null}
      {contractHappySteps ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/35 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
            Рекомендований порядок: від чернетки до оплати
          </p>
          <ol className="mt-2 grid list-none gap-1.5 p-0 text-xs text-indigo-950 sm:grid-cols-2 lg:grid-cols-3">
            {contractHappySteps.map((s, i) => (
              <li
                key={s.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-2 py-1.5",
                  s.done
                    ? "border-emerald-200 bg-emerald-50/90 text-emerald-900"
                    : "border-indigo-100/80 bg-white/90 text-indigo-900",
                )}
              >
                <span className="font-mono text-xs text-indigo-500">
                  {i + 1}.
                </span>
                <span>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : !data.contract ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
          <span className="font-medium text-slate-800">Типовий шлях: </span>
          чернетка → реквізити та змінні → версія документа → PDF / підпис → віхи
          оплати у вкладці «Оплата».
        </div>
      ) : null}
      <div className={wrap}>
        <h2 className="text-base font-semibold text-[var(--enver-text)]">Договір</h2>
        <p className="mt-1 text-sm text-slate-600">
          Заповніть реквізити, збережіть чернетку, потім створіть версію та експортуйте документ.
        </p>
        {!data.contract ? (
          <button
            type="button"
            disabled={busy}
            className={cn(btn, "mt-3")}
            onClick={() =>
              void run(async () => {
                await postJson(`/api/deals/${data.deal.id}/contract`, {});
              })
            }
          >
            {busy ? "Збереження…" : "Створити чернетку договору"}
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-slate-200/80 bg-[var(--enver-surface)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Контекст угоди
                  </p>
                  <p className="mt-0.5 truncate font-semibold text-[var(--enver-text)]" title={data.deal.title}>
                    {data.deal.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{data.client.name}</span>
                    {data.primaryContact?.phone ? (
                      <span className="text-slate-500">
                        {" · "}
                        {data.primaryContact.phone}
                      </span>
                    ) : null}
                    {data.primaryContact?.email ? (
                      <span className="text-slate-500">
                        {" · "}
                        {data.primaryContact.email}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Етап: {data.stage.name} · Воронка: {data.pipeline.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Бюджет угоди
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-[var(--enver-text)]">
                    {dealValueFormatted ?? "—"}
                  </p>
                </div>
              </div>
            </div>
            <ul className="space-y-1 text-xs">
              <li>
                <span className="text-slate-500">Поточний статус:</span>{" "}
                <span className="font-medium">
                  {statusUa(data.contract.status)}
                </span>
              </li>
              <li>
                <span className="text-slate-500">Оновлено:</span>{" "}
                {new Date(data.contract.updatedAt).toLocaleString("uk-UA")}
              </li>
              <li>
                <span className="text-slate-500">Версія:</span>{" "}
                {data.contract.version}
              </li>
            </ul>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Прогрес договору
              </p>
              <div className="mt-1 grid gap-1 text-xs text-slate-700 sm:grid-cols-3">
                <div
                  className={cn(
                    "rounded border px-2 py-1.5 transition",
                    step1Done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-[var(--enver-card)]",
                    highlightedStep === 1 ? "animate-pulse ring-2 ring-emerald-300" : "",
                  )}
                >
                  Крок 1: Заповнити реквізити
                </div>
                <div
                  className={cn(
                    "rounded border px-2 py-1.5 transition",
                    step2Done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-[var(--enver-card)]",
                    highlightedStep === 2 ? "animate-pulse ring-2 ring-emerald-300" : "",
                  )}
                >
                  Крок 2: Створити версію
                </div>
                <div
                  className={cn(
                    "rounded border px-2 py-1.5 transition",
                    step3Done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-[var(--enver-card)]",
                    highlightedStep === 3 ? "animate-pulse ring-2 ring-emerald-300" : "",
                  )}
                >
                  Крок 3: Експортувати файл
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-[var(--enver-surface)] p-2 text-xs">
              <span className="font-medium text-[var(--enver-text)]">Якість заповнення: {qualityScore}%</span>
              <span className="ml-2 text-[var(--enver-text-muted)]">Наступний крок: {nextActionLabel}</span>
            </div>
            <div className={cn("rounded-lg border p-2 text-xs", contractHealthTone)}>
              <span className="font-medium">Стан договору:</span> {contractHealthLabel}
              {missingRequired.length ? (
                <span className="ml-2">
                  · Не вистачає: {missingRequired.map((k) => requiredLabelByKey[k]).join(", ")}
                </span>
              ) : null}
            </div>
            <div className="rounded-lg border border-slate-200 bg-[var(--enver-surface)] p-3 text-xs">
              <p className="font-semibold text-[var(--enver-text)]">Найкраща наступна дія</p>
              <p className="mt-1 text-[var(--enver-text)]">{nextBestAction.title}</p>
              <p className="text-[var(--enver-text-muted)]">{nextBestAction.description}</p>
              <div className="mt-2">
                {nextBestAction.id === "fill_required" ? (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setRequiredOnlyMode(true)}
                  >
                    {"Показати лише обов'язкові поля"}
                  </button>
                ) : null}
                {nextBestAction.id === "fill_template" && draft ? (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() =>
                      setDraft((prev) =>
                        prev ? buildQuickFilledDraft(prev) : prev,
                      )
                    }
                  >
                    Автозаповнити змінні з угоди
                  </button>
                ) : null}
                {nextBestAction.id === "create_version" ? (
                  <button
                    type="button"
                    disabled={busy || blockVersionActions}
                    className={btnGhost}
                    onClick={() =>
                      void run(async () => {
                        if (!draft) return;
                        await patchDealContractByDealId(data.deal.id, {
                          action: "createVersion",
                          status: cStatus,
                          ...draft,
                        });
                        markStepDone(2, "Версію документа створено");
                      })
                    }
                  >
                    Створити версію зараз
                  </button>
                ) : null}
              </div>
            </div>
            {draft ? (
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-slate-500">Реквізити</p>
                  <p className="font-medium text-[var(--enver-text)]">
                    {requisitesCompletion}/{requisitesFields.length}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-slate-500">Умови</p>
                  <p className="font-medium text-[var(--enver-text)]">
                    {termsCompletion}/{termsFields.length}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-slate-500">Версії</p>
                  <p className="font-medium text-[var(--enver-text)]">{data.contract.version}</p>
                </div>
              </div>
            ) : null}
            {staleSignature ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Підпис очікується вже {contractAgeHours} год. Рекомендація: нагадати
                клієнту або перевірити diagnostics endpoint.
              </p>
            ) : null}
            {draft ? (
              <>
                <div
                  id="contract-section-setup"
                  className="scroll-mt-28 space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                >
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-slate-500">Тип документа</span>
                    <select
                      value={draft.documentType}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                documentType:
                                  e.target.value === "SPEC"
                                    ? "SPEC"
                                    : "CONTRACT",
                              }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="CONTRACT">Договір</option>
                      <option value="SPEC">Специфікація</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-500">Формат</span>
                    <select
                      value={draft.format}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                format: e.target.value === "DOCX" ? "DOCX" : "HTML",
                              }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="HTML">HTML</option>
                      <option value="DOCX">DOCX</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="text-slate-500">Шаблон</span>
                  <select
                    value={draft.templateKey}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, templateKey: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {availableTemplates.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className={btnGhost}
                  onClick={() =>
                    void run(async () => {
                      await patchDealContractByDealId(data.deal.id, {
                        action: "applyTemplate",
                        templateKey: draft.templateKey,
                        recipientType: draft.recipientType,
                        status: cStatus,
                      });
                    })
                  }
                >
                  {busy ? "..." : "Застосувати шаблон"}
                </button>
                <label className="block text-sm">
                  <span className="text-slate-500">На кого виписується договір</span>
                  <select
                    value={draft.recipientType}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              recipientType:
                                e.target.value === "CLIENT_COMPANY"
                                  ? "CLIENT_COMPANY"
                                  : "CLIENT_PERSON",
                            }
                          : prev,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="CLIENT_PERSON">Фізична особа</option>
                    <option value="CLIENT_COMPANY">Юридична особа</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className={btnGhost}
                  onClick={() =>
                    setDraft((prev) => {
                      if (!prev) return prev;
                      return buildQuickFilledDraft(prev);
                    })
                  }
                >
                  Заповнити всі поля з даних угоди
                </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-sm">
                  <span className="text-slate-500">Режим заповнення:</span>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2.5 py-1.5",
                      !requiredOnlyMode
                        ? "bg-slate-900 text-white"
                        : "bg-[var(--enver-card)] text-slate-700",
                    )}
                    onClick={() => setRequiredOnlyMode(false)}
                  >
                    Усі поля
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2.5 py-1.5",
                      requiredOnlyMode
                        ? "bg-slate-900 text-white"
                        : "bg-[var(--enver-card)] text-slate-700",
                    )}
                    onClick={() => setRequiredOnlyMode(true)}
                  >
                    {"Лише обов'язкові"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Порада: спочатку натисніть автозаповнення, перевірте{" "}
                  {"обов'язкові"} поля, потім
                  створюйте версію та експортуйте файл.{" "}
                  <span className="text-slate-400">
                    Ctrl+S / ⌘S — зберегти чернетку.
                  </span>
                </p>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-3">
                <details
                  id="contract-section-requisites"
                  className="scroll-mt-28 rounded-lg border border-slate-100 bg-[var(--enver-card)] p-2"
                  open
                >
                  <summary className="cursor-pointer text-xs font-medium text-slate-700">
                    Реквізити
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {visibleRequisitesFields.map(([key, label, placeholder]) => (
                      <label key={key} className="block text-sm">
                        <span className="text-slate-500">{label}</span>
                        <input
                          value={draft.variables?.[key] ?? ""}
                          onChange={(e) => updateDraftVariable(key, e.target.value, label)}
                          placeholder={placeholder}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </details>
                <details
                  id="contract-section-terms"
                  className="scroll-mt-28 rounded-lg border border-slate-100 bg-[var(--enver-card)] p-2"
                  open
                >
                  <summary className="cursor-pointer text-xs font-medium text-slate-700">
                    Умови договору
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[
                      "50% передоплата, 50% після монтажу.",
                      "30% аванс, 70% після підписання акту.",
                      "Оплата згідно погодженого графіка.",
                    ].map((snippet) => (
                      <button
                        key={snippet}
                        type="button"
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                        onClick={() =>
                          updateDraftVariable(
                            "paymentTerms",
                            snippet,
                            "Умови оплати *",
                          )
                        }
                      >
                        {snippet}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {visibleTermsFields.map(([key, label, placeholder]) => (
                      <label key={key} className="block text-sm">
                        <span className="text-slate-500">{label}</span>
                        {key === "paymentTerms" ? (
                          <textarea
                            value={draft.variables?.[key] ?? ""}
                            onChange={(e) => updateDraftVariable(key, e.target.value, label)}
                            rows={2}
                            placeholder={placeholder}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        ) : (
                          <input
                            value={draft.variables?.[key] ?? ""}
                            onChange={(e) => updateDraftVariable(key, e.target.value, label)}
                            placeholder={placeholder}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </details>
                {hasUnsavedChanges ? (
                  <p className="text-xs text-amber-700">
                    Чернетка має незбережені зміни.
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700">Чернетка збережена.</p>
                )}
                <p className="text-xs text-slate-500">
                  {autoSaveBusy
                    ? "Автозбереження..."
                    : autoSavedAt
                      ? `Автозбережено: ${new Date(autoSavedAt).toLocaleTimeString("uk-UA")}`
                      : "Автозбереження: увімкнено (0.8с)"}
                </p>
                {missingRequired.length ? (
                  <p className="text-xs text-rose-700">
                    Заповніть обовʼязкові поля:{" "}
                    {missingRequired.map((k) => requiredLabelByKey[k]).join(", ")}.
                  </p>
                ) : null}
                <label id="contract-section-body" className="block scroll-mt-28 text-sm">
                  <span className="text-slate-500">Вміст документа (HTML/текст)</span>
                  <textarea
                    value={draft.contentHtml}
                    onChange={(e) => {
                      setDraft((prev) =>
                        prev ? { ...prev, contentHtml: e.target.value } : prev,
                      );
                      setFieldActivity((prev) => [
                        {
                          key: "contentHtml",
                          label: "Вміст документа",
                          at: new Date().toISOString(),
                        },
                        ...prev.filter((x) => x.key !== "contentHtml"),
                      ].slice(0, 8));
                    }}
                    rows={8}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
                  />
                </label>
                <div
                  id="contract-section-preview"
                  className="scroll-mt-28 rounded-lg border border-slate-200 bg-slate-50 p-2 lg:sticky lg:top-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-700">
                      Попередній перегляд з підстановкою полів
                    </p>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        const html = renderTemplatePreview(
                          draft.contentHtml,
                          draft.variables,
                        );
                        const blob = new Blob([html], {
                          type: "text/html;charset=utf-8",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `contract-preview-${data.deal.id}.html`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Вивантажити HTML
                    </button>
                  </div>
                  <div
                    className="max-h-56 overflow-auto rounded border border-slate-200 bg-[var(--enver-card)] p-2 text-xs text-slate-700"
                    dangerouslySetInnerHTML={{
                      __html: sanitizePreviewHtml(
                        renderTemplatePreview(draft.contentHtml, draft.variables),
                      ),
                    }}
                  />
                </div>
                </div>
                </div>
                {fieldActivity.length ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[11px] font-medium text-slate-700">
                      Останні зміни полів (поточна сесія)
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-600">
                      {fieldActivity.map((item) => (
                        <li key={item.key}>
                          {item.label} · {new Date(item.at).toLocaleTimeString("uk-UA")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="sticky top-2 z-10 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-[var(--enver-card)]/95 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[var(--enver-card)]/80">
                  <div className="w-full text-xs font-medium text-slate-500">
                    Швидкий сценарій: автозаповнення → версія → PDF/DOCX → підпис
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className={btn}
                    onClick={() =>
                      void run(async () => {
                        if (!draft) return;
                        const prepared = buildQuickFilledDraft(draft);
                        await patchDealContractByDealId(data.deal.id, {
                          action: "saveDraft",
                          status: cStatus,
                          ...prepared,
                        });
                        await patchDealContractByDealId(data.deal.id, {
                          action: "createVersion",
                          status: cStatus,
                          ...prepared,
                        });
                        setDraft(prepared);
                        setSavedSnapshot(JSON.stringify(prepared));
                        setLastSavedDraft(prepared);
                        markStepDone(2, "Чернетку збережено та версію створено");
                      })
                    }
                  >
                    {busy ? "..." : "Підготувати все (1 клік)"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || autoSaveBusy || !hasUnsavedChanges}
                    className={btnGhost}
                    onClick={() => {
                      setDraft(lastSavedDraft);
                      setSavedSnapshot(JSON.stringify(lastSavedDraft ?? null));
                    }}
                  >
                    Скасувати зміни
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={btnGhost}
                    onClick={() =>
                      void run(async () => {
                        if (!draft) return;
                        await patchDealContractByDealId(data.deal.id, {
                          action: "saveDraft",
                          status: cStatus,
                          ...draft,
                        });
                        setSavedSnapshot(JSON.stringify(draft));
                        markStepDone(1, "Чернетку збережено");
                      })
                    }
                  >
                    {busy ? "Збереження…" : "Зберегти чернетку"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || blockVersionActions}
                    className={btn}
                    onClick={() =>
                      void run(async () => {
                        if (!draft) return;
                        await patchDealContractByDealId(data.deal.id, {
                          action: "createVersion",
                          status: cStatus,
                          ...draft,
                        });
                        markStepDone(2, "Версію документа створено");
                      })
                    }
                  >
                    {busy ? "..." : "Створити версію документа"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={btnGhost}
                    onClick={() =>
                      void run(async () => {
                        if (!draft) return;
                        await patchDealContractByDealId(data.deal.id, {
                          action: "generatePdf",
                          ...draft,
                        });
                        markStepDone(3, "PDF згенеровано");
                      })
                    }
                  >
                    {busy ? "..." : "Згенерувати PDF"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={btnGhost}
                    onClick={() =>
                      void run(async () => {
                        if (!draft) return;
                        await patchDealContractByDealId(data.deal.id, {
                          action: "generateDocx",
                          ...draft,
                        });
                        markStepDone(3, "DOCX згенеровано");
                      })
                    }
                  >
                    {busy ? "..." : "Згенерувати DOCX"}
                  </button>
                </div>
                <details className="rounded-lg border border-slate-100 bg-[var(--enver-card)] p-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-700">
                    Додаткові дії (підпис / відправка)
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || missingRequired.length > 0}
                      className={btn}
                      onClick={() =>
                        void run(async () => {
                          if (!draft) return;
                          await patchDealContractByDealId(data.deal.id, {
                            action: "startDiiaSign",
                            ...draft,
                          });
                        })
                      }
                    >
                      {busy ? "..." : "Підпис через Дія.Підпис"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className={btnGhost}
                      onClick={() =>
                        void run(async () => {
                          await patchDealContractByDealId(data.deal.id, {
                            action: "sendClientPreview",
                          });
                        })
                      }
                    >
                      {busy ? "..." : "Надіслати клієнту на перегляд"}
                    </button>
                  </div>
                </details>
                {data.contract.signedPdfUrl ? (
                  <p className="text-xs text-slate-600">
                    PDF договору:{" "}
                    <a
                      href={data.contract.signedPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 underline"
                    >
                      відкрити
                    </a>
                  </p>
                ) : null}
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <p className="text-xs font-medium text-slate-700">
                    Передперегляд документів
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        btnGhost,
                        docPreviewTab === "pdf" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "",
                      )}
                      onClick={() => setDocPreviewTab("pdf")}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      className={cn(
                        btnGhost,
                        docPreviewTab === "html" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "",
                      )}
                      onClick={() => setDocPreviewTab("html")}
                    >
                      HTML
                    </button>
                    {docPreviewTab === "pdf" ? (
                      <div className="ml-auto flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          className={btnGhost}
                          aria-label="Зменшити масштаб PDF"
                          onClick={() => setPdfZoom((z) => Math.max(50, z - 10))}
                        >
                          -
                        </button>
                        <span className="w-10 text-center text-slate-600" aria-live="polite">
                          {pdfZoom}%
                        </span>
                        <button
                          type="button"
                          className={btnGhost}
                          aria-label="Збільшити масштаб PDF"
                          onClick={() => setPdfZoom((z) => Math.min(200, z + 10))}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className={btnGhost}
                          aria-label="Масштаб PDF 100 відсотків"
                          onClick={() => setPdfZoom(100)}
                        >
                          100%
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {contractDocs.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Документів договору поки немає. Згенеруйте PDF або DOCX.
                    </p>
                  ) : (
                    <>
                      <ul className="mt-1 space-y-1 text-xs text-slate-700">
                        {contractDocs.map((d) => {
                          const isPdf = d.fileName.toLowerCase().endsWith(".pdf");
                          const selected = docPreviewUrl === d.fileUrl;
                          return (
                            <li
                              key={d.id}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded border px-2 py-1.5",
                                selected
                                  ? "border-indigo-200 bg-indigo-50"
                                  : "border-slate-200 bg-[var(--enver-card)]",
                              )}
                            >
                              <span className="truncate">{d.fileName}</span>
                              <div className="flex items-center gap-1">
                                {isPdf ? (
                                  <button
                                    type="button"
                                    className={btnGhost}
                                    onClick={() => setDocPreviewUrl(d.fileUrl)}
                                  >
                                    Перегляд
                                  </button>
                                ) : null}
                                <a
                                  href={d.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn(btnGhost, "no-underline")}
                                >
                                  Відкрити
                                </a>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {docPreviewTab === "pdf" && docPreviewUrl ? (
                        <div className="mt-2 overflow-hidden rounded border border-slate-200 bg-[var(--enver-card)]">
                          <div className="h-64 w-full overflow-auto bg-slate-50/80">
                            <div
                              style={{
                                transform: `scale(${pdfZoom / 100})`,
                                transformOrigin: "top left",
                                width: `${10000 / pdfZoom}%`,
                              }}
                            >
                              <iframe
                                title="Передперегляд PDF договору"
                                src={docPreviewUrl}
                                className="block h-[min(32rem,85vh)] w-full border-0"
                              />
                            </div>
                          </div>
                        </div>
                      ) : docPreviewTab === "html" ? (
                        <div className="mt-2 max-h-64 overflow-auto rounded border border-slate-200 bg-[var(--enver-card)] p-2 text-xs text-slate-700">
                          <div
                            dangerouslySetInnerHTML={{
                              __html: sanitizePreviewHtml(
                                renderTemplatePreview(
                                  draft?.contentHtml ?? "",
                                  draft?.variables,
                                ),
                              ),
                            }}
                          />
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">
                          Для DOCX доступне відкриття в новій вкладці.
                        </p>
                      )}
                    </>
                  )}
                </div>
                {data.contract.diiaSessionId ? (
                  <p className="text-xs text-emerald-700">
                    Активна сесія Дія.Підпис: {data.contract.diiaSessionId}
                  </p>
                ) : null}
                {diiaEvents.length ? (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2">
                    <p className="text-xs font-medium text-emerald-800">
                      Історія подій Дія.Підпис
                    </p>
                    <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-emerald-900">
                      {diiaEvents.map((ev, idx) => (
                        <li
                          key={`${ev.at}-${idx}`}
                          className="rounded border border-emerald-100 bg-[var(--enver-card)] px-2 py-1"
                        >
                          <div>
                            {new Date(ev.at).toLocaleString("uk-UA")} ·{" "}
                            {ev.incomingEvent ?? ev.incomingStatus ?? "unknown_event"}
                          </div>
                          <div className="text-emerald-700">
                            Статус: {statusUa(ev.resolvedStatus)}
                            {ev.providerEventId ? ` · eventId: ${ev.providerEventId}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <p className="text-xs font-medium text-slate-700">
                    Задачі по підпису (DIIA)
                  </p>
                  {diiaTasksLoading ? (
                    <p className="mt-1 text-xs text-slate-500">Завантаження...</p>
                  ) : diiaTasksErr ? (
                    <p className="mt-1 text-xs text-rose-700">{diiaTasksErr}</p>
                  ) : diiaTasks.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">Немає задач по підпису.</p>
                  ) : (
                    <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto text-xs text-slate-700">
                      {diiaTasks.map((t) => (
                        <li key={t.id} className="rounded border border-slate-200 bg-[var(--enver-card)] px-2 py-1">
                          <div className="font-medium text-slate-800">
                            {t.status} · {t.title}
                          </div>
                          <div className="text-slate-500">
                            Оновлено: {new Date(t.updatedAt).toLocaleString("uk-UA")}
                            {t.dueAt
                              ? ` · дедлайн: ${new Date(t.dueAt).toLocaleString("uk-UA")}`
                              : ""}
                          </div>
                          {t.resultComment ? (
                            <div className="text-slate-500">Результат: {t.resultComment}</div>
                          ) : null}
                          {t.status !== "DONE" && t.status !== "CANCELLED" ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              <button
                                type="button"
                                className={btnGhost}
                                disabled={diiaTaskBusyId === t.id || t.status === "IN_PROGRESS"}
                                onClick={() =>
                                  void runDiiaTaskAction(t.id, "IN_PROGRESS")
                                }
                              >
                                {diiaTaskBusyId === t.id ? "..." : "Взяти в роботу"}
                              </button>
                              <button
                                type="button"
                                className={btnGhost}
                                disabled={diiaTaskBusyId === t.id}
                                onClick={() =>
                                  void runDiiaTaskAction(
                                    t.id,
                                    "DONE",
                                    "Закрито з вкладки договору",
                                  )
                                }
                              >
                                {diiaTaskBusyId === t.id ? "..." : "Закрити як виконано"}
                              </button>
                              <button
                                type="button"
                                className={btnGhost}
                                disabled={diiaTaskBusyId === t.id}
                                onClick={() => {
                                  const ok = window.confirm(
                                    "Скасувати задачу по підпису? Дію можна змінити пізніше вручну.",
                                  );
                                  if (!ok) return;
                                  void runDiiaTaskAction(
                                    t.id,
                                    "CANCELLED",
                                    "Скасовано з вкладки договору",
                                  );
                                }}
                              >
                                {diiaTaskBusyId === t.id ? "..." : "Скасувати"}
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {data.contract.versions.length ? (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <p className="text-[11px] font-medium text-slate-700">Останні версії</p>
                    <ul className="mt-1 space-y-1 text-[11px] text-slate-600">
                      {data.contract.versions.map((v) => (
                        <li key={v.id}>
                          r{v.revision} · {v.documentType} · {v.format} ·{" "}
                          {new Date(v.createdAt).toLocaleString("uk-UA")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
            <label className="block text-[11px]">
              <span className="text-slate-500">Новий статус</span>
              <select
                value={cStatus}
                onChange={(e) =>
                  setCStatus(e.target.value as DealContractStatus)
                }
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusUa(s)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || cStatus === data.contract.status}
              className={btn}
              onClick={() =>
                void run(async () => {
                  await patchDealContractByDealId(data.deal.id, { status: cStatus });
                })
              }
            >
              {busy ? "Збереження…" : "Зберегти статус"}
            </button>
          </div>
        )}
      </div>
      <StageAiAssistantCard stage="contract" data={data} />
      <StageFormTemplateCard stage="contract" roleView={roleView} />
    </div>
  );
}

type MilestoneRow = {
  id: string;
  label: string;
  amount: number | null;
  done: boolean;
};

function PaymentTab({
  data,
  roleView,
}: {
  data: DealWorkspacePayload;
  roleView: "director" | "head" | "sales";
}) {
  const rows = useMemo<MilestoneRow[]>(
    () =>
      (data.meta.payment?.milestones ?? []).map((m) => ({
        id: m.id,
        label: m.label,
        amount: m.amount ?? null,
        done: m.done,
      })),
    [data.meta.payment?.milestones],
  );

  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  return (
    <div className={wrap}>
      <h2 className="text-base font-semibold text-[var(--enver-text)]">Оплата</h2>
      <p className="mt-1 text-xs text-slate-600">
        Підтвердження оплат виконує бухгалтер у модулі фінансів. В угоді доступне
        лише відображення статусу підтвердження.
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-800">{row.label}</p>
              <p className="text-[11px] text-slate-600">
                {row.amount != null ? `${row.amount.toLocaleString("uk-UA")}` : "Сума не вказана"}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                row.done
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-amber-100 text-amber-900",
              )}
            >
              {row.done ? "Підтверджено бухгалтерією" : "Очікує підтвердження"}
            </span>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">Віхи оплати ще не заповнені у фінансовому модулі.</p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/finance/projects" className={btnGhost}>
          Відкрити фінанси
        </Link>
      </div>
      <StageAiAssistantCard stage="payment" data={data} />
      <StageFormTemplateCard stage="payment" roleView={roleView} />
    </div>
  );
}

function HandoffTab({
  data,
  roleView,
  onTab,
}: {
  data: DealWorkspacePayload;
  roleView: "director" | "head" | "sales";
  onTab: (id: DealWorkspaceTabId) => void;
}) {
  const { err, busy, run } = useWorkspaceRun(data.deal.id);
  const [notesDraft, setNotesDraft] = useState(data.handoff.notes ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>(() =>
    initialHandoffSelectedAttachmentIds(data.attachments, data.handoff.manifest),
  );
  const [fileSearch, setFileSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AttachmentCategory>("all");
  const [constructorTab, setConstructorTab] = useState<
    "technical" | "files" | "comments" | "versions"
  >("technical");
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync handoff draft when payload changes */
    setNotesDraft(data.handoff.notes ?? "");
    setSelectedAttachmentIds(
      initialHandoffSelectedAttachmentIds(data.attachments, data.handoff.manifest),
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    data.handoff.notes,
    data.handoff.manifest,
    data.handoff.manifest.selectedAttachmentIds,
    data.handoff.manifest.selectedFileAssetIds,
    data.attachments,
  ]);
  const filteredAttachments = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    return data.attachments.filter((a) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        a.fileName.toLowerCase().includes(q) ||
        attachmentCategoryLabel(a.category).toLowerCase().includes(q)
      );
    });
  }, [data.attachments, categoryFilter, fileSearch]);
  const { showToast } = useDealWorkspaceToast();
  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";
  const h = data.handoff;
  const readiness = getProductionReadiness(data);
  const packageStatus = getProductionPackageStatus(data);
  const constructorState = getConstructorWorkspaceState(data);
  const role: DealViewRole = getDealViewRole(
    {
      effectiveRole: roleView === "director" ? "DIRECTOR" : roleView === "head" ? "HEAD_MANAGER" : "MANAGER",
    },
    data,
  );
  const productionBlockers = [
    ...readiness.missingItems.map((title) => ({ id: `readiness-${title}`, title })),
    ...getCriticalBlockers(data, role)
      .slice(0, 2)
      .map((item) => ({ id: item.id, title: item.title })),
  ];
  const canSubmitToProduction =
    readiness.isReady && data.productionLaunch.status !== "LAUNCHED";
  const finalRoleActionLabel =
    role === "manager"
      ? "Передати конструктору"
      : role === "constructor"
        ? "Завершити ТЗ"
        : role === "production"
          ? "Підтвердити запуск"
          : "Керувати передачею";
  const checklistItems = [
    ...data.readiness.map((item) => ({
      id: item.id,
      label: item.label,
      done: item.done,
      ownerRole:
        item.source.includes("contract")
          ? ("manager" as const)
          : item.source.includes("production")
            ? ("production" as const)
            : ("constructor" as const),
      ctaLabel: item.done ? "Перевірити" : "Відкрити",
      onCta: () => {
        const label = item.label.toLowerCase();
        if (label.includes("догов")) onTab("contract");
        else if (label.includes("оплат") || label.includes("аванс")) onTab("payment");
        else if (label.includes("замір")) onTab("measurement");
        else if (label.includes("кп")) onTab("proposal");
        else if (label.includes("файл") || label.includes("кресл")) onTab("files");
        else if (label.includes("тз") || label.includes("пакет")) onTab("handoff");
        else onTab("overview");
      },
    })),
  ];

  return (
    <div className={wrap}>
      <h2 className="text-base font-semibold text-[var(--enver-text)]">
        Передача у виробництво
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Статус пакета в БД, вибір файлів і готовність до передачі у виробництво.
      </p>
      <p className="mt-2 text-xs font-medium text-slate-800">
        Статус: {handoffStatusUa(h.status)}
      </p>
      {h.rejectionReason ? (
        <p className="mt-1 text-xs text-rose-800">
          Причина відхилення: {h.rejectionReason}
        </p>
      ) : null}
      <DealTransferHub>
        <ProductionReadiness
          readiness={readiness}
          submitDisabled={busy || !canSubmitToProduction}
          submitLabel={busy ? "Передача..." : "Передати у виробництво"}
          onSubmit={() =>
            void run(async () => {
              const j = (await postJson(
                `/api/deals/${data.deal.id}/production-launch`,
                {},
              )) as ProductionLaunchResponse;
              const n = j.handoffImportedFileCount;
              showToast(
                typeof n === "number" && n > 0
                  ? `Виробниче замовлення створено. Перенесено файлів: ${n}.`
                  : "Виробниче замовлення створено",
                { tone: "success" },
              );
              try {
                const roomResp = await postJson<{ room?: { publicToken: string } }>(
                  `/api/deals/${data.deal.id}/constructor-room`,
                  { action: "ensure" },
                );
                if (roomResp.room?.publicToken && typeof window !== "undefined") {
                  window.open(`/c/${roomResp.room.publicToken}`, "_blank", "noopener,noreferrer");
                }
              } catch {
                showToast("Передачу виконано. Кімната конструктора буде доступна після синхронізації.", {
                  tone: "warning",
                });
              }
            })
          }
        />
        <HandoffChecklist items={checklistItems} />
      </DealTransferHub>
      <ProductionOrchestrationHandoffPanel
        dealId={data.deal.id}
        activeEstimateId={data.operationalStats.latestEstimate?.id ?? null}
      />
      {err ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}
      <label className="mt-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={Boolean(data.meta.handoffPackageReady)}
          disabled={busy}
          onChange={(e) =>
            void run(async () => {
              await patchMeta(data.deal.id, {
                handoffPackageReady: e.target.checked,
              });
              showToast(
                e.target.checked
                  ? "Пакет позначено як зібраний"
                  : "Позначку зібраного пакета знято",
                { tone: "info" },
              );
            })
          }
        />
        Пакет передачі зібрано (метадані)
      </label>
      <ConstructorWorkspace state={constructorState}>
        <ConstructorWorkspaceTabs
          value={constructorTab}
          onChange={setConstructorTab}
        />
        {constructorTab === "technical" ? (
          <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="font-medium">Замір</p>
              <p className="mt-1 text-[11px] text-slate-600">
                {data.controlMeasurement
                  ? "Замір заповнений, дані доступні."
                  : "Замір ще не заповнений."}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="font-medium">Комерційна частина</p>
              <p className="mt-1 text-[11px] text-slate-600">
                {data.commercialSnapshot
                  ? "Комерційний пакет сформовано й зафіксовано."
                  : "Специфікація ще не сформована."}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:col-span-2">
              <p className="font-medium">Швидкі переходи</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Link href={`/deals/${data.deal.id}/workspace?tab=measurement`} className={btnGhost}>
                  Відкрити замір
                </Link>
                <Link href={`/deals/${data.deal.id}/workspace?tab=proposal`} className={btnGhost}>
                  Відкрити КП
                </Link>
              </div>
            </div>
          </div>
        ) : null}
        {constructorTab === "files" ? (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-700">
                Файли для передачі: {selectedAttachmentIds.length}/{data.attachments.length}
              </p>
            </div>
            {data.attachments.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="block min-w-0 flex-1 text-[11px]">
                  <span className="text-slate-500">Пошук за назвою або типом</span>
                  <input
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    placeholder="Наприклад: договір, креслення…"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="block text-[11px] sm:w-44">
                  <span className="text-slate-500">Категорія</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(e.target.value as "all" | AttachmentCategory)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="all">Усі категорії</option>
                    {ATTACH_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-xs">
              {filteredAttachments.map((a) => {
                const checked = selectedAttachmentIds.includes(a.id);
                return (
                  <li
                    key={a.id}
                    className="flex items-start gap-2 rounded-md border border-transparent bg-white/60 px-1.5 py-1 hover:border-slate-200"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedAttachmentIds((prev) =>
                          e.target.checked
                            ? [...new Set([...prev, a.id])]
                            : prev.filter((id) => id !== a.id),
                        );
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-800">{a.fileName}</div>
                      <div className="text-[11px] text-slate-500">
                        {attachmentCategoryLabel(a.category)}
                        {a.isCurrentVersion ? "" : " · неактуальна версія"} · v{a.version}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              disabled={busy}
              className={cn(btnGhost, "mt-2")}
              onClick={() =>
                void run(async () => {
                  const files = deriveHandoffManifestFiles(data.attachments, selectedAttachmentIds);
                  await patchHandoff(data.deal.id, {
                    manifestJson: {
                      ...files,
                      generatedDocumentIds: data.handoff.manifest.generatedDocumentIds,
                      notes: notesDraft.trim() || undefined,
                    },
                  });
                  showToast("Склад пакета передачі збережено", { tone: "info" });
                })
              }
            >
              {busy ? "Збереження…" : "Зберегти склад пакета"}
            </button>
          </div>
        ) : null}
        {constructorTab === "comments" ? (
          <div className="mt-3">
            <label className="block text-xs">
              <span className="text-slate-500">Коментар конструктора / менеджера</span>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              className={cn(btnGhost, "mt-2")}
              onClick={() =>
                void run(async () => {
                  await patchHandoff(data.deal.id, { notes: notesDraft });
                  showToast("Нотатки передачі збережено");
                })
              }
            >
              {busy ? "Збереження…" : "Зберегти коментар"}
            </button>
            <ConstructorRoomPanel
              dealId={data.deal.id}
              canUse={true}
              initialRoom={data.constructorRoom}
            />
          </div>
        ) : null}
        {constructorTab === "versions" ? (
          <div className="mt-3 space-y-1.5 text-xs text-slate-700">
            <p>Договір: {data.contract?.status ?? "не створено"}</p>
            <p>Вкладення: {data.attachments.length} файлів</p>
            <ul className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px]">
              {data.attachments.slice(0, 6).map((item) => (
                <li key={item.id}>
                  {item.fileName} · v{item.version} · {item.isCurrentVersion ? "актуальна" : "архів"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ConstructorWorkspace>
      <section className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
          Production blockers
        </p>
        <ul className="mt-2 space-y-1 text-xs text-rose-900">
          {productionBlockers.map((item) => (
            <li key={item.id}>- {item.title}</li>
          ))}
          {productionBlockers.length === 0 ? <li>- Критичних блокерів не виявлено</li> : null}
        </ul>
      </section>
      <ProductionPackage status={packageStatus} />
      <HandoffHistory
        notes={notesDraft}
        historyLabel={`Статус пакета: ${handoffStatusUa(h.status)}`}
      />
      <FinalActionArea
        role={role}
        actionLabel={finalRoleActionLabel}
        disabled={busy}
        onAction={() => {
          if (role === "manager") onTab("handoff");
          if (role === "constructor") onTab("production");
          if (role === "production") onTab("production");
        }}
      />
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {(h.status === "DRAFT" || h.status === "REJECTED") && (
          <button
            type="button"
            disabled={busy}
            className={btn}
            onClick={() =>
              void run(async () => {
                await patchHandoff(data.deal.id, { status: "SUBMITTED" });
                showToast("Відправлено на прийняття");
              })
            }
          >
            Відправити на прийняття
          </button>
        )}
        {h.status === "SUBMITTED" && (
          <>
            <button
              type="button"
              disabled={busy}
              className={btn}
                onClick={() =>
                  void run(async () => {
                    await patchHandoff(data.deal.id, { status: "ACCEPTED" });
                    showToast("Передачу прийнято");
                  })
                }
            >
              Прийняти
            </button>
            <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-[200px]">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Причина відхилення"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={busy || !rejectReason.trim()}
                className={btnGhost}
                onClick={() =>
                  void run(async () => {
                    await patchHandoff(data.deal.id, {
                      status: "REJECTED",
                      rejectionReason: rejectReason.trim(),
                    });
                    setRejectReason("");
                    showToast("Передачу відхилено", { tone: "warning" });
                  })
                }
              >
                Відхилити
              </button>
            </div>
          </>
        )}
        {h.status === "REJECTED" && (
          <button
            type="button"
            disabled={busy}
            className={btnGhost}
            onClick={() =>
              void run(async () => {
                await patchHandoff(data.deal.id, { status: "DRAFT" });
                showToast("Повернуто в чернетку", { tone: "info" });
              })
            }
          >
            Повернути в чернетку
          </button>
        )}
      </div>
      <StageAiAssistantCard stage="handoff" data={data} />
      <StageFormTemplateCard stage="handoff" roleView={roleView} />
    </div>
  );
}

function ProductionTab({
  data,
  roleView,
}: {
  data: DealWorkspacePayload;
  roleView: "director" | "head" | "sales";
}) {
  const { err, busy, run } = useWorkspaceRun(data.deal.id);
  const { showToast } = useDealWorkspaceToast();
  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";
  const launchBlocked = !data.readinessAllMet;
  const queueState = (data.productionLaunch.status ?? "NOT_READY").toLowerCase();
  const queueStateUa: Record<string, string> = {
    not_ready: "Не готово",
    queued: "У черзі",
    launching: "Запуск",
    launched: "Модуль виробництва",
    failed: "Помилка",
  };
  return (
    <div className={wrap}>
      <h2 className="text-base font-semibold text-[var(--enver-text)]">Виробництво</h2>
      <p className="mt-1 text-xs text-slate-600">
        Передача в цех після чеклисту: договір, ≈70% оплати, контрольний замір, файли з вкладки
        «Передача». При запуску обрані там файли копіюються у виробничий потік (пакет «Передача з
        угоди»). Деталі — у готовності нижче.
      </p>
      {err ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}
      <div className="mt-3 space-y-2 text-xs">
        <p className="text-slate-700">
          Стан запуску:{" "}
          <span className="font-medium">
            {queueStateUa[queueState] ?? queueState}
          </span>
        </p>
        {data.productionLaunch.queuedAt ? (
          <p className="text-slate-500">
            В черзі з:{" "}
            {new Date(data.productionLaunch.queuedAt).toLocaleString("uk-UA")}
          </p>
        ) : null}
        {data.productionLaunch.launchedAt ? (
          <p className="text-slate-500">
            Запущено о:{" "}
            {new Date(data.productionLaunch.launchedAt).toLocaleString("uk-UA")}
          </p>
        ) : null}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(data.meta.productionOrderCreated)}
            disabled={busy}
            onChange={(e) =>
              void run(async () => {
                await patchMeta(data.deal.id, {
                  productionOrderCreated: e.target.checked,
                });
                showToast(
                  e.target.checked
                    ? "Позначено: виробниче замовлення створено"
                    : "Позначку створення замовлення знято",
                  { tone: "info" },
                );
              })
            }
          />
          Виробниче замовлення створено
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={data.productionLaunch.status === "LAUNCHED"}
            disabled
          />
          Запуск виробництва виконано
        </label>
        {data.productionLaunch.error ? (
          <p className="text-rose-700">Помилка запуску: {data.productionLaunch.error}</p>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-amber-800">
        {!data.readinessAllMet
          ? "Передача заблокована: не всі умови готовності виконані."
          : data.handoff.status !== "ACCEPTED"
            ? "Передача в цех можлива за готовності; пакет передачі ще не прийнято (ACCEPTED) — це не блокує створення замовлення за правилами модуля."
            : "Умови готовності виконані."}
      </p>
      {data.productionLaunch.productionOrderId ? (
        <Link
          href={`/crm/production/${data.productionLaunch.productionOrderId}`}
          className={cn(
            btn,
            "mt-3 inline-flex items-center justify-center no-underline",
          )}
        >
          Відкрити виробниче замовлення
        </Link>
      ) : null}
      <button
        type="button"
        disabled={busy || launchBlocked || data.productionLaunch.status === "LAUNCHED"}
        className={cn(btn, "mt-3 block")}
        onClick={() =>
          void run(async () => {
            const j = (await postJson(
              `/api/deals/${data.deal.id}/production-launch`,
              {},
            )) as ProductionLaunchResponse;
            const n = j.handoffImportedFileCount;
            showToast(
              typeof n === "number" && n > 0
                ? `Виробниче замовлення створено. Перенесено з передачі файлів: ${n}.`
                : "Виробниче замовлення створено",
              { tone: "info" },
            );
            try {
              const roomResp = await postJson<{
                room?: { publicToken: string };
              }>(`/api/deals/${data.deal.id}/constructor-room`, {
                action: "ensure",
              });
              if (roomResp.room?.publicToken && typeof window !== "undefined") {
                window.open(`/c/${roomResp.room.publicToken}`, "_blank", "noopener,noreferrer");
                showToast("Відкрито робочу зону конструктора для заповнення менеджером", {
                  tone: "success",
                });
              }
            } catch {
              showToast(
                "Передачу виконано. Кімната конструктора стане доступною після прийнятої передачі.",
                { tone: "warning" },
              );
            }
          })
        }
      >
        {busy
          ? "Створення…"
          : data.productionLaunch.status === "LAUNCHED"
            ? "Вже передано"
            : "Передати в виробництво"}
      </button>
      {data.productionLaunch.status === "FAILED" ? (
        <button
          type="button"
          disabled={busy}
          className={cn(btnGhost, "mt-2")}
          onClick={() =>
            void run(async () => {
              await patchProductionLaunch(data.deal.id, { action: "retry" });
              showToast("Повторний запуск поставлено в чергу", { tone: "warning" });
            })
          }
        >
          {busy ? "Оновлення…" : "Повторити запуск (в чергу)"}
        </button>
      ) : null}
      <ConstructorRoomPanel
        dealId={data.deal.id}
        canUse={
          data.handoff.status === "ACCEPTED" &&
          Boolean(data.productionLaunch.productionOrderId)
        }
        initialRoom={data.constructorRoom}
      />
      <StageAiAssistantCard stage="production" data={data} />
      <StageFormTemplateCard stage="production" roleView={roleView} />
    </div>
  );
}

function FilesTab({ data }: { data: DealWorkspacePayload }) {
  const { err, busy, run } = useWorkspaceRun(data.deal.id);
  const { showToast } = useDealWorkspaceToast();
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileAssetId, setFileAssetId] = useState("");
  const [category, setCategory] = useState<AttachmentCategory>("OTHER");
  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  return (
    <div className={wrap}>
      <h2 className="text-base font-semibold text-[var(--enver-text)]">Файли</h2>
      <p className="mt-1 text-xs text-slate-600">
        Додайте посилання на файл (S3, Google Drive тощо). У БД зберігається
        запис вкладення.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Зараз у БД: {data.attachmentsCount} файл(ів).
      </p>
      {Object.keys(data.attachmentsByCategory).length > 0 ? (
        <ul className="mt-2 text-xs">
          {Object.entries(data.attachmentsByCategory).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      ) : null}
      {data.attachments.length > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-[var(--enver-surface)] p-2.5">
          <p className="text-[11px] font-medium text-[var(--enver-text)]">
            Останні файли в угоді (видимі після переносу)
          </p>
          <ul className="mt-1.5 space-y-1">
            {data.attachments.slice(0, 20).map((item) => (
              <li key={item.id} className="text-xs text-[var(--enver-text-muted)]">
                <a
                  href={item.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--enver-accent-hover)] underline underline-offset-2"
                >
                  {item.fileName}
                </a>
                <span className="ml-1 text-slate-500">({item.category})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {err ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="block text-[11px] sm:col-span-2">
          <span className="text-slate-500">Назва</span>
          <input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-[11px] sm:col-span-2">
          <span className="text-slate-500">URL</span>
          <input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-[11px]">
          <span className="text-slate-500">Категорія</span>
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as AttachmentCategory)
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            {ATTACH_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] sm:col-span-2">
          <span className="text-slate-500">
            ID логічного файлу (нова версія, необовʼязково)
          </span>
          <input
            value={fileAssetId}
            onChange={(e) => setFileAssetId(e.target.value)}
            placeholder="cuid з відповіді API після першого завантаження"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy || !fileName.trim() || !fileUrl.trim()}
        className={cn(btn, "mt-3")}
        onClick={() =>
          void run(async () => {
            const j = (await postJson(
              `/api/deals/${data.deal.id}/attachments`,
              {
                fileName: fileName.trim(),
                fileUrl: fileUrl.trim(),
                mimeType: "application/octet-stream",
                category,
                ...(fileAssetId.trim()
                  ? { fileAssetId: fileAssetId.trim() }
                  : {}),
              },
            )) as AttachmentCreateResponse;
            setFileName("");
            setFileUrl("");
            if (j.fileAssetId && !fileAssetId.trim()) {
              setFileAssetId(j.fileAssetId);
            }
            showToast("Файл додано до угоди");
          })
        }
      >
        {busy ? "Збереження…" : "Додати файл"}
      </button>
    </div>
  );
}

type LogItem = {
  id: string;
  label: string;
  createdAt: string;
  actor: string | null;
};

type ProductionLaunchResponse = {
  handoffImportedFileCount?: number | null;
};

type AttachmentCreateResponse = {
  fileAssetId?: string;
};

function ActivityTab({ data }: { data: DealWorkspacePayload }) {
  const [items, setItems] = useState<LogItem[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const { showToast } = useDealWorkspaceToast();
  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  const loadActivity = useCallback(async () => {
    const r = await fetch(`/api/deals/${data.deal.id}/activity`);
    const j = await readResponseJson<{
      items?: LogItem[];
      error?: string;
    }>(r);
    if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити");
    return j.items ?? [];
  }, [data.deal.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nextItems = await loadActivity();
        if (!cancelled) setItems(nextItems);
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : "Помилка");
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadActivity]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const nextItems = await loadActivity();
          setItems(nextItems);
          setLoadErr(null);
        } catch {
          // Keep current items and avoid noisy polling errors.
        }
      })();
    }, REALTIME_POLICY.dealActivityPollingMs);
    return () => window.clearInterval(id);
  }, [loadActivity]);

  return (
    <div className={wrap}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--enver-text)]">
            Журнал активності
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Останні події по цій угоді (зберігаються при змінах через API).
          </p>
        </div>
        <button
          type="button"
          disabled={items === null || refreshBusy}
          className={btnGhost}
          onClick={() =>
            void (async () => {
              setRefreshBusy(true);
              try {
                const nextItems = await loadActivity();
                setItems(nextItems);
                setLoadErr(null);
                showToast("Журнал оновлено", { tone: "info" });
              } catch (e) {
                setLoadErr(e instanceof Error ? e.message : "Помилка");
                setItems([]);
              } finally {
                setRefreshBusy(false);
              }
            })()
          }
        >
          {refreshBusy ? "Оновлення…" : "Оновити"}
        </button>
      </div>
      {loadErr ? (
        <p className="mt-2 text-xs text-rose-700">{loadErr}</p>
      ) : null}
      {items === null ? (
        <p className="mt-3 text-xs text-slate-500">Завантаження…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">Записів ще немає.</p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-xs">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
            >
              <div className="font-medium text-slate-800">{it.label}</div>
              <div className="text-slate-500">
                {new Date(it.createdAt).toLocaleString("uk-UA")}
                {it.actor ? ` · ${it.actor}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessagesTab({ data }: { data: DealWorkspacePayload }) {
  const { err, busy, run } = useWorkspaceRun(data.deal.id);
  const [text, setText] = useState(data.meta.communicationsNote ?? "");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync note when `data` updates
    setText(data.meta.communicationsNote ?? "");
  }, [data.meta.communicationsNote]);
  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  return (
    <div className="space-y-6">
      <CommunicationHub
        dealId={data.deal.id}
        leadId={data.leadId ?? undefined}
        canPostNotes={Boolean(data.leadId)}
      />
      <div className={wrap}>
        <h2 className="text-base font-semibold text-[var(--enver-text)]">
          Службова нотатка (метадані угоди)
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Короткий зріз для команди; окремо від потоків комунікації та AI.
        </p>
        {err ? (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {err}
          </p>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="mt-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          className={cn(btn, "mt-2")}
          onClick={() =>
            void run(async () => {
              await patchMeta(data.deal.id, {
                communicationsNote: text.trim() ? text.trim() : null,
              });
            })
          }
        >
          {busy ? "Збереження…" : "Зберегти"}
        </button>
      </div>
    </div>
  );
}

function QualificationTab({
  data,
  roleView,
}: {
  data: DealWorkspacePayload;
  roleView: "director" | "head" | "sales";
}) {
  const { err, busy, run } = useWorkspaceRun(data.deal.id);
  const { showToast } = useDealWorkspaceToast();
  const [notes, setNotes] = useState(data.meta.qualificationNotes ?? "");
  const [done, setDone] = useState(Boolean(data.meta.qualificationComplete));
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync qualification fields when `data` updates */
    setNotes(data.meta.qualificationNotes ?? "");
    setDone(Boolean(data.meta.qualificationComplete));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data.meta.qualificationNotes, data.meta.qualificationComplete]);
  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  return (
    <div className={wrap}>
      <h2 className="text-base font-semibold text-[var(--enver-text)]">Кваліфікація</h2>
      <p className="mt-1 text-xs text-slate-600">
        Фіксуйте результат кваліфікації та нотатки.
      </p>
      {err ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}
      <label className="mt-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
        />
        Кваліфікація завершена
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Нотатки…"
        className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={busy}
        className={cn(btn, "mt-2")}
        onClick={() =>
          void run(async () => {
            await patchMeta(data.deal.id, {
              qualificationComplete: done,
              qualificationNotes: notes.trim() ? notes.trim() : null,
            });
          })
        }
      >
        {busy ? "Збереження…" : "Зберегти"}
      </button>
      <StageAiAssistantCard stage="qualification" data={data} />
      <StageFormTemplateCard stage="qualification" roleView={roleView} />
    </div>
  );
}

function MeasurementTab({
  data,
  roleView,
}: {
  data: DealWorkspacePayload;
  roleView: "director" | "head" | "sales";
}) {
  const { err, busy, run } = useWorkspaceRun(data.deal.id);
  const { showToast } = useDealWorkspaceToast();
  const [notes, setNotes] = useState(data.meta.measurementNotes ?? "");
  const [done, setDone] = useState(Boolean(data.meta.measurementComplete));
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync measurement fields when `data` updates */
    setNotes(data.meta.measurementNotes ?? "");
    setDone(Boolean(data.meta.measurementComplete));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data.meta.measurementNotes, data.meta.measurementComplete]);
  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  return (
    <div className={wrap}>
      <h2 className="text-base font-semibold text-[var(--enver-text)]">Замір</h2>
      <p className="mt-1 text-xs text-slate-600">
        Результати заміру та прапорець для готовності.
      </p>
      {err ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}
      <label className="mt-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
        />
        Замір зафіксовано
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Результати, розміри…"
        className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={busy}
        className={cn(btn, "mt-2")}
        onClick={() =>
          void run(async () => {
            await patchMeta(data.deal.id, {
              measurementComplete: done,
              measurementNotes: notes.trim() ? notes.trim() : null,
            });
          })
        }
      >
        {busy ? "Збереження…" : "Зберегти"}
      </button>
      <StageAiAssistantCard stage="measurement" data={data} />
      <StageFormTemplateCard stage="measurement" roleView={roleView} />
    </div>
  );
}

function ProposalTab({
  data,
  roleView,
}: {
  data: DealWorkspacePayload;
  roleView: "director" | "head" | "sales";
}) {
  const { err, busy, run } = useWorkspaceRun(data.deal.id);
  const [notes, setNotes] = useState(data.meta.proposalNotes ?? "");
  const [sent, setSent] = useState(Boolean(data.meta.proposalSent));
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync proposal fields when `data` updates */
    setNotes(data.meta.proposalNotes ?? "");
    setSent(Boolean(data.meta.proposalSent));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data.meta.proposalNotes, data.meta.proposalSent]);
  const wrap =
    "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";

  return (
    <div className={wrap}>
      <h2 className="text-base font-semibold text-[var(--enver-text)]">
        Комерційна пропозиція
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Статус відправки КП та нотатки.
      </p>
      {err ? (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </p>
      ) : null}
      <label className="mt-3 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={sent}
          onChange={(e) => setSent(e.target.checked)}
        />
        КП надіслано клієнту
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Версія, умови…"
        className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        disabled={busy}
        className={cn(btn, "mt-2")}
        onClick={() =>
          void run(async () => {
            await patchMeta(data.deal.id, {
              proposalSent: sent,
              proposalNotes: notes.trim() ? notes.trim() : null,
            });
          })
        }
      >
        {busy ? "Збереження…" : "Зберегти"}
      </button>
      <StageAiAssistantCard stage="proposal" data={data} />
      <StageFormTemplateCard stage="proposal" roleView={roleView} />
    </div>
  );
}

type Props = {
  tab: DealWorkspaceTabId;
  data: DealWorkspacePayload;
  onTab: (id: DealWorkspaceTabId) => void;
  estimateVisibility: "director" | "head" | "sales";
};

export function DealWorkspaceTabPanels({
  tab,
  data,
  onTab,
  estimateVisibility,
}: Props) {
  const wrap = "rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 text-sm shadow-sm";
  const roleView = estimateVisibility;

  if (tab === "overview") {
    return <DealHubPage dealId={data.deal.id} />;
  }

  if (tab === "estimate")
    return (
      <EstimateWorkspaceTab
        data={data}
        estimateVisibility={estimateVisibility}
      />
    );
  if (tab === "tasks") return <TasksWorkspaceTab data={data} />;
  if (tab === "contract") return <ContractTab data={data} roleView={roleView} />;
  if (tab === "payment") return <PaymentTab data={data} roleView={roleView} />;
  if (tab === "finance")
    return <DealFinanceProcurementTab data={data} roleView={roleView} />;
  if (tab === "handoff") return <HandoffTab data={data} roleView={roleView} onTab={onTab} />;
  if (tab === "production") return <ProductionTab data={data} roleView={roleView} />;
  if (tab === "files") return <FilesTab data={data} />;
  if (tab === "activity") return <ActivityTab data={data} />;
  if (tab === "messages") return <MessagesTab data={data} />;
  if (tab === "qualification") return <QualificationTab data={data} roleView={roleView} />;
  if (tab === "measurement") return <MeasurementTab data={data} roleView={roleView} />;
  if (tab === "proposal") return <ProposalTab data={data} roleView={roleView} />;

  const placeholders: Record<string, string> = {
    messages:
      "Об'єднані канали (Telegram, пошта) з прив'язкою до угоди — інтеграція inbox.",
    qualification:
      "Чеклист кваліфікації та конверсія лід → контакт + угода одним кроком.",
    measurement:
      "Результати заміру, фото, прив'язка до календаря та задач виконавця.",
    proposal:
      "Редактор КП, версії, відправка клієнту та статус прийняття.",
  };

  const tabTitle =
    DEAL_WORKSPACE_TABS.find((t) => t.id === tab)?.label ?? tab;

  return (
    <div className={wrap}>
      <h2 className="text-base font-semibold text-[var(--enver-text)]">{tabTitle}</h2>
      <p className="mt-2 text-xs text-slate-600">
        {placeholders[tab] ??
          "Контент вкладки буде підключено до API та автоматизацій."}
      </p>
    </div>
  );
}
