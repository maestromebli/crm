import { requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { P } from "../../../../lib/authz/permissions";
import { prisma } from "../../../../lib/prisma";
import { ownerIdWhere, resolveAccessContext } from "../../../../lib/authz/data-scope";
import {
  ConstructorsBoardClient,
  type ConstructorBoardRow,
} from "../../../../components/production/ConstructorsBoardClient";

export default async function ProductionConstructorsPage() {
  const session = await requirePermissionForPage(P.PRODUCTION_LAUNCH);
  const access = await resolveAccessContext(prisma, {
    id: session.user.id,
    role: session.user.role,
  });
  const ownerWhere = ownerIdWhere(access);

  const deals = await prisma.deal.findMany({
    where: {
      ...(ownerWhere ? { ownerId: ownerWhere } : {}),
      productionFlow: { isNot: null },
      handoff: { is: { status: "ACCEPTED" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      client: { select: { name: true } },
      constructorRoom: {
        select: {
          status: true,
          publicToken: true,
          priority: true,
          dueAt: true,
          deliveredAt: true,
          externalConstructorLabel: true,
          assignedUserId: true,
          assignedUser: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  const rows: ConstructorBoardRow[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    clientName: d.client.name,
    updatedAt: d.updatedAt.toISOString(),
    room: d.constructorRoom
      ? {
          status: d.constructorRoom.status,
          publicToken: d.constructorRoom.publicToken,
          priority: d.constructorRoom.priority,
          dueAt: d.constructorRoom.dueAt?.toISOString() ?? null,
          deliveredAt: d.constructorRoom.deliveredAt?.toISOString() ?? null,
          externalConstructorLabel: d.constructorRoom.externalConstructorLabel,
          assignedUser: d.constructorRoom.assignedUser,
        }
      : null,
  }));

  return (
    <main className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--enver-text)]">Конструктори</h1>
        <p className="mt-1 text-sm text-slate-600">
          Угоди після запуску у виробництво: кімната конструктора та посилання для
          віддалених виконавців. На екрані — до 500 останніх за оновленням; повний
          вибірка для експорту «CSV (сервер)» — до 2000 записів.
        </p>
      </header>

      {deals.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-600">
          Немає угод із запущеним виробництвом і прийнятою передачею.
        </p>
      ) : (
        <ConstructorsBoardClient initialRows={rows} />
      )}
    </main>
  );
}
