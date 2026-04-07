"use client";

import { useMemo, useState } from "react";
import { writeTextToClipboard } from "../../lib/clipboard-write";

export function CopyConstructorLinkButton({ publicToken }: { publicToken: string }) {
  const [done, setDone] = useState(false);
  const [copyErr, setCopyErr] = useState(false);

  const fullUrl = useMemo(() => {
    if (typeof window === "undefined") return `/c/${publicToken}`;
    return `${window.location.origin}/c/${publicToken}`;
  }, [publicToken]);

  const copy = async () => {
    if (typeof window === "undefined") return;
    setCopyErr(false);
    const url = `${window.location.origin}/c/${publicToken}`;
    const ok = await writeTextToClipboard(url);
    if (ok) {
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } else {
      setCopyErr(true);
      window.setTimeout(() => setCopyErr(false), 4000);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/c/${publicToken}`}
        target="_blank"
        rel="noreferrer"
        className="text-indigo-700 underline"
        title={fullUrl}
      >
        Відкрити
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded border border-slate-200 bg-[var(--enver-card)] px-2 py-0.5 text-[11px] text-slate-700 hover:bg-[var(--enver-hover)]"
        title={fullUrl}
        aria-label={`Копіювати посилання: ${fullUrl}`}
      >
        {done ? "Скопійовано" : copyErr ? "Не вдалося" : "Копіювати URL"}
      </button>
      {copyErr ? (
        <span className="text-[11px] text-amber-800" role="status">
          Скопіюйте вручну з підказки (title)
        </span>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {done ? "Посилання скопійовано в буфер" : ""}
      </span>
    </div>
  );
}
