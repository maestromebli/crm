"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { readResponseJson } from "@/lib/http/read-response-json";
import { cn } from "@/lib/utils";

const btn =
  "inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50";
const btnDanger =
  "inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50";

type OrchRow = {
  id: string;
  productionNumber: string;
  status: string;
  externalWorkspaceToken: string | null;
  acceptedAt: string | null;
  constructorType: string | null;
  constructorUser: { id: string; name: string | null; email: string } | null;
  constructorExternalName: string | null;
  constructorExternalPhone: string | null;
  constructorExternalEmail: string | null;
  productionNotes: string | null;
  dueDate: string | null;
};

type OrchPayload = {
  orchestration: OrchRow | null;
  clarifications: Array<{ id: string; status: string; createdAt: string }>;
};

type CandidateUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

export function ProductionOrchestrationHandoffPanel({
  dealId,
  activeEstimateId,
}: {
  dealId: string;
  activeEstimateId: string | null;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const keys = session?.user?.permissionKeys ?? [];
  const canView = keys.includes("PRODUCTION_ORCHESTRATION_VIEW") || keys.includes("PRODUCTION_LAUNCH");
  const canManage =
    keys.includes("PRODUCTION_ORCHESTRATION_MANAGE") ||
    keys.includes("PRODUCTION_LAUNCH") ||
    keys.includes("HANDOFF_ACCEPT");

  const [data, setData] = useState<OrchPayload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clarifyIssues, setClarifyIssues] = useState("");
  const [clarifyMsg, setClarifyMsg] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [assignMode, setAssignMode] = useState<"INTERNAL" | "OUTSOURCED">("INTERNAL");
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [extName, setExtName] = useState("");
  const [extPhone, setExtPhone] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [notesAssign, setNotesAssign] = useState("");
  const [regenToken, setRegenToken] = useState(false);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoadErr(null);
    try {
      const r = await fetch(`/api/deals/${dealId}/production-orchestration`);
      const j = await readResponseJson<OrchPayload & { error?: string }>(r);
      if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити");
      setData({ orchestration: j.orchestration, clarifications: j.clarifications });
      if (j.orchestration) {
        setNotesAssign(j.orchestration.productionNotes ?? "");
        if (j.orchestration.dueDate) {
          const d = new Date(j.orchestration.dueDate);
          if (!Number.isNaN(d.getTime())) {
            setDueLocal(d.toISOString().slice(0, 16));
          }
        }
        if (j.orchestration.constructorUser) {
          setSelectedUserId(j.orchestration.constructorUser.id);
        }
        setExtName(j.orchestration.constructorExternalName ?? "");
        setExtPhone(j.orchestration.constructorExternalPhone ?? "");
        setExtEmail(j.orchestration.constructorExternalEmail ?? "");
        if (j.orchestration.constructorType === "OUTSOURCED") {
          setAssignMode("OUTSOURCED");
        } else if (j.orchestration.constructorType === "INTERNAL") {
          setAssignMode("INTERNAL");
        }
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Помилка");
    }
  }, [canView, dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage || !dealId) return;
    void (async () => {
      try {
        const r = await fetch(
          `/api/deals/${dealId}/production-orchestration/constructor-candidates`,
        );
        const j = await readResponseJson<{ users?: CandidateUser[]; error?: string }>(r);
        if (r.ok && j.users) setCandidates(j.users);
      } catch {
        /* ignore */
      }
    })();
  }, [canManage, dealId]);

  if (sessionStatus === "loading" || !canView) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            Production OS
          </p>
          <h3 className="text-sm font-semibold text-slate-900">
            Прийняття начальником виробництва
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Після поданого пакета передачі — прийняти у виробничу оркестрацію, запитати
            уточнення або повернути менеджеру.
          </p>
        </div>
      </div>

      {loadErr ? (
        <p className="mt-2 text-xs text-rose-700">{loadErr}</p>
      ) : null}

      {data?.orchestration ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
          <span className="font-semibold">{data.orchestration.productionNumber}</span>
          <span className="text-emerald-800"> · {data.orchestration.status}</span>
          {data.orchestration.externalWorkspaceToken ? (
            <p className="mt-1 text-[11px] text-emerald-900">
              Зовнішній доступ:{" "}
              <code className="rounded bg-white/80 px-1">
                /crm/external/constructor/{data.orchestration.externalWorkspaceToken}
              </code>
            </p>
          ) : null}
          {data.orchestration.constructorUser ? (
            <p className="mt-1 text-[11px] text-emerald-900">
              Внутрішній:{" "}
              {data.orchestration.constructorUser.name ?? data.orchestration.constructorUser.email}
            </p>
          ) : null}
          {data.orchestration.constructorExternalName ? (
            <p className="mt-1 text-[11px] text-emerald-900">
              Зовнішній: {data.orchestration.constructorExternalName}
              {data.orchestration.constructorExternalPhone
                ? ` · ${data.orchestration.constructorExternalPhone}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : (
        canManage && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      const r = await fetch(
                        `/api/deals/${dealId}/production-orchestration/accept`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            estimateId: activeEstimateId,
                          }),
                        },
                      );
                      const j = await readResponseJson<{ ok?: boolean; error?: string }>(r);
                      if (!r.ok) throw new Error(j.error ?? "Помилка");
                      await load();
                    } catch (e) {
                      setLoadErr(e instanceof Error ? e.message : "Помилка");
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                Прийняти у виробництво
              </button>
              <button
                type="button"
                className={btnGhost}
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      const issues = clarifyIssues
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const r = await fetch(
                        `/api/deals/${dealId}/production-orchestration/clarify`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            issues: issues.length ? issues : ["Потрібні уточнення"],
                            messageToManager: clarifyMsg || null,
                          }),
                        },
                      );
                      const j = await readResponseJson<{ ok?: boolean; error?: string }>(r);
                      if (!r.ok) throw new Error(j.error ?? "Помилка");
                      setClarifyIssues("");
                      setClarifyMsg("");
                      await load();
                    } catch (e) {
                      setLoadErr(e instanceof Error ? e.message : "Помилка");
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                Запитати уточнення
              </button>
              <button
                type="button"
                className={btnDanger}
                disabled={busy || !rejectReason.trim()}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    try {
                      const r = await fetch(
                        `/api/deals/${dealId}/production-orchestration/reject`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ reason: rejectReason.trim() }),
                        },
                      );
                      const j = await readResponseJson<{ ok?: boolean; error?: string }>(r);
                      if (!r.ok) throw new Error(j.error ?? "Помилка");
                      setRejectReason("");
                      await load();
                    } catch (e) {
                      setLoadErr(e instanceof Error ? e.message : "Помилка");
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                Повернути менеджеру
              </button>
            </div>
            <label className="block text-[11px] text-slate-600">
              Список питань (кожен з нового рядка)
              <textarea
                value={clarifyIssues}
                onChange={(e) => setClarifyIssues(e.target.value)}
                rows={2}
                className={cn(
                  "mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs",
                )}
                placeholder="Наприклад: уточнити фасад / фурнітуру…"
              />
            </label>
            <label className="block text-[11px] text-slate-600">
              Коментар менеджеру
              <textarea
                value={clarifyMsg}
                onChange={(e) => setClarifyMsg(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
            </label>
            <label className="block text-[11px] text-slate-600">
              Причина повернення (для «Повернути менеджеру»)
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
            </label>
          </div>
        )
      )}

      {data?.orchestration &&
      canManage &&
      (data.orchestration.status === "ACCEPTED" ||
        data.orchestration.status === "CONSTRUCTOR_ASSIGNED") ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
          <p className="font-semibold text-slate-900">Призначення конструктора</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="assignMode"
                checked={assignMode === "INTERNAL"}
                onChange={() => setAssignMode("INTERNAL")}
              />
              Внутрішній (користувач CRM)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="assignMode"
                checked={assignMode === "OUTSOURCED"}
                onChange={() => setAssignMode("OUTSOURCED")}
              />
              Зовнішній (посилання + токен)
            </label>
          </div>
          {assignMode === "INTERNAL" ? (
            <label className="mt-2 block text-[11px] text-slate-600">
              Конструктор
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              >
                <option value="">— оберіть —</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name ?? u.email) + ` · ${u.role}`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="mt-2 space-y-2">
              <label className="block text-[11px] text-slate-600">
                Імʼя / компанія *
                <input
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="block text-[11px] text-slate-600">
                Телефон
                <input
                  value={extPhone}
                  onChange={(e) => setExtPhone(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="block text-[11px] text-slate-600">
                Email
                <input
                  type="email"
                  value={extEmail}
                  onChange={(e) => setExtEmail(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={regenToken}
                  onChange={(e) => setRegenToken(e.target.checked)}
                />
                Згенерувати нове посилання (якщо вже був токен)
              </label>
            </div>
          )}
          <label className="mt-2 block text-[11px] text-slate-600">
            Дедлайн
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            />
          </label>
          <label className="mt-2 block text-[11px] text-slate-600">
            Нотатки виробництва
            <textarea
              value={notesAssign}
              onChange={(e) => setNotesAssign(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            />
          </label>
          <button
            type="button"
            className={cn(btn, "mt-3")}
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  const r = await fetch(
                    `/api/deals/${dealId}/production-orchestration/assign-constructor`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: assignMode,
                        constructorUserId:
                          assignMode === "INTERNAL" ? selectedUserId || null : null,
                        constructorExternalName:
                          assignMode === "OUTSOURCED" ? extName.trim() || null : null,
                        constructorExternalPhone:
                          assignMode === "OUTSOURCED" ? extPhone.trim() || null : null,
                        constructorExternalEmail:
                          assignMode === "OUTSOURCED" ? extEmail.trim() || null : null,
                        dueDate: dueLocal ? new Date(dueLocal).toISOString() : null,
                        productionNotes: notesAssign.trim() || null,
                        regenerateToken: assignMode === "OUTSOURCED" ? regenToken : false,
                      }),
                    },
                  );
                  const j = await readResponseJson<{
                    ok?: boolean;
                    error?: string;
                    externalWorkspaceToken?: string | null;
                  }>(r);
                  if (!r.ok) throw new Error(j.error ?? "Помилка");
                  setRegenToken(false);
                  await load();
                } catch (e) {
                  setLoadErr(e instanceof Error ? e.message : "Помилка");
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            Зберегти призначення
          </button>
        </div>
      ) : null}

      {data && data.clarifications.length > 0 ? (
        <p className="mt-3 text-[11px] text-slate-500">
          Останні запити уточнень: {data.clarifications.length}
        </p>
      ) : null}
    </div>
  );
}
