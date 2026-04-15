import type { ContractViewModel } from "../types";

export function AuditTimeline({ contract }: { contract: ContractViewModel }) {
  const logs = contract.audit ?? [];
  const actionLabels: Record<string, string> = {
    CONTRACT_CREATED_FROM_QUOTATION: "Договір створено з комерційної пропозиції",
    CONTRACT_UPDATED: "Договір оновлено",
    CONTRACT_SENT_FOR_REVIEW: "Договір надіслано на перевірку",
    CONTRACT_APPROVED: "Договір погоджено",
    CONTRACT_SHARED: "Договір поширено клієнту",
    PORTAL_VIEWED: "Портал договору переглянуто",
    STATUS_NEEDS_REVISION: "Договір повернено на доопрацювання",
    CONTRACT_DOCUMENT_SNAPSHOT_CREATED: "Згенеровано пакет документів",
    DIIA_WEBHOOK_RECEIVED: "Отримано подію підписання з Дії",
  };
  const sourceLabels: Record<string, string> = {
    SYSTEM: "Система",
    INTEGRATION: "Інтеграція",
    USER: "Користувач",
    CLIENT: "Клієнт",
  };
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Аудит дій</h3>
      {logs.length === 0 ? <p className="text-sm text-slate-500">Подій ще немає</p> : null}
      {logs.map((log) => (
        <div key={log.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <p className="font-medium">{actionLabels[log.action] ?? log.action}</p>
          <p className="text-xs text-slate-500">
            {new Date(log.createdAt).toLocaleString("uk-UA")} · {sourceLabels[log.source] ?? log.source}
          </p>
        </div>
      ))}
    </section>
  );
}
