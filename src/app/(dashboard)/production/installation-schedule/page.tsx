import type { Metadata } from "next";
import { requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { P } from "../../../../lib/authz/permissions";
import { prisma } from "../../../../lib/prisma";
import { ownerIdWhere, resolveAccessContext } from "../../../../lib/authz/data-scope";
import { floorStageShortUa } from "../../../../lib/production/floor";
import { queryProductionInstallScheduleDeals } from "../../../../lib/production/subpage-queries";
import {
  ProductionSubpageTable,
  type ProductionSubpageRow,
} from "../../../../components/production/ProductionSubpageTable";

export const metadata: Metadata = {
  title: "Графік монтажів · Виробництво",
};

export default async function ProductionInstallationSchedulePage() {
  const session = await requirePermissionForPage(P.PRODUCTION_LAUNCH);
  const access = await resolveAccessContext(prisma, {
    id: session.user.id,
    role: session.user.role,
  });
  const ownerWhere = ownerIdWhere(access);

  const rows = await queryProductionInstallScheduleDeals(prisma, ownerWhere);
  const tableRows: ProductionSubpageRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    client: r.client.name,
    owner: r.owner.name ?? r.owner.email ?? "—",
    extra: [
      r.installationDate
        ? new Date(r.installationDate).toLocaleString("uk-UA")
        : "—",
      r.productionFlow?.currentStepKey
        ? floorStageShortUa(r.productionFlow.currentStepKey)
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <main className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--enver-text)]">Графік монтажів</h1>
        <p className="mt-1 text-sm text-slate-600">
          Замовлення з призначеною датою монтажу (від найближчої).
        </p>
      </header>

      <ProductionSubpageTable
        rows={tableRows}
        emptyText="Немає запланованих монтажів."
      />
    </main>
  );
}
