import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";
import {
  canTransitionWorkflow,
  normalizeWorkflowStatus,
} from "@/features/procurement/lib/workflow";
import { extractTextFromBuffer } from "@/features/ai/file-intelligence/extract-local-buffer";
import { openAiChatJson } from "@/features/ai/core/openai-client";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ requestId: string }>;
};

type ParsedSupplierLine = {
  name: string;
  qty: number;
  unitPrice: number;
  total?: number | null;
};

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_\-./\\]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeLabel(value)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function overlapScore(a: string, b: string): number {
  const at = new Set(tokenize(a));
  const bt = new Set(tokenize(b));
  if (at.size === 0 || bt.size === 0) return 0;
  let overlap = 0;
  for (const token of at) {
    if (bt.has(token)) overlap += 1;
  }
  return overlap / Math.max(at.size, bt.size);
}

function numberOrZero(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function maybeNumber(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).replace(",", ".").replace(/[^\d.-]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWithHeuristicsFromText(text: string): ParsedSupplierLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const result: ParsedSupplierLine[] = [];
  for (const line of lines) {
    if (line.length < 3) continue;
    const nums = line.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
    if (nums.length < 2) continue;
    const qty = maybeNumber(nums[0]) ?? 0;
    const unitPrice = maybeNumber(nums[1]) ?? 0;
    const total = maybeNumber(nums[2] ?? null);
    if (qty <= 0 || unitPrice <= 0) continue;
    const name = line.replace(/-?\d+(?:[.,]\d+)?/g, " ").replace(/\s+/g, " ").trim();
    if (!name) continue;
    result.push({ name, qty, unitPrice, total });
    if (result.length >= 120) break;
  }
  return result;
}

async function parseSupplierLinesByAi(
  text: string,
): Promise<ParsedSupplierLine[] | null> {
  const res = await openAiChatJson<{ lines?: ParsedSupplierLine[] }>({
    system:
      "Ти парсер рахунків постачальника. Поверни тільки JSON-об'єкт з ключем lines. " +
      "Кожен line має поля: name (string), qty (number), unitPrice (number), total (number|null). " +
      "Ігноруй службові рядки та підсумкові заголовки.",
    user: `Розбери документ у рядки товарів:\n\n${text.slice(0, 24_000)}`,
    temperature: 0.1,
    maxTokens: 1200,
  });
  if (!res.ok) return null;
  const rows = Array.isArray(res.data?.lines) ? res.data.lines : [];
  return rows
    .map((row) => ({
      name: String(row.name ?? "").trim(),
      qty: numberOrZero(row.qty),
      unitPrice: numberOrZero(row.unitPrice),
      total: row.total == null ? null : numberOrZero(row.total),
    }))
    .filter((row) => row.name && row.qty > 0 && row.unitPrice > 0)
    .slice(0, 200);
}

async function parseSupplierLinesFromFile(file: File): Promise<{
  lines: ParsedSupplierLine[];
  extractedText: string | null;
}> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name || "supplier-file";
  const mimeType = file.type || "application/octet-stream";

  const extracted = await extractTextFromBuffer({
    buffer,
    mimeType,
    fileName,
  });
  const text = extracted.text?.trim() || null;
  if (!text) return { lines: [], extractedText: null };

  const aiLines = await parseSupplierLinesByAi(text);
  if (aiLines && aiLines.length > 0) {
    return { lines: aiLines, extractedText: text };
  }
  return {
    lines: parseWithHeuristicsFromText(text),
    extractedText: text,
  };
}

