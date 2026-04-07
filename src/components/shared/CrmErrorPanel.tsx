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
  error: Error & { digest?: string };
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
    console.error(logPrefix, error);
  }, [error, logPrefix]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold text-[var(--enver-text)]">{title}</h1>
      <p className="max-w-md text-sm text-slate-600">{description}</p>
      {error.digest ? (
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
