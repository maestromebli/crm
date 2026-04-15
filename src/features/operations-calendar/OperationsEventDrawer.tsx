export type OperationsEvent = {
  id: string;
  title: string;
  date: string;
  type: "MEASUREMENT" | "CONSTRUCTOR" | "PRODUCTION" | "PURCHASE" | "INSTALLATION";
  orderName: string;
};

export function OperationsEventDrawer({ event }: { event: OperationsEvent | null }) {
  if (!event) {
    return (
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Оберіть подію в календарі.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{event.title}</h3>
      <p className="text-xs text-slate-600">{event.orderName}</p>
      <p className="mt-1 text-xs text-slate-500">{event.date} · {event.type}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px]">Відкрити замовлення</button>
        <button className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px]">Перепланувати</button>
        <button className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px]">Позначити виконано</button>
      </div>
    </aside>
  );
}
