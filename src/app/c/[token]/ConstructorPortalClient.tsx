"use client";

import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api/patch-json";
import { isAllowedPublicConstructorFileUrl } from "../../../lib/constructor-room/public-file-url";

type PublicPayload = {
  dealTitle: string;
  status: string;
  telegramInviteUrl: string | null;
  aiQaJson: unknown;
  priority?: string;
  dueAt?: string | null;
  messages: Array<{
    id: string;
    body: string;
    author: string;
    createdAt: string;
  }>;
  dealAttachments: Array<{
    id: string;
    fileName: string;
    category: string;
    mimeType: string;
    createdAt: string;
    downloadPath: string;
  }>;
  roomAttachments: Array<{
    id: string;
    fileName: string;
    category: string;
    mimeType: string;
    createdAt: string;
    downloadPath: string;
  }>;
};

const uploadCategories = [
  { value: "DRAWING", label: "Креслення" },
  { value: "MEASUREMENT_SHEET", label: "Замір / лист" },
  { value: "OBJECT_PHOTO", label: "Фото об'єкта" },
  { value: "REFERENCE", label: "Референс" },
  { value: "SPEC", label: "Специфікація" },
  { value: "TECH_CARD", label: "Техкартка" },
  { value: "OTHER", label: "Інше" },
];

const deliverCategories = [
  { value: "DRAWING", label: "Креслення (здача)" },
  { value: "TECH_CARD", label: "Техкартка (здача)" },
  { value: "SPEC", label: "Специфікація (здача)" },
];

function statusUa(s: string): string {
  const m: Record<string, string> = {
    PENDING_ASSIGNMENT: "Очікує призначення",
    SENT_TO_CONSTRUCTOR: "Завдання надіслано",
    IN_PROGRESS: "У роботі",
    DELIVERED: "Роботу здано",
    REVIEWED: "Перевірено офісом",
  };
  return m[s] ?? s;
}

const PRIORITY_UA: Record<string, string> = {
  LOW: "Низький",
  NORMAL: "Звичайний",
  HIGH: "Високий",
  URGENT: "Терміново",
};

function isSlaOverdue(
  status: string,
  dueAtIso: string | null | undefined,
): boolean {
  if (!dueAtIso) return false;
  if (status === "REVIEWED" || status === "DELIVERED") return false;
  return new Date(dueAtIso).getTime() < Date.now();
}

function statusPillClass(s: string): string {
  const m: Record<string, string> = {
    PENDING_ASSIGNMENT: "border-slate-200 bg-slate-100 text-[var(--enver-text)]",
    SENT_TO_CONSTRUCTOR: "border-sky-200 bg-sky-100 text-sky-950",
    IN_PROGRESS: "border-amber-200 bg-amber-100 text-amber-950",
    DELIVERED: "border-emerald-200 bg-emerald-100 text-emerald-950",
    REVIEWED: "border-violet-200 bg-violet-100 text-violet-950",
  };
  return m[s] ?? "border-slate-200 bg-slate-100 text-[var(--enver-text)]";
}

