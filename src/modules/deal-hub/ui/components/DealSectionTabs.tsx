import type { DealHubSectionId } from "../hooks/useDealSections";

export function DealSectionTabs(props: {
  sections: Array<{ id: string; label: string }>;
  activeSection: DealHubSectionId;
  onChange: (id: DealHubSectionId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {props.sections.map((section) => {
        const active = section.id === props.activeSection;
        return (
          <button
            key={section.id}
            type="button"
            className={`rounded-lg px-2.5 py-1.5 text-xs transition ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            onClick={() => props.onChange(section.id as DealHubSectionId)}
          >
            {section.label}
          </button>
        );
      })}
    </div>
  );
}
