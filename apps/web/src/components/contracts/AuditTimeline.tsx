import { ContractEntity } from "./types";

export function AuditTimeline({ contract }: { contract: ContractEntity }) {
  const logs = contract.auditLogs ?? [];
  return (
    <section className="rounded-xl border bg-white p-4">
      <h3 className="text-base font-semibold">Журнал дій</h3>
      <div className="mt-3 space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <p className="font-medium">{log.action}</p>
            <p className="text-slate-600">
              {log.actorRole ?? "system"} • {new Date(log.createdAt).toLocaleString("uk-UA")}
            </p>
          </div>
        ))}
        {logs.length === 0 ? <p className="text-sm text-slate-500">Немає подій</p> : null}
      </div>
    </section>
  );
}