export function ConstructorPortalClient({ token }: { token: string }) {
  const [data, setData] = useState<PublicPayload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [upFileName, setUpFileName] = useState("");
  const [upFileUrl, setUpFileUrl] = useState("");
  const [upCat, setUpCat] = useState("DRAWING");
  const [deliverFileName, setDeliverFileName] = useState("");
  const [deliverFileUrl, setDeliverFileUrl] = useState("");
  const [deliverCat, setDeliverCat] = useState("DRAWING");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [silentRefreshing, setSilentRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent;
      if (!silent) {
        setLoadErr(null);
      } else {
        setSilentRefreshing(true);
      }
      try {
        const r = await fetch(
          `/api/public/constructor/${encodeURIComponent(token)}`,
        );
        const j = (await r.json().catch(() => ({}))) as {
          error?: string;
        } & Partial<PublicPayload>;
        if (!r.ok) throw new Error(j.error ?? "Не вдалося завантажити");
        setData(j as PublicPayload);
      } catch (e) {
        if (!silent) {
          setLoadErr(e instanceof Error ? e.message : "Помилка");
        }
      } finally {
        if (silent) setSilentRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load({ silent: true });
    }, 45_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!data?.dealTitle) return;
    const raw = data.dealTitle.trim();
    const short = raw.length > 56 ? `${raw.slice(0, 53)}…` : raw;
    document.title = `${short} · Кімната конструктора`;
  }, [data?.dealTitle]);

  const sendChat = async () => {
    const t = msg.trim();
    if (!t) return;
    setBusy(true);
    setFormErr(null);
    try {
      await postJson<{ ok?: boolean }>(
        `/api/public/constructor/${encodeURIComponent(token)}/messages`,
        { body: t },
      );
      setMsg("");
      await load({ silent: true });
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const uploadAttachment = async () => {
    setFormErr(null);
    const fileName = upFileName.trim();
    const fileUrl = upFileUrl.trim();
    if (!fileName || !fileUrl) {
      setFormErr("Вкажіть назву файлу та URL.");
      return;
    }
    if (!isAllowedPublicConstructorFileUrl(fileUrl)) {
      setFormErr(
        "URL має бути повним посиланням https:// або http:// на файл у хмарі (без javascript: тощо).",
      );
      return;
    }
    setBusy(true);
    try {
      await postJson<{ ok?: boolean }>(
        `/api/public/constructor/${encodeURIComponent(token)}/attachment`,
        {
          fileName,
          fileUrl,
          mimeType: "application/octet-stream",
          category: upCat,
        },
      );
      setUpFileName("");
      setUpFileUrl("");
      await load({ silent: true });
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const deliver = async () => {
    setFormErr(null);
    const fileName = deliverFileName.trim();
    const fileUrl = deliverFileUrl.trim();
    if (!fileName || !fileUrl) {
      setFormErr("Вкажіть назву файлу та URL.");
      return;
    }
    if (!isAllowedPublicConstructorFileUrl(fileUrl)) {
      setFormErr(
        "URL має бути повним посиланням https:// або http:// на файл у хмарі (без javascript: тощо).",
      );
      return;
    }
    setBusy(true);
    try {
      await postJson<{ ok?: boolean }>(
        `/api/public/constructor/${encodeURIComponent(token)}/deliver`,
        {
          fileName,
          fileUrl,
          mimeType: "application/octet-stream",
          category: deliverCat,
        },
      );
      setDeliverFileName("");
      setDeliverFileUrl("");
      await load({ silent: true });
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-sm text-rose-700">
        {loadErr}
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-6 text-sm text-slate-600">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-slate-100" />
        <p>Завантаження кімнати…</p>
      </main>
    );
  }

  const qaList = Array.isArray(data.aiQaJson) ? data.aiQaJson : null;

  const measurementish = (c: string) =>
    c === "MEASUREMENT_SHEET" || c === "OBJECT_PHOTO";

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm text-slate-800">
      <header className="space-y-2 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Кімната конструктора · ENVER
          </p>
          <div className="flex items-center gap-2">
            {silentRefreshing ? (
              <span className="text-[11px] text-slate-400">Оновлення…</span>
            ) : null}
            <button
              type="button"
              onClick={() => void load({ silent: true })}
              className="rounded border border-slate-200 bg-[var(--enver-card)] px-2 py-1 text-[11px] text-slate-700 hover:bg-[var(--enver-hover)]"
            >
              Оновити
            </button>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[var(--enver-text)]">{data.dealTitle}</h1>
        <p className="flex flex-wrap items-center gap-2 text-slate-600">
          <span>Статус:</span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusPillClass(data.status)}`}
          >
            {statusUa(data.status)}
          </span>
        </p>
        {(data.priority || data.dueAt) && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {data.priority ? (
              <>
                <span>Пріоритет:</span>
                <span className="font-medium text-slate-800">
                  {PRIORITY_UA[data.priority] ?? data.priority}
                </span>
              </>
            ) : null}
            {data.dueAt ? (
              <span className="text-slate-700">
                {data.priority ? " · " : ""}
                Дедлайн:{" "}
                {new Date(data.dueAt).toLocaleString("uk-UA", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </p>
        )}
        {isSlaOverdue(data.status, data.dueAt ?? null) ? (
          <div
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900"
            role="status"
          >
            <strong className="font-semibold">Прострочений дедлайн (SLA).</strong>{" "}
            Якщо потрібна допомога або зміна терміну — напишіть у переписці; офіс
            побачить повідомлення в CRM.
          </div>
        ) : null}
        {data.telegramInviteUrl ? (
          <a
            href={data.telegramInviteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-indigo-700 underline"
          >
            Відкрити групу в Telegram
          </a>
        ) : (
          <p className="text-xs text-slate-500">
            Посилання на Telegram-групу додасть директор виробництва.
          </p>
        )}
      </header>

      {qaList && qaList.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Питання та відповіді
          </h2>
          <ul className="mt-2 space-y-2">
            {qaList.map((row: unknown, i: number) => {
              const o = row as { question?: string; answer?: string; q?: string; a?: string };
              const q = o.question ?? o.q ?? "";
              const a = o.answer ?? o.a ?? "";
              return (
                <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <p className="font-medium text-[var(--enver-text)]">{q || "—"}</p>
                  <p className="mt-1 text-slate-700">{a}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Переписка</h2>
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
          {data.messages.length === 0 ? (
            <li className="rounded border border-dashed border-slate-200 bg-slate-50/50 px-2 py-3 text-slate-500">
              Повідомлень ще немає — почніть з опису задачі з боку офісу або
              конструктора.
            </li>
          ) : (
            data.messages.map((m) => (
              <li
                key={m.id}
                className="rounded border border-slate-100 bg-slate-50/80 px-2 py-1.5"
              >
                <span className="text-slate-400">
                  {new Date(m.createdAt).toLocaleString("uk-UA")} ·{" "}
                  {m.author === "INTERNAL" ? "Команда" : "Конструктор"}
                </span>
                <div className="whitespace-pre-wrap text-slate-800">{m.body}</div>
              </li>
            ))
          )}
        </ul>
        {data.status === "SENT_TO_CONSTRUCTOR" ||
        data.status === "IN_PROGRESS" ||
        data.status === "DELIVERED" ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={3}
              className="min-h-[72px] flex-1 rounded border border-slate-200 px-2 py-1.5"
              placeholder="Повідомлення…"
            />
            <button
              type="button"
              disabled={busy || !msg.trim()}
              onClick={() => void sendChat()}
              className="h-fit rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Надіслати
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-amber-800">
            Переписка буде доступна після того, як офіс надішле завдання.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Файли та зображення проєкту (з замовлення)
        </h2>
        <ul className="mt-2 space-y-1 text-xs">
          {data.dealAttachments.length === 0 ? (
            <li className="text-slate-500">Немає вкладень у картці замовлення.</li>
          ) : (
            data.dealAttachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.downloadPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-700 underline"
                >
                  {a.fileName}
                </a>{" "}
                <span className="text-slate-400">({a.category})</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">Заміри</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {data.dealAttachments.filter((a) => measurementish(a.category))
            .length === 0 ? (
            <li className="text-slate-500">
              Немає файлів категорій «замір» / «фото об&apos;єкта» в замовленні.
            </li>
          ) : (
            data.dealAttachments
              .filter((a) => measurementish(a.category))
              .map((a) => (
                <li key={a.id}>
                  <a
                    href={a.downloadPath}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-700 underline"
                  >
                    {a.fileName}
                  </a>
                </li>
              ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Ваші файли в кімнаті
        </h2>
        <ul className="mt-2 space-y-1 text-xs">
          {data.roomAttachments.map((a) => (
            <li key={a.id}>
              <a
                href={a.downloadPath}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-700 underline"
              >
                {a.fileName}
              </a>{" "}
              <span className="text-slate-400">({a.category})</span>
            </li>
          ))}
        </ul>
      </section>

      {(data.status === "SENT_TO_CONSTRUCTOR" || data.status === "IN_PROGRESS") && (
        <>
          <section className="rounded-xl border border-slate-200 bg-amber-50/50 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--enver-text)]">
              Додати файл (посилання)
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Вкажіть пряме посилання на файл у хмарі; офіс бачить його в CRM.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-slate-500">Назва файлу</span>
                <input
                  value={upFileName}
                  onChange={(e) => setUpFileName(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-slate-500">URL</span>
                <input
                  value={upFileUrl}
                  onChange={(e) => setUpFileUrl(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-slate-500">Категорія</span>
                <select
                  value={upCat}
                  onChange={(e) => setUpCat(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                >
                  {uploadCategories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              disabled={busy || !upFileName.trim() || !upFileUrl.trim()}
              onClick={() => void uploadAttachment()}
              className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Додати до кімнати
            </button>
          </section>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-emerald-900">
              Здати роботу головному конструктору / начальнику виробництва
            </h2>
            <p className="mt-1 text-xs text-emerald-800">
              Останній крок: креслення або модель для перевірки в офісі. Після
              здачі статус зміниться на «Роботу здано».
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-slate-600">Назва фінального файлу</span>
                <input
                  value={deliverFileName}
                  onChange={(e) => setDeliverFileName(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-slate-600">URL</span>
                <input
                  value={deliverFileUrl}
                  onChange={(e) => setDeliverFileUrl(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
                />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="text-slate-600">Категорія здачі</span>
              <select
                value={deliverCat}
                onChange={(e) => setDeliverCat(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5"
              >
                {deliverCategories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !deliverFileName.trim() || !deliverFileUrl.trim()}
              onClick={() => void deliver()}
              className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Здати фінальний файл
            </button>
          </section>
        </>
      )}

      {formErr ? (
        <p
          className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800"
          role="status"
          aria-live="polite"
        >
          {formErr}
        </p>
      ) : null}
    </main>
  );
}
