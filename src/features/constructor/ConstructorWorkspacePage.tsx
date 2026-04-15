import type { ProductionOrderOpsState } from "@/features/production/types/operations-core";
import { ConstructorSummaryPanel } from "./ConstructorSummaryPanel";
import { ConstructorFilesPanel, type ConstructorFile } from "./ConstructorFilesPanel";
import { ConstructorQuestionsPanel, type ConstructorQuestion } from "./ConstructorQuestionsPanel";
import { ConstructorChatPanel, type ConstructorMessage } from "./ConstructorChatPanel";
import { ConstructorApprovalPanel } from "./ConstructorApprovalPanel";
import { CommunicationSummaryPanel } from "./CommunicationSummaryPanel";

type Props = {
  order: ProductionOrderOpsState;
  files: ConstructorFile[];
  questions: ConstructorQuestion[];
  messages: ConstructorMessage[];
  secureLink: string;
};

export function ConstructorWorkspacePage({ order, files, questions, messages, secureLink }: Props) {
  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Робоче місце конструктора</h1>
            <p className="text-sm text-slate-600">Доступ тільки до цього замовлення</p>
          </div>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Скопіювати посилання конструктору
          </button>
        </div>
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{secureLink}</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className="space-y-4">
          <ConstructorSummaryPanel order={order} />
          <ConstructorFilesPanel files={files} />
          <ConstructorApprovalPanel status={order.drawingsApproved ? "APPROVED" : "READY_FOR_REVIEW"} />
        </div>
        <div className="space-y-4">
          <ConstructorQuestionsPanel questions={questions} />
          <CommunicationSummaryPanel messages={messages.map((m) => m.text)} />
        </div>
        <div className="space-y-4">
          <ConstructorChatPanel messages={messages} />
        </div>
      </div>
    </div>
  );
}
