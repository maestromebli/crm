"use client";

import { cn } from "../../../lib/utils";

const TOOL_LABELS: Record<string, string> = {
  crm_list_leads: "Ліди",
  crm_list_deals: "Угоди",
  crm_list_open_tasks: "Задачі",
  crm_get_lead: "Лід",
  crm_get_deal: "Угода",
  crm_quick_overview: "Огляд CRM",
  crm_nav_menu: "Меню",
  crm_calendar_upcoming: "Календар",
  crm_search_contacts: "Контакти",
};

function formatToolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/^crm_/, "");
}

type Variant = "dark" | "light";

export function AssistantMessageBody({
  text,
  variant = "dark",
}: {
  text: string;
  variant?: Variant;
}) {
  const textPrimary =
    variant === "dark" ? "text-slate-200/95" : "text-slate-800";
  const borderAccent =
    variant === "dark" ? "border-violet-400/40" : "border-violet-200/90";
  const dot = variant === "dark" ? "bg-violet-300" : "bg-violet-500";

  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div
      className={cn(
        "space-y-3 text-[13px] leading-[1.55]",
        textPrimary,
        variant === "light" && "tracking-tight",
      )}
    >
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const listLines = lines.filter((l) => l.trim());
        const isBulletList = listLines.every((l) =>
          /^(\s*[-*•]|\s*\d+[\.)])\s+/.test(l),
        );

        if (isBulletList && listLines.length > 0) {
          return (
            <ul
              key={bi}
              className={cn(
                "list-none space-y-1.5 border-l-2 pl-3",
                borderAccent,
              )}
            >
              {listLines.map((line, li) => {
                const cleaned = line.replace(
                  /^(\s*[-*•]|\s*\d+[\.)])\s+/,
                  "",
                );
                return (
                  <li key={li} className="relative pl-1">
                    <span
                      className={cn(
                        "absolute -left-2.5 top-2 h-1 w-1 rounded-full",
                        dot,
                      )}
                    />
                    {cleaned}
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={bi} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}

export function AssistantToolBadges({
  toolsUsed,
  variant = "dark",
}: {
  toolsUsed: string[];
  variant?: Variant;
}) {
  if (!toolsUsed.length) return null;
  const pill =
    variant === "dark"
      ? "bg-violet-500/20 text-violet-200"
      : "bg-violet-100 text-violet-800";
  const borderTop =
    variant === "dark" ? "border-white/10" : "border-slate-100";

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap gap-1.5 border-t pt-3",
        borderTop,
      )}
    >
      {toolsUsed.map((t) => (
        <span
          key={t}
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium",
            pill,
          )}
        >
          {formatToolLabel(t)}
        </span>
      ))}
    </div>
  );
}
