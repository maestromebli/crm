import type { Prisma } from "@prisma/client";

export type SectionInput = {
  id: string;
  title: string;
  sortOrder: number;
  key?: string | null;
};

/**
 * Syncs persisted sections with the client payload (stable section ids).
 * Removes sections not present in the payload; upserts the rest.
 */
export async function syncEstimateSections(
  tx: Prisma.TransactionClient,
  estimateId: string,
  sections: SectionInput[],
): Promise<void> {
  if (sections.length === 0) {
    await tx.estimateSection.deleteMany({ where: { estimateId } });
    return;
  }
  const incomingIds = new Set(sections.map((s) => s.id));
  await tx.estimateSection.deleteMany({
    where: { estimateId, id: { notIn: [...incomingIds] } },
  });
  for (const s of sections) {
    await tx.estimateSection.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        estimateId,
        title: s.title.slice(0, 200),
        sortOrder: s.sortOrder,
        key: s.key?.trim() ? s.key.trim().slice(0, 64) : null,
      },
      update: {
        title: s.title.slice(0, 200),
        sortOrder: s.sortOrder,
        key: s.key?.trim() ? s.key.trim().slice(0, 64) : null,
      },
    });
  }
}
