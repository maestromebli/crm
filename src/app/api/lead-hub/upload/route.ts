import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

export const runtime = "nodejs";

function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

async function saveMultipartFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeFilename(file.name || "upload.bin");
  const key = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const relativeDir = path.join("uploads", "lead-hub");
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  const absolutePath = path.join(absoluteDir, key);
  await writeFile(absolutePath, buffer);
  return {
    fileName: safeName,
    fileUrl: `/${relativeDir.replaceAll("\\", "/")}/${key}`,
    mimeType: file.type || "application/octet-stream",
    fileSize: buffer.byteLength,
  };
}

export async function POST(req: Request) {
  /**
   * @deprecated Legacy lead-hub upload endpoint.
   * Keep for compatibility while lead files converge to `/api/leads/*`.
   */
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.FILES_UPLOAD);
  if (denied) return denied;

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";

  let body: {
    sessionId?: string;
    role?: "IMAGE" | "CALC_SOURCE" | "DOC";
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    fileSize?: number;
  } = {};

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const sessionId = String(form.get("sessionId") ?? "");
    const roleRaw = String(form.get("role") ?? "DOC");
    const file = form.get("file");
    if (!sessionId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Для multipart-завантаження потрібні sessionId і file" },
        { status: 400 },
      );
    }
    const saved = await saveMultipartFile(file);
    body = {
      sessionId,
      role:
        roleRaw === "IMAGE" || roleRaw === "CALC_SOURCE" || roleRaw === "DOC"
          ? roleRaw
          : "DOC",
      fileName: saved.fileName,
      fileUrl: saved.fileUrl,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
    };
  } else {
    body = (await req.json()) as typeof body;
  }

  if (!body.sessionId || !body.fileName || !body.fileUrl || !body.mimeType) {
    return NextResponse.json(
      { error: "Потрібно передати sessionId, fileName, fileUrl і mimeType" },
      { status: 400 },
    );
  }

  const session = await prisma.leadHubSession.findUnique({
    where: { id: body.sessionId },
    select: { id: true, leadId: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Сесію lead hub не знайдено" }, { status: 404 });
  }

  const attachment = await prisma.attachment.create({
    data: {
      fileName: body.fileName,
      fileUrl: body.fileUrl,
      mimeType: body.mimeType,
      fileSize: Number(body.fileSize ?? 0),
      category: "OTHER",
      entityType: "LEAD",
      entityId: session.leadId ?? session.id,
      uploadedById: user.id,
    },
  });

  const leadHubFile = await prisma.leadHubFile.create({
    data: {
      sessionId: session.id,
      attachmentId: attachment.id,
      role: body.role ?? "DOC",
    },
  });

  return NextResponse.json({
    ok: true,
    file: {
      id: leadHubFile.id,
      attachmentId: attachment.id,
      role: leadHubFile.role,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
    },
  });
}
