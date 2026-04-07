import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { SessionUser } from "../authz/api-guard";
import { resolveAccessContext } from "../authz/data-scope";

/**
 * Обмеження списку задач: SUPER_ADMIN/DIRECTOR — усі; HEAD_MANAGER — команда продажів;
 * SALES_MANAGER — свої та по своїх угодах/лідах.
 */
export async function taskListWhereForUser(
  prisma: PrismaClient,
  user: SessionUser,
): Promise<Prisma.TaskWhereInput> {
  const ctx = await resolveAccessContext(prisma, user);
  if (ctx.teamOwnerIdSet === null) {
    return {};
  }

  const ids = [...ctx.teamOwnerIdSet];

  const [deals, leads] = await Promise.all([
    prisma.deal.findMany({
      where: { ownerId: { in: ids } },
      select: { id: true },
    }),
    prisma.lead.findMany({
      where: { ownerId: { in: ids } },
      select: { id: true },
    }),
  ]);

  const dealIds = deals.map((d) => d.id);
  const leadIds = leads.map((l) => l.id);

  const or: Prisma.TaskWhereInput[] = [
    { assigneeId: { in: ids } },
    { createdById: { in: ids } },
  ];

  if (dealIds.length > 0) {
    or.push({
      AND: [{ entityType: "DEAL" }, { entityId: { in: dealIds } }],
    });
  }
  if (leadIds.length > 0) {
    or.push({
      AND: [{ entityType: "LEAD" }, { entityId: { in: leadIds } }],
    });
  }

  return { OR: or };
}
