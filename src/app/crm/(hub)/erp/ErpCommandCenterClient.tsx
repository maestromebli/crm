"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useErpBridge } from "@/components/erp/ErpBridgeProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ErpCommandCenterClient() {
  const reduceMotion = useReducedMotion();
  const {
    productionOrders,
    purchaseRequests,
    financeDocuments,
    events,
    approvePurchaseRequest,
    approveFinanceDocument,
    markFinanceDocumentPaid,
    setPurchaseRequestStatus,
  } = useErpBridge();

  const kpi = useMemo(() => {
    const ready = productionOrders.filter((x) => x.readinessPct >= 90).length;
    const highRisk = productionOrders.filter((x) => x.riskScore >= 50).length;
    const approvalsPending =
      purchaseRequests.filter((x) => x.status === "NEW").length +
      financeDocuments.filter((x) => x.status === "DRAFT").length;
    const financeVolume = financeDocuments.reduce((sum, x) => sum + x.amount, 0);
    return { ready, highRisk, approvalsPending, financeVolume };
  }, [productionOrders, purchaseRequests, financeDocuments]);

  return (
    <main className="space-y-5 p-4">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 text-slate-100 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">ENVER · SaaS ERP · Командний центр</p>
        <h1 className="mt-2 text-2xl font-semibold">Глобальний командний центр ERP</h1>
        <p className="mt-1 text-sm text-slate-300">
          Наскрізний контроль виробництва, закупівель і фінансів із централізованим ланцюжком погоджень.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Замовлень у контурі"
            value={`${productionOrders.length}`}
            hint="Активні виробничі замовлення в ERP-мості"
          />
          <KpiTile
            label="Готові до запуску"
            value={`${kpi.ready}`}
            hint="Замовлення з готовністю ≥90%"
          />
          <KpiTile
            label="Очікують погодження"
            value={`${kpi.approvalsPending}`}
            hint="Нові заявки закупівлі + чернетки фіндокументів"
          />
          <KpiTile
            label="Фінобсяг контурів"
            value={`${formatMoney(kpi.financeVolume)} ₴`}
            hint="Сума сумарно по документах у мості"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Центр погоджень</h2>

          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Закупівельні заявки
          </h3>
          <div className="mt-2 space-y-2">
            {purchaseRequests.map((request) => (
              <motion.article
                key={request.id}
                layout={false}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm transition-shadow hover:shadow-md"
                whileHover={reduceMotion ? undefined : { y: -1 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {request.productionOrder} · {request.materialCode}
                    </p>
                    <p className="text-xs text-slate-600">
                      {request.qty} од. · {request.priority} · строк {request.requiredDate || "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      статус: {request.status}
                      {request.approvedBy ? ` · погодив ${request.approvedBy}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {request.status === "NEW" ? (
                      <ActionButton onClick={() => approvePurchaseRequest(request.id, "ERP Manager")}>
                        Погодити
                      </ActionButton>
                    ) : null}
                    {request.status !== "DONE" ? (
                      <ActionButton onClick={() => setPurchaseRequestStatus(request.id, "DONE", "ERP Manager")}>
                        Готово
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              </motion.article>
            ))}
            {purchaseRequests.length === 0 ? (
              <p className="text-xs text-slate-500">Немає заявок у глобальному контурі.</p>
            ) : null}
          </div>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Фіндокументи</h3>
          <div className="mt-2 space-y-2">
            {financeDocuments.map((doc) => (
              <motion.article
                key={doc.id}
                layout={false}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm transition-shadow hover:shadow-md"
                whileHover={reduceMotion ? undefined : { y: -1 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {doc.kind} · {doc.direction} · {formatMoney(doc.amount)} ₴
                    </p>
                    <p className="text-xs text-slate-600">
                      {doc.entity} · {doc.productionOrder || "без замовлення"}
                    </p>
                    <p className="text-xs text-slate-500">
                      статус: {doc.status}
                      {doc.approvedBy ? ` · погодив ${doc.approvedBy}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {doc.status === "DRAFT" ? (
                      <ActionButton onClick={() => approveFinanceDocument(doc.id, "CFO")}>Погодити</ActionButton>
                    ) : null}
                    {doc.status === "APPROVED" ? (
                      <ActionButton onClick={() => markFinanceDocumentPaid(doc.id, "Treasury")}>Позначити оплаченим</ActionButton>
                    ) : null}
                  </div>
                </div>
              </motion.article>
            ))}
            {financeDocuments.length === 0 ? (
              <p className="text-xs text-slate-500">Немає фіндокументів у глобальному контурі.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Стрічка ERP</h2>
            <ul className="mt-3 space-y-2 text-xs">
              {events.map((event) => (
                <li key={event.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="font-medium text-slate-800">
                    [{event.module}] {event.type}
                  </p>
                  <p className="text-slate-600">{event.message}</p>
                  <p className="text-slate-500">
                    {new Date(event.createdAt).toLocaleString("uk-UA")}
                    {event.actor ? ` · ${event.actor}` : ""}
                  </p>
                </li>
              ))}
              {events.length === 0 ? <li className="text-slate-500">Події з&apos;являться після дій у модулях.</li> : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Радар ризиків</h2>
            <div className="mt-2 space-y-2">
              <Bar label="Замовлення з високим ризиком" value={kpi.highRisk} max={Math.max(1, productionOrders.length)} />
              <Bar
                label="Очікують погодження"
                value={kpi.approvalsPending}
                max={Math.max(1, purchaseRequests.length + financeDocuments.length)}
              />
            </div>
          </section>

          <section className="grid gap-2">
            <QuickLink href="/crm/production" title="Штаб виробництва" subtitle="операції та статуси замовлень" />
          </section>
        </div>
      </section>
    </main>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.article
          className="cursor-default rounded-xl border border-slate-700 bg-slate-900/70 p-3"
          whileHover={reduceMotion ? undefined : { y: -2, transition: { duration: 0.2 } }}
        >
          <p className="border-b border-dotted border-slate-500 text-xs text-slate-300">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">{value}</p>
        </motion.article>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[18rem]">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

function ActionButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(2, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        />
      </div>
    </div>
  );
}

function QuickLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          whileHover={reduceMotion ? undefined : { y: -2, transition: { duration: 0.2 } }}
          whileTap={reduceMotion ? undefined : { scale: 0.99 }}
        >
          <Link
            href={href}
            className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-cyan-400 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </Link>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[20rem]">
        {subtitle}
      </TooltipContent>
    </Tooltip>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
}
