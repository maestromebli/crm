"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../../components/ui/button";

type Props = {
  /** GET-ендпоінт, що повертає CSV з `Content-Disposition`. */
  apiPath: string;
  /** Ім’я файлу, якщо заголовок відповіді недоступний. */
  fallbackFilename?: string;
  /** Підпис для скрінрідерів (за замовчуванням — загальний). */
  ariaLabel?: string;
  /** Підказка при наведенні: що потрапляє у файл. */
  title?: string;
};

/**
 * Універсальна кнопка завантаження CSV (credentials, парсинг filename з відповіді).
 * Використовується для реєстру, зарплати, банків тощо.
 */
export function FinanceCsvExportButton({
  apiPath,
  fallbackFilename,
  ariaLabel = "Завантажити дані у файлі CSV",
  title,
}: Props) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath, { credentials: "same-origin" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="([^"]+)"/);
      const filename =
        m?.[1] ?? fallbackFilename ?? `export-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : "Не вдалося експортувати");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => void download()}
      disabled={loading}
      aria-busy={loading}
      aria-label={ariaLabel}
      title={title}
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      {loading ? "Експорт…" : "Експорт CSV"}
    </Button>
  );
}
