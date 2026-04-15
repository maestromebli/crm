import { extractCommunicationSummary } from "./AIQuestionExtractor";
import { OpenIssuesList } from "./OpenIssuesList";

export function CommunicationSummaryPanel({ messages }: { messages: string[] }) {
  const summary = extractCommunicationSummary(messages);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Ключові питання</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {summary.keyQuestions.length === 0 ? <li>Питань не знайдено.</li> : summary.keyQuestions.map((q) => <li key={q}>- {q}</li>)}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Критичні уточнення</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {summary.criticalClarifications.length === 0 ? <li>Критичних уточнень не виявлено.</li> : summary.criticalClarifications.map((q) => <li key={q}>- {q}</li>)}
        </ul>
      </section>

      <OpenIssuesList issues={summary.issues} />
    </div>
  );
}
