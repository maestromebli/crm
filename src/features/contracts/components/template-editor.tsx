"use client";

import { useMemo, useState } from "react";

type TemplateInput = {
  code: string;
  name: string;
  documentType: string;
  language: string;
  bodyHtml: string;
  bodyDocxTemplateUrl?: string;
  variablesSchemaJson: unknown;
  settingsJson: unknown;
};

type Props = {
  initial: TemplateInput;
  onSave: (data: TemplateInput) => Promise<void>;
};

export function TemplateEditor({ initial, onSave }: Props) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewHtml = useMemo(() => form.bodyHtml, [form.bodyHtml]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Код шаблону"
          value={form.code}
          onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
        />
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Назва"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
        <textarea
          className="min-h-[220px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
          value={form.bodyHtml}
          onChange={(e) => setForm((p) => ({ ...p, bodyHtml: e.target.value }))}
        />
        <textarea
          className="min-h-[140px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
          value={JSON.stringify(form.variablesSchemaJson, null, 2)}
          onChange={(e) => {
            try {
              setError(null);
              setForm((p) => ({ ...p, variablesSchemaJson: JSON.parse(e.target.value || "[]") }));
            } catch {
              setError("Некоректний JSON у variablesSchemaJson");
            }
          }}
        />
        <textarea
          className="min-h-[140px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
          value={JSON.stringify(form.settingsJson, null, 2)}
          onChange={(e) => {
            try {
              setError(null);
              setForm((p) => ({ ...p, settingsJson: JSON.parse(e.target.value || "{}") }));
            } catch {
              setError("Некоректний JSON у settingsJson");
            }
          }}
        />
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(form);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Збереження..." : "Зберегти чернетку"}
        </button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-medium text-slate-600">Live preview</p>
        <iframe
          className="h-[520px] w-full rounded-lg border border-slate-200 bg-white"
          srcDoc={previewHtml}
          sandbox=""
          title="Попередній перегляд шаблону"
        />
      </div>
    </div>
  );
}
