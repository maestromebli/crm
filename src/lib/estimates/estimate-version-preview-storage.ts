/** Ключ sessionStorage для передачі чернетки на екран версіонування. */
export function estimateVersionPreviewStorageKey(
  leadId: string,
  estimateId: string,
) {
  return `crm:estimateVersionPreview:v1:${leadId}:${estimateId}`;
}
