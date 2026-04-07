/** Локалізація статусу КП на ліді (LeadProposalStatus). */
export function leadProposalStatusUa(status: string): string {
  const m: Record<string, string> = {
    DRAFT: "Чернетка",
    SENT: "Надіслано",
    CLIENT_REVIEWING: "На розгляді",
    APPROVED: "Погоджено",
    REJECTED: "Відхилено",
    SUPERSEDED: "Замінено новою версією",
  };
  return m[status] ?? status;
}
