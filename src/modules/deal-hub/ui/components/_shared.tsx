import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function DealCard(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        props.className,
      )}
    >
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{props.title}</h3>
        {props.subtitle ? (
          <p className="mt-0.5 text-xs text-slate-500">{props.subtitle}</p>
        ) : null}
      </header>
      {props.children}
    </section>
  );
}

export function DealPlaceholderPanel(props: {
  title: string;
  text: string;
}) {
  return (
    <DealCard title={props.title}>
      <p className="text-xs text-slate-600">{props.text}</p>
    </DealCard>
  );
}
