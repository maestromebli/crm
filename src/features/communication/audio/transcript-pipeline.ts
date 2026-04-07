/**
 * Майбутній провайдер транскрипції (Whisper / хмара).
 * Зараз лише типізовані стани в `CommMessage.transcriptStatus`.
 */
export type TranscriptJobState =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export interface VoiceTranscriptAdapter {
  enqueueTranscription(_args: {
    messageId: string;
    storageKey: string | null;
    mimeType: string;
  }): Promise<{ jobId: string }>;
}

export class VoiceTranscriptStub implements VoiceTranscriptAdapter {
  async enqueueTranscription(_args: {
    messageId: string;
    storageKey: string | null;
    mimeType: string;
  }): Promise<{ jobId: string }> {
    return { jobId: `stub_${_args.messageId}` };
  }
}