export async function POST(req: Request, { params }: Params) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.request.create")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const { requestId } = await params;
    if (!requestId?.trim()) {
      return NextResponse.json({ error: "Не вказано ідентифікатор заявки" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передано" }, { status: 400 });
    }

    const entity = await prisma.procurementRequest.findUnique({
      where: { id: requestId },
      include: {
        deal: { select: { ownerId: true } },
        items: {
          select: {
            id: true,
            name: true,
            qtyPlanned: true,
            qtyOrdered: true,
            qtyReceived: true,
            plannedPrice: true,
            actualPrice: true,
            status: true,
          },
        },
      },
    });
    if (!entity) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    if (!canAccessOwner(access, entity.deal.ownerId)) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const parsed = await parseSupplierLinesFromFile(file);
    if (!parsed.lines.length) {
      return NextResponse.json(
        {
          error:
            "Не вдалося розпізнати позиції у файлі. Перевірте структуру PDF/XLSX або завантажте таблицю з колонками назва/кількість/ціна.",
        },
        { status: 422 },
      );
    }

    const updates: Array<{
      itemId: string;
      lineName: string;
      matchedBy: string;
      qtyOrdered: number;
      unitPrice: number;
      supplierLineIndex: number;
    }> = [];
    const usedLineIndexes = new Set<number>();

    for (const item of entity.items) {
      let bestIndex = -1;
      let bestScore = 0;
      for (let index = 0; index < parsed.lines.length; index += 1) {
        if (usedLineIndexes.has(index)) continue;
        const line = parsed.lines[index]!;
        const score = overlapScore(item.name ?? "", line.name);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      if (bestIndex < 0 || bestScore < 0.34) continue;
      usedLineIndexes.add(bestIndex);
      const line = parsed.lines[bestIndex]!;
      updates.push({
        itemId: item.id,
        lineName: line.name,
        matchedBy: `${Math.round(bestScore * 100)}%`,
        qtyOrdered: Math.max(numberOrZero(item.qtyOrdered), line.qty),
        unitPrice: line.unitPrice,
        supplierLineIndex: bestIndex,
      });
    }

    if (!updates.length) {
      return NextResponse.json(
        {
          error: "Позиції з файлу не співпали з заявкою. Перевірте назви матеріалів у заявці та у файлі постачальника.",
        },
        { status: 422 },
      );
    }

    const invoiceAmount = parsed.lines.reduce((sum, line) => {
      const total = line.total ?? line.qty * line.unitPrice;
      return sum + Math.max(0, total);
    }, 0);
    const fromStatus = normalizeWorkflowStatus(entity.workflowStatus);
    let currentStatus = fromStatus;
    const statusTransitions: Array<{ from: string; to: string; reason: string }> = [];
    if (canTransitionWorkflow(currentStatus, "supplier_invoice_uploaded")) {
      statusTransitions.push({
        from: currentStatus,
        to: "supplier_invoice_uploaded",
        reason: `Завантажено файл постачальника: ${file.name}`,
      });
      currentStatus = "supplier_invoice_uploaded";
    }
    if (canTransitionWorkflow(currentStatus, "invoice_ai_matched")) {
      statusTransitions.push({
        from: currentStatus,
        to: "invoice_ai_matched",
        reason: "AI розподілив позиції постачальника по рядках заявки",
      });
      currentStatus = "invoice_ai_matched";
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.procurementRequestItem.update({
          where: { id: u.itemId },
          data: {
            qtyOrdered: u.qtyOrdered,
            actualPrice: u.unitPrice,
            costActual: u.unitPrice,
            status: "ORDERED",
          },
        });
      }

      const requestUpdate = await tx.procurementRequest.update({
        where: { id: requestId },
        data: {
          workflowStatus: currentStatus,
          status: "ORDERED",
          invoiceAttachmentUrl: `uploaded:${file.name}`,
          invoiceAmount,
          comment: `${entity.comment ? `${entity.comment}\n` : ""}[${new Date().toISOString()}] ` +
            `Файл постачальника завантажено: ${file.name}. AI-співпадінь: ${updates.length}/${entity.items.length}.`,
        },
        select: {
          id: true,
          workflowStatus: true,
          status: true,
          invoiceAmount: true,
        },
      });

      for (const transition of statusTransitions) {
        await tx.procurementRequestStatusHistory.create({
          data: {
            requestId,
            fromStatus: transition.from,
            toStatus: transition.to,
            actorId: user.id,
            actorRole: user.realRole,
            reason: transition.reason,
            payload: {
              fileName: file.name,
              matchedItems: updates.length,
              parsedItems: parsed.lines.length,
              parsedLines: parsed.lines.map((line, idx) => ({
                index: idx,
                name: line.name,
                qty: line.qty,
                unitPrice: line.unitPrice,
                total: line.total ?? line.qty * line.unitPrice,
              })),
              matchedRows: updates.map((u) => ({
                itemId: u.itemId,
                supplierLineIndex: u.supplierLineIndex,
                lineName: u.lineName,
                matchedBy: u.matchedBy,
                qtyOrdered: u.qtyOrdered,
                unitPrice: u.unitPrice,
              })),
            },
          },
        });
      }
      return requestUpdate;
    });

    return NextResponse.json({
      ok: true,
      request: updated,
      aiMatch: {
        parsedItems: parsed.lines.length,
        matchedItems: updates.length,
        unmatchedRequestItems: Math.max(0, entity.items.length - updates.length),
        rows: updates,
      },
      extractedTextPreview: parsed.extractedText?.slice(0, 600) ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/requests/[requestId]/supplier-file]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
