import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ERP_BRIDGE_INITIAL_STATE,
  type ErpState,
} from "@/lib/erp/types";

const SETTINGS_ID = "erp-bridge";

export async function readErpBridgeState(): Promise<ErpState> {
  try {
    const row = await prisma.systemSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: { communicationsJson: true },
    });
    const raw = row?.communicationsJson;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ERP_BRIDGE_INITIAL_STATE;
    const parsed = raw as Prisma.JsonObject as Partial<ErpState>;
    return {
      productionOrders: parsed.productionOrders ?? [],
      purchaseRequests: parsed.purchaseRequests ?? [],
      financeDocuments: parsed.financeDocuments ?? [],
      events: parsed.events ?? [],
    };
  } catch {
    return ERP_BRIDGE_INITIAL_STATE;
  }
}

export async function writeErpBridgeState(state: ErpState): Promise<void> {
  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      communicationsJson: state as unknown as Prisma.JsonObject,
      updatedById: null,
    },
    create: {
      id: SETTINGS_ID,
      communicationsJson: state as unknown as Prisma.JsonObject,
      updatedById: null,
    },
  });
}
