import type { Metadata } from "next";
import { requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { P } from "../../../../lib/authz/permissions";
import { prisma } from "../../../../lib/prisma";
import { ownerIdWhere, resolveAccessContext } from "../../../../lib/authz/data-scope";
import { floorStageLabelUa } from "../../../../lib/production/floor";
import {
  queryProductionHandoffDelays,
  queryProductionStageStuckDeals,
} from "../../../../lib/production/subpage-queries";
import {
  ProductionSubpageTable,
  type ProductionSubpageRow,
} from "../../../../components/production/ProductionSubpageTable";

export const metadata: Metadata = {
  title: "Затримки та блокери · Виробництво",
};

export default async function ProductionDelaysPage() {
  const session = await requirePermissionForPage(P.PRODUCTION_LAUNCH);
  const access = await resolveAccessContext(prisma, {
    id: session.user.id,
    role: session.user.role,
  });
  const ownerWhere = ownerIdWhere(access);

  const [handoffDelays, stageStuck] = await Promise.all([
    queryProductionHandoffDelays(prisma, ownerWhere),
    queryProductionStageStuckDeals(prisma, ownerWhere),
  ]);

  const handoffRows: ProductionSubpageRow[] = handoffDelays.map((r) => ({
    id: r.id,
    title: r.title,
    client: r.client.name,
    owner: r.owner.name ?? r.owner.email ?? "—",
    extra: r.handoff?.submittedAt
      ? `Передано ${new Date(r.handoff.submittedAt).toLocaleString("uk-UA")} (>24h)`
      : "—",
  }));

  const stageRows: ProductionSubpageRow[] = stageStuck.map((r) => {
    const fs = r.productionFloorState;
    const started = fs?.stageStartedAt
      ? new Date(fs.stageStartedAt).toLocaleString("uk-UA")
      : "—";
    return {
      id: r.id,
      title: r.title,
      client: r.client.name,
      owner: r.owner.name ?? r.owner.email ?? "—",
      extra: fs
        ? `${floorStageLabelUa(String(fs.stage))} · з ${started} (>48h) · ${fs.progress ?? 0}%`
        : "—",
    };
  });

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--enver-text)]">Затримки / блокери</h1>
        <p className="mt-1 text-sm text-slate-600">
          Передача без прийняття понад 24 год або довге перебування на одному етапі лінії понад 48 год.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Очікують прийняття (handoff)</h2>
        <ProductionSubpageTable
          rows={handoffRows}
          emptyText="Немає прострочених передач."
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Завислі на етапі лінії</h2>
        <ProductionSubpageTable
          rows={stageRows}
          emptyText="Немає замовлень з довгим етапом."
        />
      </section>
    </main>
  );
}
