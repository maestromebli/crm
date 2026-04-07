import { prisma } from "../prisma";
import type { CrmInvoiceStatus, CrmInvoiceType, MoneyTransactionCategory } from "@prisma/client";

export async function createFinanceInvoice(args: {
  dealId: string;
  type: CrmInvoiceType;
  amount: number;
  status?: CrmInvoiceStatus;
}) {
  return prisma.invoice.create({
    data: {
      dealId: args.dealId,
      type: args.type,
      amount: args.amount,
      status: args.status ?? "DRAFT",
    },
  });
}

export async function updateFinanceInvoiceStatus(args: {
  invoiceId: string;
  dealId: string;
  status: CrmInvoiceStatus;
}) {
  await prisma.invoice.updateMany({
    where: { id: args.invoiceId, dealId: args.dealId },
    data: { status: args.status },
  });
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
