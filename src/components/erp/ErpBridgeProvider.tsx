"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { putJson } from "@/lib/api/patch-json";
import {
  ERP_BRIDGE_INITIAL_STATE,
  type ErpEvent,
  type ErpFinanceDocument,
  type ErpProductionOrder,
  type ErpPurchaseRequest,
  type ErpState,
} from "@/lib/erp/types";

type ErpContextValue = ErpState & {
  syncProductionOrders: (orders: ErpProductionOrder[]) => void;
  addPurchaseRequest: (request: Omit<ErpPurchaseRequest, "id" | "status" | "approvedBy">) => void;
  addFinanceDocument: (doc: Omit<ErpFinanceDocument, "id" | "status" | "approvedBy">) => void;
  addEvent: (input: Omit<ErpEvent, "id" | "createdAt">) => void;
  bumpProductionTasks: (orderNumber: string, delta: { procurement?: number; production?: number }) => void;
  approvePurchaseRequest: (requestId: string, actor: string) => void;
  setPurchaseRequestStatus: (requestId: string, status: ErpPurchaseRequest["status"], actor: string) => void;
  approveFinanceDocument: (docId: string, actor: string) => void;
  markFinanceDocumentPaid: (docId: string, actor: string) => void;
};

const STORAGE_KEY = "enver.erp.bridge.v1";

const ErpBridgeContext = createContext<ErpContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}

function areProductionOrdersEqual(a: ErpProductionOrder[], b: ErpProductionOrder[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.number !== right.number ||
      left.client !== right.client ||
      left.product !== right.product ||
      left.status !== right.status ||
      left.readinessPct !== right.readinessPct ||
      left.riskScore !== right.riskScore ||
      left.procurementTasks !== right.procurementTasks ||
      left.productionTasks !== right.productionTasks
    ) {
      return false;
    }
  }
  return true;
}

export function ErpBridgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ErpState>(ERP_BRIDGE_INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/crm/erp/bridge", { cache: "no-store" });
        if (!response.ok) throw new Error("Не вдалося завантажити ERP-міст");
        const payload = (await response.json()) as ErpState;
        if (cancelled) return;
        setState({
          productionOrders: payload.productionOrders ?? [],
          purchaseRequests: payload.purchaseRequests ?? [],
          financeDocuments: payload.financeDocuments ?? [],
          events: payload.events ?? [],
        });
      } catch {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (!raw) {
            setState(ERP_BRIDGE_INITIAL_STATE);
            return;
          }
          const parsed = JSON.parse(raw) as ErpState;
          if (cancelled) return;
          setState({
            productionOrders: parsed.productionOrders ?? [],
            purchaseRequests: parsed.purchaseRequests ?? [],
            financeDocuments: parsed.financeDocuments ?? [],
            events: parsed.events ?? [],
          });
        } catch {
          if (cancelled) return;
          setState(ERP_BRIDGE_INITIAL_STATE);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const timer = window.setTimeout(() => {
      void putJson<Record<string, unknown>>("/api/crm/erp/bridge", state).catch(() => {
        // Тихий fallback до localStorage, коли API недоступне.
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [state, hydrated]);

  const value = useMemo<ErpContextValue>(() => {
    function addEvent(input: Omit<ErpEvent, "id" | "createdAt">) {
      setState((prev) => ({
        ...prev,
        events: [
          { id: makeId("evt"), createdAt: new Date().toISOString(), ...input },
          ...prev.events,
        ].slice(0, 200),
      }));
    }

    function syncProductionOrders(orders: ErpProductionOrder[]) {
      setState((prev) => {
        if (areProductionOrdersEqual(prev.productionOrders, orders)) {
          return prev;
        }
        return { ...prev, productionOrders: orders };
      });
    }

    function addPurchaseRequest(request: Omit<ErpPurchaseRequest, "id" | "status" | "approvedBy">) {
      setState((prev) => ({
        ...prev,
        purchaseRequests: [
          { id: makeId("prq"), status: "NEW" as const, approvedBy: null, ...request },
          ...prev.purchaseRequests,
        ].slice(0, 200),
      }));
    }

    function addFinanceDocument(doc: Omit<ErpFinanceDocument, "id" | "status" | "approvedBy">) {
      setState((prev) => ({
        ...prev,
        financeDocuments: [
          { id: makeId("fdc"), status: "DRAFT" as const, approvedBy: null, ...doc },
          ...prev.financeDocuments,
        ].slice(0, 200),
      }));
    }

    function bumpProductionTasks(orderNumber: string, delta: { procurement?: number; production?: number }) {
      setState((prev) => ({
        ...prev,
        productionOrders: prev.productionOrders.map((order) =>
          order.number === orderNumber
            ? {
                ...order,
                procurementTasks: order.procurementTasks + (delta.procurement ?? 0),
                productionTasks: order.productionTasks + (delta.production ?? 0),
              }
            : order,
        ),
      }));
    }

    function setPurchaseRequestStatus(
      requestId: string,
      status: ErpPurchaseRequest["status"],
      actor: string,
    ) {
      setState((prev) => ({
        ...prev,
        purchaseRequests: prev.purchaseRequests.map((request) =>
          request.id === requestId ? { ...request, status } : request,
        ),
      }));
      addEvent({
        module: "procurement",
        type: "PURCHASE_REQUEST_STATUS",
        message: `Статус заявки ${requestId}: ${status}`,
        actor,
      });
    }

    function approvePurchaseRequest(requestId: string, actor: string) {
      setState((prev) => ({
        ...prev,
        purchaseRequests: prev.purchaseRequests.map((request) =>
          request.id === requestId ? { ...request, status: "IN_PROGRESS", approvedBy: actor } : request,
        ),
      }));
      addEvent({
        module: "procurement",
        type: "PURCHASE_REQUEST_APPROVED",
        message: `Заявка ${requestId} погоджена`,
        actor,
      });
    }

    function approveFinanceDocument(docId: string, actor: string) {
      setState((prev) => ({
        ...prev,
        financeDocuments: prev.financeDocuments.map((doc) =>
          doc.id === docId ? { ...doc, status: "APPROVED", approvedBy: actor } : doc,
        ),
      }));
      addEvent({
        module: "finance",
        type: "FINANCE_DOC_APPROVED",
        message: `Фіндокумент ${docId} погоджено`,
        actor,
      });
    }

    function markFinanceDocumentPaid(docId: string, actor: string) {
      setState((prev) => ({
        ...prev,
        financeDocuments: prev.financeDocuments.map((doc) =>
          doc.id === docId ? { ...doc, status: "PAID", approvedBy: doc.approvedBy ?? actor } : doc,
        ),
      }));
      addEvent({
        module: "finance",
        type: "FINANCE_DOC_PAID",
        message: `Фіндокумент ${docId} відмічено як PAID`,
        actor,
      });
    }

    return {
      ...state,
      syncProductionOrders,
      addPurchaseRequest,
      addFinanceDocument,
      addEvent,
      bumpProductionTasks,
      approvePurchaseRequest,
      setPurchaseRequestStatus,
      approveFinanceDocument,
      markFinanceDocumentPaid,
    };
  }, [state]);

  return <ErpBridgeContext.Provider value={value}>{children}</ErpBridgeContext.Provider>;
}

export function useErpBridge() {
  const ctx = useContext(ErpBridgeContext);
  if (!ctx) {
    throw new Error("useErpBridge можна використовувати лише всередині ErpBridgeProvider");
  }
  return ctx;
}
