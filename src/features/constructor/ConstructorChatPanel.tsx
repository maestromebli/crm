export type ConstructorMessage = { id: string; author: string; text: string; at: string };

export function ConstructorChatPanel({ messages }: { messages: ConstructorMessage[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Комунікація</h3>
        <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium">
          Відкрити Telegram-групу
        </button>
      </div>
      <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto text-xs">
        {messages.map((message) => (
          <li key={message.id} className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="font-medium text-slate-900">{message.author}</p>
            <p className="text-slate-700">{message.text}</p>
            <p className="text-slate-500">{message.at}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
