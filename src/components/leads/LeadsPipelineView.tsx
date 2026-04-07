import Link from "next/link";
import { leadsGroupedByStage } from "../../features/leads/queries";
import {
  hasEffectivePermission,
  P,
} from "../../lib/authz/permissions";
import { getSessionAccess } from "../../lib/authz/session-access";
import { LeadsToolbar } from "./LeadsToolbar";

export async function LeadsPipelineView() {
  const access = await getSessionAccess();
  const groups = access ? await leadsGroupedByStage(access.ctx) : [];
  const canUploadLeadFiles = Boolean(
    access &&
      hasEffectivePermission(access.permissionKeys, P.FILES_UPLOAD, {
        realRole: access.realRole,
        impersonatorId: access.impersonatorId,
      }),
  );

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-slate-50 px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-4">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Ліди
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
              Воронка лідів
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-600 md:text-sm">
              Канбан за стадіями воронки. Перетягування стадій — у наступній
              ітерації (оновлення через API).
            </p>
          </div>
          <LeadsToolbar
            view="pipeline"
            canUploadLeadFiles={canUploadLeadFiles}
          />
        </header>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-[var(--enver-card)]/80 px-4 py-10 text-center text-sm text-slate-500">
            Немає даних для воронки. Перевірте БД та seed.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {groups.map(({ stage, leads }) => (
              <div
                key={stage.id}
                className="flex w-72 shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-100/60"
              >
                <div className="border-b border-slate-200/80 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-800">
                    {stage.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {leads.length}{" "}
                    {leads.length === 1 ? "лід" : "лідів"}
                  </p>
                </div>
                <div className="flex max-h-[calc(100vh-220px)] flex-col gap-2 overflow-y-auto p-2">
                  {leads.map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="block rounded-xl border border-slate-200 bg-[var(--enver-card)] p-2.5 text-xs shadow-sm transition hover:border-slate-300 hover:shadow"
                    >
                      <p className="font-medium text-[var(--enver-text)]">
                        {lead.title}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {lead.source} ·{" "}
                        {lead.owner.name ?? lead.owner.email}
                      </p>
                      {lead.priority === "high" ? (
                        <span className="mt-1.5 inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-medium text-rose-800">
                          Пріоритет
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
