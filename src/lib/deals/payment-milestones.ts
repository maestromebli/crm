import type { Prisma, PrismaClient } from "@prisma/client";

import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";

type Tx = Prisma.TransactionClient | PrismaClient;

export type PaymentPlanStepJson = {
  percent: number;
  amount: number;
  label: string;
  status: "PENDING" | "PAID" | "OVERDUE";
  dueDate?: string | null;
  paidAt?: string | null;
};

/**
 * Створює або оновлює план 70/30 у `DealPaymentPlan` і повертає фрагмент `meta.payment` для workspaceMeta.
 */
export async function seedDealPaymentPlan7030(
  tx: Tx,
  args: {
    dealId: string;
    total: number;
    currency: string;
  },
): Promise<NonNullable<DealWorkspaceMeta["payment"]>> {
  const { dealId, total, currency: _currency } = args;
  const m70 = Math.round(total * 0.7 * 100) / 100;
  const m30 = Math.round((total - m70) * 100) / 100;
  const steps: PaymentPlanStepJson[] = [
    {
      percent: 70,
      amount: m70,
      label: "Аванс (70%)",
      status: "PENDING",
      dueDate: null,
      paidAt: null,
    },
    {
      percent: 30,
      amount: m30,
      label: "Решта (30%)",
      status: "PENDING",
      dueDate: null,
      paidAt: null,
    },
  ];

  await tx.dealPaymentPlan.upsert({
    where: { dealId },
    create: {
      dealId,
      stepsJson: steps,
      reasonIfChanged: null,
    },
    update: {
      stepsJson: steps,
      reasonIfChanged: null,
    },
  });

  return {
    milestones: [
      {
        id: "pp-0",
        label: steps[0].label,
        amount: steps[0].amount,
        currency: _currency,
        done: false,
      },
      {
        id: "pp-1",
        label: steps[1].label,
        amount: steps[1].amount,
        currency: _currency,
        done: false,
      },
    ],
  };
}
