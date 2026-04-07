import { readFile } from "node:fs/promises";
import type {
  AiDetectedFileCategory,
  AiFileProcessingStatus,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { logAiEvent } from "../../../lib/ai/log-ai-event";
import { resolveAttachmentAbsolutePath } from "../../../lib/uploads/lead-disk-upload";
import { extractTextFromBuffer, guessCategoryFromSignals } from "./extract-local-buffer";
import { analyzeFileWithLlm } from "./llm-analyze-file";

function statusForNoKey(hasText: boolean): AiFileProcessingStatus {
  return hasText ? "COMPLETED" : "SKIPPED_NO_AI_KEY";
}

/**
 * Повна обробка вкладення: OCR/текст → евристика → (за наявності ключа) LLM.
 * Ідемпотентно оновлює FileAiExtraction.
 */
export async function processFileAiExtraction(input: {
  attachmentId: string;
  actorUserId?: string | null;
}): Promise<void> {
  const { attachmentId } = input;
  if (!process.env.DATABASE_URL?.trim()) return;

  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileUrl: true,
      storageKey: true,
      category: true,
      entityType: true,
      entityId: true,
    },
  });

  if (!att) return;

  await prisma.fileAiExtraction.upsert({
    where: { attachmentId },
    create: {
      attachmentId,
      entityType: att.entityType,
      entityId: att.entityId,
      mimeType: att.mimeType,
      originalFilename: att.fileName,
      processingStatus: "PROCESSING",
    },
    update: {
      processingStatus: "PROCESSING",
      processingError: null,
    },
  });

  const abs = resolveAttachmentAbsolutePath({
    storageKey: att.storageKey,
    fileUrl: att.fileUrl,
  });

  if (!abs) {
    await prisma.fileAiExtraction.update({
      where: { attachmentId },
      data: {
        processingStatus: "SKIPPED_NO_LOCAL_FILE",
        processingError:
          "Файл недоступний локально для аналізу (немає storageKey / шляху).",
        processedAt: new Date(),
      },
    });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(abs);
  } catch (e) {
    await prisma.fileAiExtraction.update({
      where: { attachmentId },
      data: {
        processingStatus: "FAILED",
        processingError:
          e instanceof Error ? e.message.slice(0, 2000) : "read_failed",
        processedAt: new Date(),
      },
    });
    return;
  }

  const extracted = await extractTextFromBuffer({
    buffer,
    mimeType: att.mimeType,
    fileName: att.fileName,
  });

  const textSample = extracted.text?.slice(0, 4000) ?? null;
  const heuristic = guessCategoryFromSignals({
    mimeType: att.mimeType,
    fileName: att.fileName,
    attachmentCategory: att.category,
    textSample,
  });

  let imageBase64: string | null = null;
  if (att.mimeType.toLowerCase().startsWith("image/")) {
    imageBase64 = buffer.toString("base64");
  }

  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    await prisma.fileAiExtraction.update({
      where: { attachmentId },
      data: {
        extractedText: extracted.text?.slice(0, 100_000) ?? null,
        detectedCategory: heuristic,
        shortSummary:
          extracted.text && extracted.text.length > 20
            ? `Евристична категорія: ${heuristic}. Текст витягнуто без ШІ-моделі (немає AI_API_KEY).`
            : `Категорія за евристикою: ${heuristic}. Для повного аналізу зображень/складних PDF налаштуйте AI_API_KEY.`,
        detailedSummary: null,
        confidenceScore: 0.35,
        processingStatus: statusForNoKey(Boolean(extracted.text?.trim())),
        processedAt: new Date(),
        processingError: null,
      },
    });
    if (input.actorUserId) {
      await logAiEvent({
        userId: input.actorUserId,
        action: "file_extraction",
        entityType: att.entityType,
        entityId: att.entityId,
        ok: true,
        metadata: { attachmentId, mode: "heuristic_only" },
      });
    }
    return;
  }

  const llm = await analyzeFileWithLlm({
    fileName: att.fileName,
    mimeType: att.mimeType,
    extractedText: extracted.text,
    imageBase64,
    imageMime: att.mimeType.startsWith("image/") ? att.mimeType : null,
    heuristicCategory: heuristic,
  });

  if (llm.ok === false) {
    const errText = llm.error;
    await prisma.fileAiExtraction.update({
      where: { attachmentId },
      data: {
        extractedText: extracted.text?.slice(0, 100_000) ?? null,
        detectedCategory: heuristic,
        shortSummary: `Евристичний аналіз (${heuristic}). LLM недоступний: ${errText}.`,
        confidenceScore: 0.4,
        processingStatus: "COMPLETED",
        processedAt: new Date(),
        processingError: errText.slice(0, 2000),
      },
    });
    return;
  }

  const d = llm.data;
  await prisma.fileAiExtraction.update({
    where: { attachmentId },
    data: {
      extractedText: extracted.text?.slice(0, 100_000) ?? null,
      detectedCategory: d.detectedCategory,
      shortSummary: d.shortSummary,
      detailedSummary: d.detailedSummary,
      extractedEntities: d.extractedEntities as object,
      extractedMeasurements: d.extractedMeasurements as object,
      extractedAmounts: d.extractedAmounts as object,
      extractedDates: d.extractedDates as object,
      extractedPeople: d.extractedPeople as object,
      extractedMaterials: d.extractedMaterials as object,
      extractedRisks: d.extractedRisks as object,
      confidenceScore: d.confidenceScore,
      processingStatus: "COMPLETED",
      processedAt: new Date(),
      processingError: null,
    },
  });

  if (input.actorUserId) {
    await logAiEvent({
      userId: input.actorUserId,
      action: "file_extraction",
      entityType: att.entityType,
      entityId: att.entityId,
      model: process.env.AI_MODEL ?? null,
      ok: true,
      metadata: {
        attachmentId,
        category: d.detectedCategory,
        confidence: d.confidenceScore,
      },
    });
  }
}

export function scheduleFileAiProcessing(
  attachmentId: string,
  actorUserId?: string | null,
): void {
  void processFileAiExtraction({ attachmentId, actorUserId }).catch((e) => {
    console.error("[scheduleFileAiProcessing]", attachmentId, e);
  });
}
