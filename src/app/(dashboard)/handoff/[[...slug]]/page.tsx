import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { HandoffStatus, Prisma } from "@prisma/client";
import { getSessionAccess } from "@/lib/authz/session-access";
import { hasEffectivePermission, P } from "@/lib/authz/permissions";
import { ownerIdWhere } from "@/lib/authz/data-scope";
import { prisma } from "@/lib/prisma";
import { allReadinessMet, evaluateReadiness } from "@/lib/deal-core/readiness";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

type HandoffView =
  | "waiting"
  | "need-completion"
  | "ready"
  | "accepted"
  | "returned"
  | "checklists";

type HandoffRow = {
  id: string;
  title: string;
  updatedAt: Date;
  clientName: string;
  ownerName: string;
  handoffStatus: HandoffStatus;
  submittedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  readinessAllMet: boolean;
  blockers: string[];
};

const VIEW_LABELS: Record<HandoffView, { title: string; subtitle: string }> = {
  waiting: {
    title: "Очікують передачі",
    subtitle: "Чернетки, які ще не відправлені в передачу у виробництво.",
  },
  "need-completion": {
    title: "Потребують доповнення",
    subtitle: "Повернуті або неповні пакети з блокерами готовності.",
  },
  ready: {
    title: "Готові до прийняття",
    subtitle: "Пакети у статусі «Надіслано» для перевірки виробництвом.",
  },
  accepted: {
    title: "Прийняті",
    subtitle: "Передачі, які вже підтверджені виробництвом.",
  },
  returned: {
    title: "Повернуті на доопрацювання",
    subtitle: "Передачі у статусі «Повернено» з причинами повернення.",
  },
  checklists: {
    title: "Чек-листи готовності",
    subtitle: "Контроль блокерів готовності перед передачею у виробництво.",
  },
};

function handoffStatusLabel(status: HandoffStatus): string {
  if (status === "DRAFT") return "Чернетка";
  if (status === "SUBMITTED") return "Надіслано";
  if (status === "ACCEPTED") return "Прийнято";
  if (status === "REJECTED") return "Повернено";
  return status;
}

function resolveView(slug?: string[]): HandoffView {
  const first = slug?.[0];
  if (first === "need-completion") return "need-completion";
  if (first === "ready") return "ready";
  if (first === "accepted") return "accepted";
  if (first === "returned") return "returned";
  if (first === "checklists") return "checklists";
  return "waiting";
}

function parseMeta(raw: unknown): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
}

function pickRowsForView(view: HandoffView, rows: HandoffRow[]): HandoffRow[] {
  switch (view) {
    case "waiting":
      return rows.filter((row) => row.handoffStatus === "DRAFT");
    case "need-completion":
      return rows.filter(
        (row) =>
          row.handoffStatus === "REJECTED" ||
          (row.handoffStatus === "DRAFT" && !row.readinessAllMet),
      );
    case "ready":
      return rows.filter((row) => row.handoffStatus === "SUBMITTED");
    case "accepted":
      return rows.filter((row) => row.handoffStatus === "ACCEPTED");
    case "returned":
      return rows.filter((row) => row.handoffStatus === "REJECTED");
    case "checklists":
      return rows.filter((row) => !row.readinessAllMet);
    default:
      return rows;
  }
}

