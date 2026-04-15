import { DrawingApprovalChecklist } from "./DrawingApprovalChecklist";
import { ProductionFileReviewPanel } from "./ProductionFileReviewPanel";
import { ProductionApprovalActions } from "./ProductionApprovalActions";
import { OperationsAIWidget } from "@/features/operations-ai/OperationsAIWidget";
import type { ProductionOrderOpsState } from "./types/operations-core";

export function ProductionApprovalPage({
  order,
  files,
}: {
  order: ProductionOrderOpsState;
  files: Array<{ id: string; name: string; fileType?: string }>;
}) {
  const checklist = [
    { id: "all-products", label: "Всі вироби покриті кресленнями", done: order.approvedFilesExist },
    { id: "dimensions", label: "Розміри заповнені", done: order.measurementCompleted },
    { id: "materials", label: "Матеріали відповідають розрахунку", done: order.approvedCalculationExists },
    { id: "fittings", label: "Фурнітура узгоджена", done: order.commentsResolved },
    { id: "textures", label: "Кромка / колір / текстура вказані", done: order.approvedFilesExist },
    { id: "mounting", label: "Є монтажні примітки", done: true },
    { id: "risks", label: "Спецризики описані", done: order.blockers.length === 0 },
    { id: "dependencies", label: "Залежності монтажу зрозумілі", done: !!order.plannedInstallationAt },
  ];

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Production Approval</h1>
        <p className="text-sm text-slate-600">Фінальна перевірка перед split у закупівлю та цех.</p>
      </header>
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <ProductionFileReviewPanel files={files} />
          <DrawingApprovalChecklist items={checklist} />
          <ProductionApprovalActions />
        </div>
        <OperationsAIWidget order={order} />
      </div>
    </div>
  );
}
