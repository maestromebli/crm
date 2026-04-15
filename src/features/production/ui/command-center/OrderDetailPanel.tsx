import type { ProductionOrderViewModel } from "./models";
import { ReplanImpactHint } from "./ReplanImpactHint";

type ReplanImpact = {
  affectedOrdersCount: number;
  workshopImpact: string;
  deadlineConflicts: number;
  overloadDelta: number;
  recommended: boolean;
  risky: boolean;
};

export function OrderDetailPanel({
  order,
  targetSlot,
  maxSlot,
  onTargetSlotChange,
  replanImpact,
}: {
  order: ProductionOrderViewModel | null;
  targetSlot: number;
  maxSlot: number;
  onTargetSlotChange: (value: number) => void;
  replanImpact: ReplanImpact | null;
}) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Деталі замовлення / панель впливу</h3>
      {!order ? (
        <p className="mt-3 text-xs text-slate-500">Оберіть замовлення у робочому просторі планування.</p>
      ) : (
        <div className="mt-3 space-y-3 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <p className="font-semibold text-slate-900">{order.order.number}</p>
            <p className="text-slate-700">{order.order.clientName}</p>
            <p className="text-slate-600">{order.order.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Дедлайн" value={order.deadlineRisk} />
            <Metric label="Операційний стан" value={order.operationalState.key} />
            <Metric label="Запланований слот" value={`${order.plannedStart} -> ${order.plannedFinish}`} />
            <Metric label="Вплив на цех" value={order.workshopAssignment} />
            <Metric label="Залежність / блокер" value={order.dependency} />
            <Metric label="Причина пріоритету" value={order.priorityReason.label} />
          </div>
          <label className="block text-[11px] text-slate-600">
            Цільовий слот перепланування: {targetSlot}
            <input
              type="range"
              min={1}
              max={Math.max(1, maxSlot)}
              value={targetSlot}
              onChange={(e) => onTargetSlotChange(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <ReplanImpactHint impact={replanImpact} />
        </div>
      )}
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium text-slate-900">{value}</p>
    </div>
  );
}
