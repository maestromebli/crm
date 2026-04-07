"use client";

import { useRouter } from "next/navigation";
import type { AssistantQuickAction } from "../types";
import { cn } from "../../../lib/utils";

type Props = {
  actions: AssistantQuickAction[];
  className?: string;
};

const fallbackNavigate = (
  router: ReturnType<typeof useRouter>,
  href: string,
) => {
  router.push(href);
};

/**
 * Швидкі дії: за замовчуванням navigate; інші типи — безпечний noop до окремого дроту.
 */
export function AssistantQuickActions({ actions, className }: Props) {
  const router = useRouter();

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={a.disabled}
          onClick={() => {
            if (a.disabled) return;
            if (a.actionType === "navigate" && a.href) {
              fallbackNavigate(router, a.href);
              return;
            }
            if (a.actionType === "noop" || a.actionType === "modal") {
              return;
            }
            if (a.actionType === "callback") {
              return;
            }
          }}
          className={cn(
            "rounded-lg border border-slate-200/90 bg-[var(--enver-card)] px-2.5 py-1.5 text-left text-[11px] text-slate-700 transition hover:border-slate-300 hover:bg-[var(--enver-hover)]",
            a.disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
