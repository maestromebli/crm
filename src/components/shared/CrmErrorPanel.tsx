"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "../ui/button";

export type CrmErrorPanelLink = {
  href: string;
  label: string;
  variant?: "default" | "outline";
};

type Props = {
  title: string;
  description: string;
  error: (Error & { digest?: string }) | null | undefined;
  /** Префікс для `console.error`, напр. `[finance]` */
  logPrefix: string;
  reset: () => void;
  /** Додаткові посилання після кнопки «Спробувати знову» */
  links: CrmErrorPanelLink[];
  children?: ReactNode;
};

export function CrmErrorPanel({
  title,
  description,
  error,
  logPrefix,
  reset,
  links,
  children,
}: Props) {
  useEffect(() => {
    try {
      const digest =
        error && typeof error === "object" && "digest" in error
          ? (error.digest ?? null)
          : null;
      const message =
        error instanceof Error
          ? error.message
          : "Невідома помилка CRM";
      const suffix = digest ? ` (digest: ${digest})` : "";
      // Next.js devtools (16.x, webpack) may crash on console.error hooks in error boundaries.
      // Use warn to keep diagnostics without crashing segment explorer.
      console.warn(`${logPrefix} ${message}${suffix}`);
    } catch {
      console.warn(`${logPrefix} Невідома помилка CRM`);
    }
  }, [error, logPrefix]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-[var(--enver-text)]">{title}</h1>
      <p className="max-w-md text-sm text-slate-600">{description}</p>
      {error?.digest ? (
        <p className="font-mono text-[10px] text-slate-400">digest: {error.digest}</p>
      ) : null}
      {children}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="default" onClick={() => reset()}>
          Спробувати знову
        </Button>
        {links.map(({ href, label, variant = "outline" }) => (
          <Button key={href} type="button" variant={variant} asChild>
            <Link href={href}>{label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
