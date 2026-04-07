import type { ChannelHealth, MessagingChannelAdapter } from "./types";

/**
 * Заглушка: інфраструктура готова; реальний Bot API підключається окремо.
 */
export class TelegramAdapterStub implements MessagingChannelAdapter {
  readonly channelKey = "telegram" as const;

  async getHealth(): Promise<ChannelHealth> {
    return {
      ok: false,
      lastError: "Інтеграція Telegram не налаштована (webhook / токен).",
      lastSyncedAt: null,
    };
  }

  async connect(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "not_configured" };
  }

  async syncThreads(_cursor: string | null): Promise<{
    ok: boolean;
    nextCursor: string | null;
    error?: string;
  }> {
    return { ok: false, nextCursor: null, error: "not_configured" };
  }

  async sendMessage(_args: {
    externalThreadId: string;
    text: string;
  }): Promise<{ ok: boolean; externalMessageId?: string; error?: string }> {
    return { ok: false, error: "not_configured" };
  }
}
