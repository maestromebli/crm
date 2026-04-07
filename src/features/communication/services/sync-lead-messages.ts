/**
 * Синхронізація історії ліда в шар CommThread/CommMessage.
 * Тимчасово вимкнено — hub працює з уже збереженими comm-рядками.
 */
export async function syncLeadMessagesToCommLayer(_leadId: string): Promise<void> {
  return;
}
