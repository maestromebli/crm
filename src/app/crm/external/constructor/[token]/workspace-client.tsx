"use client";

import type { ConstructorRoomStatus } from "@prisma/client";

type Snapshot = {
  productionNumber: string;
  dealTitle: string;
  clientName: string;
  status: ConstructorRoomStatus;
  dueDate: string | null;
  constructorExternalName: string | null;
};

/**
 * Ізольований робочий простір зовнішнього конструктора (без доступу до решти CRM).
 * Дані розширюються в наступних фазах (файли, чекліст, завантаження пакету).
 */
export function ExternalConstructorWorkspace({
  token: _token,
  snapshot,
}: {
  token: string;
  snapshot: Snapshot;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              ENVER · зовнішній конструктор
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {snapshot.productionNumber}
            </h1>
            <p className="text-sm text-slate-600">
              {snapshot.clientName} · {snapshot.dealTitle}
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-slate-500">Статус: </span>
              <span className="font-medium">{snapshot.status}</span>
            </div>
            {snapshot.dueDate ? (
              <p className="mt-1 text-xs text-slate-500">
                Дедлайн: {new Date(snapshot.dueDate).toLocaleString("uk-UA")}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">Проєкт</h2>
          <p className="mt-2 text-sm text-slate-600">
            Це захищений доступ лише до цього замовлення. Повний модуль (файли, чекліст,
            завантаження креслень, питання) підключається поетапно.
          </p>
          {snapshot.constructorExternalName ? (
            <p className="mt-3 text-sm">
              <span className="text-slate-500">Виконавець: </span>
              {snapshot.constructorExternalName}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
