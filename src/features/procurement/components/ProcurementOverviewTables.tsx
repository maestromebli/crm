"use client";

import { useMemo } from "react";
import { SectionCard } from "../../../components/shared/SectionCard";
import { useProcurementOverviewUrlState } from "../hooks/useProcurementOverviewUrlState";
import type { GoodsReceipt } from "../types/models";
import type { ProcurementRequest } from "../types/models";
import type { ProcurementItem } from "../types/models";
import type { PurchaseOrder } from "../types/models";
import type { Supplier } from "../types/models";
import { ProcurementFiltersBar } from "./ProcurementFiltersBar";
import { ProcurementItemsTable } from "./ProcurementItemsTable";
import { ProcurementRequestsTable } from "./ProcurementRequestsTable";
import { PurchaseOrdersTable } from "./PurchaseOrdersTable";
import { SuppliersTable } from "./SuppliersTable";
import { GoodsReceiptsTable } from "./GoodsReceiptsTable";

type ProjectOption = { id: string; label: string };

type Props = {
  requests: ProcurementRequest[];
  items: ProcurementItem[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  receipts: GoodsReceipt[];
  projectNameById: Record<string, string>;
  supplierNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  orderNumberById: Record<string, string>;
  neededByDateByRequestId: Record<string, string | null>;
  projectOptions: ProjectOption[];
};

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

export function ProcurementOverviewTables({
  requests,
  items,
  purchaseOrders,
  suppliers,
  receipts,
  projectNameById,
  supplierNameById,
  categoryNameById,
  orderNumberById,
  neededByDateByRequestId,
  projectOptions,
}: Props) {
  const {
    query,
    setQuery,
    projectId,
    setProjectId,
    itemStatus,
    setItemStatus,
    requestStatus,
    setRequestStatus,
    clearAll,
    hasActiveFilters,
  } = useProcurementOverviewUrlState();

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (projectId && r.projectId !== projectId) return false;
      if (requestStatus && r.status !== requestStatus) return false;
      if (!query.trim()) return true;
      const q = norm(query);
      const pname = norm(projectNameById[r.projectId]);
      return (
        pname.includes(q) ||
        norm(r.comment).includes(q) ||
        norm(r.status).includes(q) ||
        String(r.budgetTotal).includes(q) ||
        String(r.actualTotal).includes(q)
      );
    });
  }, [requests, projectId, requestStatus, query, projectNameById]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (projectId && i.projectId !== projectId) return false;
      if (itemStatus && i.status !== itemStatus) return false;
      if (!query.trim()) return true;
      const q = norm(query);
      const pname = norm(projectNameById[i.projectId]);
      const cat = norm(categoryNameById[i.categoryId]);
      const sup =
        i.supplierId && supplierNameById[i.supplierId] ? norm(supplierNameById[i.supplierId]) : "";
      return (
        pname.includes(q) ||
        cat.includes(q) ||
        norm(i.name).includes(q) ||
        norm(i.article).includes(q) ||
        sup.includes(q) ||
        norm(i.comment).includes(q)
      );
    });
  }, [items, projectId, itemStatus, query, projectNameById, categoryNameById, supplierNameById]);

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((o) => {
      if (projectId && o.projectId !== projectId) return false;
      if (!query.trim()) return true;
      const q = norm(query);
      const pname = norm(projectNameById[o.projectId]);
      const sup = norm(supplierNameById[o.supplierId]);
      return (
        pname.includes(q) ||
        sup.includes(q) ||
        norm(o.orderNumber).includes(q) ||
        norm(o.comment).includes(q) ||
        norm(o.status).includes(q) ||
        String(o.totalAmount).includes(q)
      );
    });
  }, [purchaseOrders, projectId, query, projectNameById, supplierNameById]);

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (projectId && r.projectId !== projectId) return false;
      if (!query.trim()) return true;
      const q = norm(query);
      const pname = norm(projectNameById[r.projectId]);
      const onum = norm(orderNumberById[r.purchaseOrderId] ?? "");
      return pname.includes(q) || onum.includes(q) || norm(r.comment).includes(q);
    });
  }, [receipts, projectId, query, projectNameById, orderNumberById]);

  const filteredSuppliers = useMemo(() => {
    if (!query.trim()) return suppliers;
    const q = norm(query);
    return suppliers.filter(
      (s) =>
        norm(s.name).includes(q) ||
        norm(s.contactPerson).includes(q) ||
        norm(s.email).includes(q) ||
        norm(s.phone).includes(q),
    );
  }, [suppliers, query]);

  return (
    <>
      <ProcurementFiltersBar
        query={query}
        onQuery={setQuery}
        projectId={projectId}
        onProjectId={setProjectId}
        projectOptions={projectOptions}
        itemStatus={itemStatus}
        onItemStatus={setItemStatus}
        requestStatus={requestStatus}
        onRequestStatus={setRequestStatus}
        onClear={clearAll}
        hasActiveFilters={hasActiveFilters}
      />
      <div className="space-y-4">
        <SectionCard id="proc-section-requests" title="Заявки" subtitle="Статус і бюджет">
          <ProcurementRequestsTable rows={filteredRequests} projectNameById={projectNameById} />
          <p className="mt-2 text-[11px] text-slate-500">
            Показано {filteredRequests.length} з {requests.length}
          </p>
        </SectionCard>
        <SectionCard id="proc-section-items" title="Позиції" subtitle="План / факт · дата з заявки">
          <ProcurementItemsTable
            rows={filteredItems}
            projectNameById={projectNameById}
            categoryNameById={categoryNameById}
            supplierNameById={supplierNameById}
            neededByDateByRequestId={neededByDateByRequestId}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            Показано {filteredItems.length} з {items.length}
          </p>
        </SectionCard>
        <SectionCard id="proc-section-orders" title="Замовлення постачальникам">
          <PurchaseOrdersTable
            rows={filteredOrders}
            supplierNameById={supplierNameById}
            projectNameById={projectNameById}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            Показано {filteredOrders.length} з {purchaseOrders.length}
          </p>
        </SectionCard>
        <SectionCard id="proc-section-suppliers" title="Постачальники">
          <SuppliersTable rows={filteredSuppliers} />
          <p className="mt-2 text-[11px] text-slate-500">
            Показано {filteredSuppliers.length} з {suppliers.length}
            {query.trim() ? " (пошук по довіднику)" : ""}
          </p>
        </SectionCard>
        <SectionCard id="proc-section-receipts" title="Поставки">
          <GoodsReceiptsTable
            rows={filteredReceipts}
            orderNumberById={orderNumberById}
            projectNameById={projectNameById}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            Показано {filteredReceipts.length} з {receipts.length}
          </p>
        </SectionCard>
      </div>
    </>
  );
}
