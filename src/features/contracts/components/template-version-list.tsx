type Item = {
  id: string;
  code: string;
  name: string;
  version: number;
  status: string;
  updatedAt: string | Date;
};

export function TemplateVersionList(props: {
  items: Item[];
  onOpen: (templateId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Версії шаблонів
      </div>
      <div className="space-y-2">
        {props.items.map((item) => (
          <button
            key={item.id}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
            type="button"
            onClick={() => props.onOpen(item.id)}
          >
            <div>
              <div className="text-sm font-medium text-slate-900">
                {item.name} · {item.code}
              </div>
              <div className="text-xs text-slate-500">
                v{item.version} · {item.status}
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              {new Date(item.updatedAt).toLocaleDateString("uk-UA")}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