async function loadHandoffRows(
  ownerWhere: Prisma.StringFilter | undefined,
): Promise<HandoffRow[]> {
  const deals = await prisma.deal.findMany({
    where: ownerWhere ? { ownerId: ownerWhere } : {},
    orderBy: { updatedAt: "desc" },
    take: 250,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      workspaceMeta: true,
      client: { select: { name: true } },
      owner: { select: { name: true, email: true } },
      contract: { select: { status: true } },
      handoff: {
        select: {
          status: true,
          submittedAt: true,
          acceptedAt: true,
          rejectedAt: true,
          rejectionReason: true,
        },
      },
    },
  });

  const dealIds = deals.map((d) => d.id);
  const drawingRows = dealIds.length
    ? await prisma.attachment.findMany({
        where: {
          entityType: "DEAL",
          entityId: { in: dealIds },
          isCurrentVersion: true,
          category: { in: ["DRAWING", "MEASUREMENT_SHEET"] },
        },
        select: { entityId: true, category: true },
      })
    : [];

  const attachmentMap = new Map<string, Record<string, number>>();
  for (const row of drawingRows) {
    const current = attachmentMap.get(row.entityId) ?? {};
    current[row.category] = (current[row.category] ?? 0) + 1;
    attachmentMap.set(row.entityId, current);
  }

  return deals.map((deal) => {
    const readinessChecks = evaluateReadiness({
      meta: parseMeta(deal.workspaceMeta),
      contractStatus: deal.contract?.status ?? null,
      attachmentsByCategory: attachmentMap.get(deal.id) ?? {},
    });
    const handoffStatus = deal.handoff?.status ?? "DRAFT";
    return {
      id: deal.id,
      title: deal.title,
      updatedAt: deal.updatedAt,
      clientName: deal.client.name,
      ownerName: deal.owner.name ?? deal.owner.email,
      handoffStatus,
      submittedAt: deal.handoff?.submittedAt ?? null,
      acceptedAt: deal.handoff?.acceptedAt ?? null,
      rejectedAt: deal.handoff?.rejectedAt ?? null,
      rejectionReason: deal.handoff?.rejectionReason ?? null,
      readinessAllMet: allReadinessMet(readinessChecks),
      blockers: readinessChecks.filter((c) => !c.done).map((c) => c.label),
    };
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = resolveView(slug);
  return {
    title: `${VIEW_LABELS[view].title} · Передача · ENVER CRM`,
  };
}

export default async function HandoffPage({ params }: PageProps) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");

  const permCtx = {
    realRole: access.realRole,
    impersonatorId: access.impersonatorId,
  };
  const canOpenHandoff =
    hasEffectivePermission(access.permissionKeys, P.HANDOFF_SUBMIT, permCtx) ||
    hasEffectivePermission(access.permissionKeys, P.HANDOFF_ACCEPT, permCtx);
  if (!canOpenHandoff) {
    redirect("/crm/dashboard");
  }

  const { slug } = await params;
  const view = resolveView(slug);
  const rows = await loadHandoffRows(ownerIdWhere(access.ctx));
  const filtered = pickRowsForView(view, rows);

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          {VIEW_LABELS[view].title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{VIEW_LABELS[view].subtitle}</p>
        <p className="mt-2 text-xs text-slate-500">
          Показано: {filtered.length} з {rows.length} угод у зоні видимості.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Угода</th>
                <th className="px-3 py-2">Клієнт</th>
                <th className="px-3 py-2">Власник</th>
                <th className="px-3 py-2">Передача</th>
                <th className="px-3 py-2">Готовність</th>
                <th className="px-3 py-2">Оновлено</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={`/deals/${row.id}/workspace?tab=handoff`}
                      className="font-medium text-sky-800 underline-offset-2 hover:underline"
                    >
                      {row.title}
                    </Link>
                    {row.rejectionReason ? (
                      <p className="mt-1 text-xs text-rose-700">
                        Причина: {row.rejectionReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.clientName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.ownerName}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{handoffStatusLabel(row.handoffStatus)}</p>
                    {row.submittedAt ? (
                      <p className="text-xs text-slate-500">
                        надіслано: {row.submittedAt.toLocaleString("uk-UA")}
                      </p>
                    ) : null}
                    {row.acceptedAt ? (
                      <p className="text-xs text-emerald-700">
                        прийнято: {row.acceptedAt.toLocaleString("uk-UA")}
                      </p>
                    ) : null}
                    {row.rejectedAt ? (
                      <p className="text-xs text-rose-700">
                        повернено: {row.rejectedAt.toLocaleString("uk-UA")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {row.readinessAllMet ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        ГОТОВО
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          БЛОКЕРИ
                        </span>
                        <p className="max-w-[300px] text-xs text-slate-500">
                          {row.blockers.slice(0, 2).join(" · ")}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                    {row.updatedAt.toLocaleString("uk-UA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <p className="border-t border-slate-100 px-3 py-6 text-sm text-slate-500">
            Для цього зрізу ще немає записів.
          </p>
        ) : null}
      </section>
    </main>
  );
}
