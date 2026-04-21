type EventItem = {
  id: string;
  eventType: string;
  actorType?: string | null;
  actorId?: string | null;
  createdAt: string | Date;
};

export function ContractAuditTimeline({ events }: { events: EventItem[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Аудит</h3>
      <div className="mt-3 space-y-2">
        {events.map((event) => (
          <div key={event.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
            <div className="font-medium text-slate-800">{event.eventType}</div>
            <div className="text-slate-500">
              {event.actorType ?? "SYSTEM"} · {event.actorId ?? "—"} ·{" "}
              {new Date(event.createdAt).toLocaleString("uk-UA")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
