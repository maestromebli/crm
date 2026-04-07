import type { Metadata } from "next";
import { requirePermissionForPage } from "../../../../lib/authz/page-auth";
import { P } from "../../../../lib/authz/permissions";
import { prisma } from "../../../../lib/prisma";
import { ownerIdWhere, resolveAccessContext } from "../../../../lib/authz/data-scope";
import { queryProductionDesignDeals } from "../../../../lib/production/subpage-queries";
import {
  ProductionSubpageTable,
  type ProductionSubpageRow,
} from "../../../../components/production/ProductionSubpageTable";

export const metadata: Metadata = {
  title: "Підготовка проєкту · Виробництво",
};

export default async function ProductionDesignPage() {
  const session = await requirePermissionForPage(P.PRODUCTION_LAUNCH);
  const access = await resolveAccessContext(prisma, {
    id: session.user.id,
    role: session.user.role,
  });
  const ownerWhere = ownerIdWhere(access);

  const rows = await queryProductionDesignDeals(prisma, ownerWhere);
  const tableRows: ProductionSubpageRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    client: r.client.name,
    owner: r.owner.name ?? r.owner.email ?? "—",
    extra: r.constructorRoom
      ? `Конструктор: ${r.constructorRoom.status}${
          r.constructorRoom.dueAt
            ? ` · до ${new Date(r.constructorRoom.dueAt).toLocaleDateString("uk-UA")}`
            : ""
        }`
      : `Виробництво: ${r.productionFlow?.status ?? "немає"}`,
  }));

  return (
    <main className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--enver-text)]">Підготовка проєкту</h1>
        <p className="mt-1 text-sm text-slate-600">
          Угоди прийняті у виробництво, але лінія ще не запущена: креслення, кімната конструктора,
          погодження перед порізкою.
        </p>
      </header>

      <ProductionSubpageTable
        rows={tableRows}
        emptyText="Немає угод у стадії підготовки за вашим фільтром доступу."
      />
    </main>
  );
}
