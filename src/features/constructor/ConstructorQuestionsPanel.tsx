export type ConstructorQuestion = { id: string; text: string; status: "OPEN" | "ANSWERED" };

export function ConstructorQuestionsPanel({ questions }: { questions: ConstructorQuestion[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Відкриті питання</h3>
      <ul className="mt-3 space-y-2 text-xs">
        {questions.length === 0 ? (
          <li className="text-slate-500">Немає відкритих питань.</li>
        ) : (
          questions.map((question) => (
            <li key={question.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-slate-800">{question.text}</p>
              <p className="mt-1 text-slate-500">{question.status}</p>
            </li>
          ))
        )}
      </ul>
      <button className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium">
        Додати уточнення
      </button>
    </section>
  );
}
