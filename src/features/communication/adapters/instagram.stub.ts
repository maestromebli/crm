import type { ChannelHealth, MessagingChannelAdapter } from "./types";

/**
 * Заглушка Instagram Graph / Messaging API.
 */
export class InstagramAdapterStub implements MessagingChannelAdapter {
  readonly channelKey = "instagram" as const;

  async getHealth(): Promise<ChannelHealth> {
    return {
      ok: false,
      lastError: "Інтеграція Instagram DM не налаштована.",
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
