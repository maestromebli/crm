type Props = {
  status: string;
  signatureStatus?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Чернетка",
  READY_FOR_REVIEW: "Готовий до рев'ю",
  APPROVED_INTERNAL: "Погоджено",
  ISSUED: "Випущено",
  SENT_FOR_SIGNATURE: "Надіслано на підпис",
  PARTIALLY_SIGNED: "Частково підписано",
  SIGNED: "Підписано",
  DECLINED: "Відхилено",
  EXPIRED: "Протерміновано",
  VOIDED: "Скасовано",
};

export function ContractStatusBadge({ status, signatureStatus }: Props) {
  return (
    <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      {STATUS_LABELS[status] ?? status}
      {signatureStatus ? ` · ${signatureStatus}` : ""}
    </span>
  );
}
