"use client";

import { ChevronDown, MessageCircle, PencilLine } from "lucide-react";
import { useMemo, useState } from "react";
import type { ConstructorTechSection, ConstructorZoneProgress } from "../constructor-hub.types";

export function ConstructorTechSpec({
  sections,
  zones,
}: {
  sections: ConstructorTechSection[];
  zones: ConstructorZoneProgress[];
}) {
  const [openId, setOpenId] = useState<string | null>(sections[0]?.id ?? null);
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.zoneName.toLowerCase(), z])), [zones]);

  if (sections.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        Розділи ТЗ поки не заповнені.
      </section>
    );
  }

  return (
    <section id="tech-spec" className="space-y-3">
      {sections.map((section) => {
        const isOpen = openId === section.id;
        const zone = zoneMap.get(section.title.toLowerCase().replace("помещения / ", "").trim());
        return (
          <article key={section.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenId((v) => (v === section.id ? null : section.id))}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{section.summary}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Оновлено: {section.updatedAt ? new Date(section.updatedAt).toLocaleString("uk-UA") : "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="min-w-14 text-right text-xs font-medium text-slate-700">{section.completionPercent}%</div>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
            {isOpen ? (
              <div className="border-t border-slate-100 px-4 py-3">
                {zone ? (
                  <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                    Зона: {zone.zoneName} · прогрес {zone.progressPercent}%
                  </div>
                ) : null}
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {section.details.map((detail, idx) => (
                    <li key={idx} className="rounded-lg bg-slate-50 px-2 py-1.5">
                      {detail}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                    <PencilLine className="h-3.5 w-3.5" />
                    Редагувати
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Коментар
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
