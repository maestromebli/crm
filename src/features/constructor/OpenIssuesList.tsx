import type { ExtractedIssue } from "./AIQuestionExtractor";

export function OpenIssuesList({ issues }: { issues: ExtractedIssue[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Немає відповіді</h3>
      <ul className="mt-3 space-y-2 text-xs">
        {issues.length === 0 ? (
          <li className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">Відкритих питань немає.</li>
        ) : (
          issues.map((issue) => (
            <li key={issue.id} className={`rounded-lg border px-3 py-2 ${issue.critical ? "border-rose-200 bg-rose-50 text-rose-900" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
              {issue.title}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
