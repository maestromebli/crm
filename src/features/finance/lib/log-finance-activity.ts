import { prisma } from "../../../lib/prisma";

export type FinanceExportKind = "registry" | "overview" | "banking" | "payroll" | "project";

/**
 * Запис у ActivityLog (ігнорує помилки — експорт не повинен ламатися через аудит).
 */
export async function logFinanceCsvExport(
  actorUserId: string,
  kind: FinanceExportKind,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        entityType: "FINANCE",
        entityId: "finance",
        type: "FINANCE_CSV_EXPORTED",
        actorUserId,
        source: "USER",
        data: { kind, ...(extra ?? {}) },
      },
    });
  } catch (e) {
    console.error("[logFinanceCsvExport]", e);
  }
}

export async function logBankSyncRequested(
  actorUserId: string,
  integrationId: string,
  provider: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        entityType: "FINANCE",
        entityId: integrationId,
        type: "BANK_SYNC_REQUESTED",
        actorUserId,
        source: "USER",
        data: { provider, ...(extra ?? {}) },
      },
    });
  } catch (e) {
    console.error("[logBankSyncRequested]", e);
  }
}
