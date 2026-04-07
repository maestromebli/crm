import type React from "react";
import { Button } from "../ui/button";

type HeaderAction = {
  label: string;
  onClick?: () => void;
};

type PageHeaderProps = {
  title: string;
  subtitle: string;
  actions?: HeaderAction[];
  actionsSlot?: React.ReactNode;
};

export function PageHeader({ title, subtitle, actions = [], actionsSlot }: PageHeaderProps) {
  return (
    <header className="enver-panel enver-panel--interactive p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--enver-text)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--enver-text-muted)]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actionsSlot
            ? actionsSlot
            : actions.map((a) => (
                <Button key={a.label} size="sm" onClick={a.onClick}>
                  {a.label}
                </Button>
              ))}
        </div>
      </div>
    </header>
  );
}

