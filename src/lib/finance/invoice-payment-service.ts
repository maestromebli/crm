import { prisma } from "../prisma";
import type { CrmInvoiceStatus, CrmInvoiceType, MoneyTransactionCategory } from "@prisma/client";

export async function createFinanceInvoice(args: {
  dealId: string;
  type: CrmInvoiceType;
  amount: number;
  status?: CrmInvoiceStatus;
  createdById?: string | null;
  documentNumber?: string | null;
  issueDate?: Date | null;
  counterpartyName?: string | null;
  counterpartyEdrpou?: string | null;
  vatRatePercent?: number | null;
  amountWithoutVat?: number | null;
  vatAmount?: number | null;
}) {
  const row = await prisma.invoice.create({
    data: {
      dealId: args.dealId,
      type: args.type,
      amount: args.amount,
      status: args.status ?? "DRAFT",
      documentNumber: args.documentNumber ?? undefined,
      issueDate: args.issueDate ?? undefined,
      counterpartyName: args.counterpartyName ?? undefined,
      counterpartyEdrpou: args.counterpartyEdrpou ?? undefined,
      vatRatePercent: args.vatRatePercent ?? undefined,
      amountWithoutVat: args.amountWithoutVat ?? undefined,
      vatAmount: args.vatAmount ?? undefined,
      createdById: args.createdById ?? undefined,
    },
  });
  if (args.createdById) {
    try {
      await prisma.activityLog.create({
        data: {
          entityType: "FINANCE",
          entityId: row.id,
          type: "FINANCE_INVOICE_CREATED",
          actorUserId: args.createdById,
          source: "USER",
          data: { dealId: args.dealId, amount: args.amount, invoiceType: args.type },
        },
      });
    } catch (e) {
      console.error("[createFinanceInvoice audit]", e);
    }
  }
  return row;
}

export async function updateFinanceInvoiceStatus(args: {
  invoiceId: string;
  dealId: string;
  status: CrmInvoiceStatus;
  actorUserId?: string | null;
}) {
  await prisma.invoice.updateMany({
    where: { id: args.invoiceId, dealId: args.dealId },
    data: { status: args.status },
  });
  if (args.actorUserId) {
    try {
      await prisma.activityLog.create({
        data: {
          entityType: "FINANCE",
          entityId: args.invoiceId,
          type: "FINANCE_INVOICE_UPDATED",
          actorUserId: args.actorUserId,
          source: "USER",
          data: { dealId: args.dealId, status: args.status },
        },
      });
    } catch (e) {
      console.error("[updateFinanceInvoiceStatus audit]", e);
    }
  }
}

/** Записує вхідний платіж як `MoneyTransaction` (INCOME). */
export async function recordIncomingPayment(args: {
  dealId: string;
  amount: number;
  currency?: string;
  paidAt: Date;
  category?: MoneyTransactionCategory;
  description?: string | null;
  createdById: string | null;
}) {
  return prisma.moneyTransaction.create({
    data: {
      dealId: args.dealId,
      type: "INCOME",
      category: args.category ?? "PREPAYMENT",
      amount: args.amount,
      currency: args.currency?.trim() || "UAH",
      status: "PAID",
      paidAt: args.paidAt,
      dueDate: null,
      description: args.description ?? null,
      createdById: args.createdById,
    },
  });
}
