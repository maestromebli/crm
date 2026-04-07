import type { Metadata } from "next";
import { requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { P } from "../../../../lib/authz/permissions";
import { prisma } from "../../../../lib/prisma";
import { ownerIdWhere, resolveAccessContext } from "../../../../lib/authz/data-scope";
import { floorStageLabelUa } from "../../../../lib/production/floor";
import { queryProductionLineActiveDeals } from "../../../../lib/production/subpage-queries";
import {
  ProductionSubpageTable,
  type ProductionSubpageRow,
} from "../../../../components/production/ProductionSubpageTable";

export const metadata: Metadata = {
  title: "У виробництві · Виробництво",
};

export default async function ProductionInProgressPage() {
  const session = await requirePermissionForPage(P.PRODUCTION_LAUNCH);
  const access = await resolveAccessContext(prisma, {
    id: session.user.id,
    role: session.user.role,
  });
  const ownerWhere = ownerIdWhere(access);

  const rows = await queryProductionLineActiveDeals(prisma, ownerWhere);
  const tableRows: ProductionSubpageRow[] = rows.map((r) => {
    const st = r.productionFloorState?.stage ?? "WAITING";
    const pr = r.productionFloorState?.progress ?? 0;
    return {
      id: r.id,
      title: r.title,
      client: r.client.name,
      owner: r.owner.name ?? r.owner.email ?? "—",
      extra: `${floorStageLabelUa(String(st))} · ${pr}%`,
    };
  });

  return (
    <main className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--enver-text)]">У виробництві</h1>
        <p className="mt-1 text-sm text-slate-600">
          Запущені на лінії замовлення, які ще не пройшли фінальний етап. Детальний статус — у{" "}
          <a className="text-sky-800 underline" href="/production/ops">
            операційному штабі
          </a>
          .
        </p>
      </header>

      <ProductionSubpageTable
        rows={tableRows}
        emptyText="Немає активних замовлень на лінії."
      />
    </main>
  );
}
