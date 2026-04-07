import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { ERP_BRIDGE_INITIAL_STATE } from "@/lib/erp/types";
import {
  readErpBridgeState,
  writeErpBridgeState,
} from "@/lib/erp/bridge";
import type { ErpState } from "@/lib/erp/types";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  try {
    const state = await readErpBridgeState();
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка ERP bridge";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  try {
    const body = (await req.json()) as Partial<ErpState>;
    const prev = await readErpBridgeState();

    // Keep existing audit trail immutable: preserve previous events
    // and append only newly seen IDs from client payload.
    const nextEventsMap = new Map(prev.events.map((event) => [event.id, event]));
    for (const event of body.events ?? []) {
      if (!event?.id || nextEventsMap.has(event.id)) continue;
      nextEventsMap.set(event.id, event);
    }
    const mergedEvents = [...nextEventsMap.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500);

    const payload: ErpState = {
      productionOrders: body.productionOrders ?? [],
      purchaseRequests: body.purchaseRequests ?? [],
      financeDocuments: body.financeDocuments ?? [],
      events: mergedEvents,
    };
    await writeErpBridgeState(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка ERP bridge";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  try {
    await writeErpBridgeState(ERP_BRIDGE_INITIAL_STATE);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка ERP bridge";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
