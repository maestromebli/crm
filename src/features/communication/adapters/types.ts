/**
 * Абстракція зовнішнього каналу (Telegram / Instagram / …).
 * Реальні інтеграції підключаються через адаптери без зміни домену CRM.
 */
export type ChannelHealth = {
  ok: boolean;
  lastError?: string | null;
  lastSyncedAt?: string | null;
};

export type NormalizedInboundMessage = {
  externalThreadId: string;
  externalMessageId: string;
  text: string;
  sentAtIso: string;
  direction: "INBOUND" | "OUTBOUND";
  attachments?: Array<{
    externalFileId: string;
    mimeType?: string;
    fileName?: string;
  }>;
};

export interface MessagingChannelAdapter {
  readonly channelKey: "telegram" | "instagram" | "whatsapp" | "viber";

  getHealth(): Promise<ChannelHealth>;

  /** Повне підключення — майбутній OAuth / webhook secret тощо. */
  connect(): Promise<{ ok: boolean; error?: string }>;

  syncThreads(_cursor: string | null): Promise<{
    ok: boolean;
    nextCursor: string | null;
    error?: string;
  }>;

  sendMessage(_args: {
    externalThreadId: string;
    text: string;
  }): Promise<{ ok: boolean; externalMessageId?: string; error?: string }>;
}
