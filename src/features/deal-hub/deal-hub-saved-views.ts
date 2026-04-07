import { prisma } from "../../lib/prisma";
import {
  dealHubFiltersSchema,
  type DealHubFilters,
  type DealHubSavedViewDTO,
} from "./deal-hub-filters";

function parseFilters(raw: unknown): DealHubFilters | null {
  const r = dealHubFiltersSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export async function listDealHubSavedViewsForUser(
  userId: string,
): Promise<DealHubSavedViewDTO[]> {
  const rows = await prisma.dealHubSavedView.findMany({
    where: { userId },
    orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
  });
  const out: DealHubSavedViewDTO[] = [];
  for (const row of rows) {
    const filters = parseFilters(row.filtersJson);
    if (!filters) continue;
    out.push({
      id: row.id,
      name: row.name,
      filters,
      updatedAt: row.updatedAt.toISOString(),
    });
  }
  return out;
}

export async function createDealHubSavedView(input: {
  userId: string;
  name: string;
  filters: DealHubFilters;
}): Promise<{ id: string } | { error: string }> {
  const name = input.name.trim().slice(0, 160);
  if (!name) return { error: "Вкажіть назву вигляду" };
  const filters = dealHubFiltersSchema.safeParse(input.filters);
  if (!filters.success) return { error: "Некоректні фільтри" };

  const maxSort = await prisma.dealHubSavedView.aggregate({
    where: { userId: input.userId },
    _max: { sortIndex: true },
  });
  const sortIndex = (maxSort._max.sortIndex ?? -1) + 1;

  const row = await prisma.dealHubSavedView.create({
    data: {
      userId: input.userId,
      name,
      filtersJson: filters.data as object,
      sortIndex,
    },
  });
  return { id: row.id };
}

export async function deleteDealHubSavedView(input: {
  userId: string;
  id: string;
}): Promise<{ ok: true } | { error: string }> {
  const row = await prisma.dealHubSavedView.findFirst({
    where: { id: input.id, userId: input.userId },
    select: { id: true },
  });
  if (!row) return { error: "Не знайдено" };
  await prisma.dealHubSavedView.delete({ where: { id: input.id } });
  return { ok: true };
}
