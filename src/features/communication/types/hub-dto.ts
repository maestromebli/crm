/** DTO для Communication Hub (українські підписи лише в UI). */

export type HubChannelFilter =
  | "ALL"
  | "TELEGRAM"
  | "INSTAGRAM"
  | "INTERNAL_NOTE"
  | "CALL_LOG";

export type HubThreadDto = {
  id: string;
  channelType: string;
  title: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: string;
  needsReply: boolean;
  followUpAt: string | null;
  aiSummary: string | null;
  preview: string | null;
};

export type HubMessageDto = {
  id: string;
  threadId: string;
  direction: string;
  senderName: string | null;
  text: string;
  sentAt: string;
  messageKind: string;
};

export type HubInsightDto = {
  summaryShort: string | null;
  summaryDetailed: string | null;
  clientIntent: string | null;
  recommendedNextStep: string | null;
  recommendedReply: string | null;
  missingInfoJson: unknown;
  confidenceScore: number | null;
  generatedAt: string | null;
};

export type HubFollowUpDto = {
  id: string;
  reason: string;
  draftMessage: string | null;
  dueAt: string | null;
  urgency: string | null;
  status: string;
};

export type ChannelHealthDto = {
  channelType: string;
  syncStatus: string;
  title: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type CommunicationHubPayload = {
  entity: "LEAD" | "DEAL";
  entityId: string;
  threads: HubThreadDto[];
  messagesByThread: Record<string, HubMessageDto[]>;
  primaryInsight: HubInsightDto | null;
  followUps: HubFollowUpDto[];
  channelHealth: ChannelHealthDto[];
};
