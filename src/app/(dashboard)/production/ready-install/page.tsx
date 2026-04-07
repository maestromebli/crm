import type { Metadata } from "next";
import { requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { P } from "../../../../lib/authz/permissions";
import { prisma } from "../../../../lib/prisma";
import { ownerIdWhere, resolveAccessContext } from "../../../../lib/authz/data-scope";
import { queryProductionReadyInstallDeals } from "../../../../lib/production/subpage-queries";
import {
  ProductionSubpageTable,
  type ProductionSubpageRow,
} from "../../../../components/production/ProductionSubpageTable";

export const metadata: Metadata = {
  title: "Готові до монтажу · Виробництво",
};

export default async function ProductionReadyInstallPage() {
  const session = await requirePermissionForPage(P.PRODUCTION_LAUNCH);
  const access = await resolveAccessContext(prisma, {
    id: session.user.id,
    role: session.user.role,
  });
  const ownerWhere = ownerIdWhere(access);

  const rows = await queryProductionReadyInstallDeals(prisma, ownerWhere);
  const tableRows: ProductionSubpageRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    client: r.client.name,
    owner: r.owner.name ?? r.owner.email ?? "—",
    extra: r.installationDate
      ? `Монтаж: ${new Date(r.installationDate).toLocaleString("uk-UA")}`
      : "Дата монтажу не призначена",
  }));

  return (
    <main className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--enver-text)]">Готові до монтажу</h1>
        <p className="mt-1 text-sm text-slate-600">
          Лінія цеху завершена по замовленню; далі — логістика та монтаж.
        </p>
      </header>

      <ProductionSubpageTable
        rows={tableRows}
        emptyText="Немає угод у статусі «лінія завершена»."
      />
    </main>
  );
}
