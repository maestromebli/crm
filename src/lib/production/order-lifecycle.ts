import type { PrismaClient } from "@prisma/client";

/** Legacy: замовлення зняті на користь `ProductionFlow`. */
export async function ensureOrderStarted(
  _prisma: PrismaClient,
  _orderId: string,
): Promise<void> {}

export async function setOrderStatus(
  _prisma: PrismaClient,
  _orderId: string,
  _status: string,
): Promise<void> {}
