"use client";

import { useState } from "react";
import { postJson } from "@/lib/api/patch-json";

type Props = {
  token: string;
  flow: {
    id: string;
    number: string;
    clientName: string;
    title: string;
    dueDate: string | null;
    constructorName: string | null;
    questions: Array<{
      id: string;
      text: string;
      status: string;
      authorName: string;
      createdAt: string;
    }>;
    filePackages: Array<{
      id: string;
      packageName: string;
      versionLabel: string;
      uploadedAt: string;
      filesCount: number;
    }>;
  };
};

export function ConstructorWorkspaceClient({ token, flow }: Props) {
  const [questionText, setQuestionText] = useState("");
  const [packageName, setPackageName] = useState("");
  const [versionLabel, setVersionLabel] = useState("v1");
  const [status, setStatus] = useState<"IN_PROGRESS" | "READY_FOR_REVIEW">("IN_PROGRESS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await postJson<{ ok?: boolean }>(path, body as Record<string, unknown>);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка запиту");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold">{flow.number} · Робоче місце конструктора</h1>
        <p className="mt-1 text-sm text-slate-600">Клієнт: {flow.clientName}</p>
        <p className="text-sm text-slate-600">Виріб: {flow.title}</p>
        <p className="text-sm text-slate-600">
          Дедлайн: {flow.dueDate ? new Date(flow.dueDate).toLocaleDateString("uk-UA") : "—"}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Files</h2>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {flow.filePackages.map((item) => (
              <li key={item.id}>
                {item.packageName} · {item.versionLabel} · {item.filesCount} файлів
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Назва пакета"
              value={packageName}
              onChange={(event) => setPackageName(event.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Версія"
              value={versionLabel}
              onChange={(event) => setVersionLabel(event.target.value)}
            />
            <button
              disabled={busy || !packageName.trim()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              onClick={() =>
                void post(`/api/constructor/${token}/file-packages`, {
                  packageName: packageName.trim(),
                  versionLabel: versionLabel.trim() || "v1",
                })
              }
            >
              Завантажити пакет (metadata)
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Questions / Chat</h2>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {flow.questions.map((item) => (
              <li key={item.id}>
                [{item.status}] {item.text}
              </li>
            ))}
          </ul>
          <textarea
            rows={3}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Додати питання"
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
          />
          <button
            disabled={busy || !questionText.trim()}
            className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            onClick={() => void post(`/api/constructor/${token}/questions`, { text: questionText.trim() })}
          >
            Додати питання
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Статус</h2>
        <div className="mt-2 flex gap-2">
          <button
            disabled={busy}
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              status === "IN_PROGRESS" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
            }`}
            onClick={() => {
              setStatus("IN_PROGRESS");
              void post(`/api/constructor/${token}/status`, { status: "IN_PROGRESS" });
            }}
          >
            В роботі
          </button>
          <button
            disabled={busy}
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              status === "READY_FOR_REVIEW" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
            }`}
            onClick={() => {
              setStatus("READY_FOR_REVIEW");
              void post(`/api/constructor/${token}/status`, { status: "READY_FOR_REVIEW" });
            }}
          >
            Готово до перевірки
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
