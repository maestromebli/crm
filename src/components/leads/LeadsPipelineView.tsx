import Link from "next/link";
import { leadsGroupedByStage } from "../../features/leads/queries";
import {
  hasEffectivePermission,
  P,
} from "../../lib/authz/permissions";
import { getSessionAccess } from "../../lib/authz/session-access";
import { KanbanEmptyColumn } from "@/components/shared/KanbanEmptyColumn";
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
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)] px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-5">
        <header className="enver-panel enver-panel--interactive flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--enver-muted)]">
              Ліди
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
              Воронка лідів
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--enver-text-muted)] md:text-sm">
              Канбан за стадіями воронки. Перетягування між колонками — у наступній
              ітерації; зараз відкривайте картку ліда для змін.
            </p>
          </div>
          <LeadsToolbar
            view="pipeline"
            canUploadLeadFiles={canUploadLeadFiles}
          />
        </header>

        {groups.length === 0 ? (
          <div className="enver-panel flex min-h-[240px] items-center justify-center p-6">
            <KanbanEmptyColumn
              className="max-w-md border-0 bg-transparent py-8"
              message="Немає стадій або лідів для воронки. Перевірте пайплайн у налаштуваннях та seed."
            />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {groups.map(({ stage, leads }) => (
              <div
                key={stage.id}
                className="enver-panel enver-panel--interactive flex w-72 shrink-0 flex-col"
              >
                <div className="border-b border-[var(--enver-border)] px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-text)]">
                    {stage.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--enver-muted)]">
                    {leads.length}{" "}
                    {leads.length === 1 ? "лід" : "лідів"}
                  </p>
                </div>
                <div className="flex max-h-[calc(100vh-220px)] min-h-[200px] flex-col gap-2 overflow-y-auto p-2">
                  {leads.length === 0 ? (
                    <KanbanEmptyColumn
                      className="min-h-[100px] flex-1 border-dashed py-6"
                      message="Немає лідів у стадії"
                    />
                  ) : (
                    leads.map((lead) => (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="block rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-2.5 text-xs shadow-[var(--enver-shadow)] transition hover:border-[var(--enver-accent)]/35 hover:shadow-md"
                      >
                        <p className="font-medium text-[var(--enver-text)]">
                          {lead.title}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--enver-text-muted)]">
                          {lead.source} ·{" "}
                          {lead.owner.name ?? lead.owner.email}
                        </p>
                        {lead.priority === "high" ? (
                          <span className="mt-1.5 inline-block rounded border border-[var(--enver-danger)]/30 bg-[var(--enver-danger-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--enver-danger)]">
                            Пріоритет
                          </span>
                        ) : null}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
