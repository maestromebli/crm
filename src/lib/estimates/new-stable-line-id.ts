import { randomUUID } from "node:crypto";

/** У БД `EstimateLineItem.stableLineId` NOT NULL — завжди задаємо при створенні рядка. */
export function newEstimateStableLineId(): string {
  return randomUUID();
}
