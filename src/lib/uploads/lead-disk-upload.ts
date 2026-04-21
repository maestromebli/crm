import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 20 * 1024 * 1024;

const STORAGE_UPLOADS = path.join(process.cwd(), "storage", "uploads");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

function extFromName(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i >= name.length - 1) return "";
  return name.slice(i + 1).toLowerCase().slice(0, 8);
}

function mimeFromExt(ext: string): string | null {
  const m: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    zip: "application/zip",
  };
  return m[ext] ?? null;
}

function sanitizeBaseName(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, "")
    .replace(/[^\w.\- ()\u0400-\u04FF]+/g, "_")
    .trim();
  return base.slice(0, 180) || "file";
}

export type SavedLeadFile = {
  /** Відносний ключ у `storage/uploads/` */
  storageKey: string;
  /** URL API-завантаження (потрібна авторизація + FILES_VIEW) */
  fileUrl: string;
  storedName: string;
  bytes: number;
  mimeType: string;
  originalName: string;
};

/**
 * Абсолютний шлях до файлу на диску для читання (приватне сховище або legacy public).
 */
export function resolveAttachmentAbsolutePath(args: {
  storageKey: string | null | undefined;
  fileUrl: string;
}): string | null {
  const { storageKey, fileUrl } = args;
  if (storageKey?.trim()) {
    const safe = storageKey
      .trim()
      .replace(/^[/\\]+/, "")
      .split(/[/\\]/)
      .filter((p) => p && p !== "..")
      .join(path.sep);
    if (
      !safe.startsWith("leads" + path.sep) &&
      !safe.startsWith("deals" + path.sep)
    ) {
      return null;
    }
    return path.join(STORAGE_UPLOADS, safe);
  }
  if (fileUrl.startsWith("/uploads/")) {
    const rel = fileUrl.replace(/^\//, "").split("/").filter((p) => p && p !== "..").join(path.sep);
    return path.join(process.cwd(), "public", rel);
  }
  return null;
}

/**
 * Зберігає файл у `storage/uploads/leads/{leadId}/` (не в `public/`).
 * `attachmentId` має збігатися з id запису Attachment у БД.
 */
export async function saveLeadUploadPrivate(opts: {
  leadId: string;
  attachmentId: string;
  file: File;
}): Promise<SavedLeadFile> {
  const { leadId, file, attachmentId } = opts;
  if (file.size <= 0) {
    throw new Error("EMPTY_FILE");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  let mime = (file.type || "").trim().toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    const guess = mimeFromExt(extFromName(file.name));
    if (guess) mime = guess;
  }
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("MIME_NOT_ALLOWED");
  }

  const originalName = sanitizeBaseName(file.name);
  const diskSafe = originalName.replace(/\s+/g, "_");
  const storedName = `${randomUUID()}-${diskSafe}`;
  const dir = path.join(STORAGE_UPLOADS, "leads", leadId);
  await mkdir(dir, { recursive: true });
  const absPath = path.join(dir, storedName);

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length !== file.size) {
    throw new Error("SIZE_MISMATCH");
  }
  await writeFile(absPath, buf);

  const storageKey = `leads/${leadId}/${storedName}`;
  const fileUrl = `/api/attachments/${attachmentId}/download`;

  return {
    storageKey,
    fileUrl,
    storedName,
    bytes: buf.length,
    mimeType: mime,
    originalName,
  };
}

/** Зберігає буфер (PDF тощо) у приватне сховище. */
export async function saveLeadBufferPrivate(opts: {
  leadId: string;
  attachmentId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<SavedLeadFile> {
  const { leadId, buffer, fileName, mimeType, attachmentId } = opts;
  if (buffer.length <= 0) {
    throw new Error("EMPTY_FILE");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  const mime = mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("MIME_NOT_ALLOWED");
  }
  const originalName = sanitizeBaseName(fileName);
  const diskSafe = originalName.replace(/\s+/g, "_");
  const storedName = `${randomUUID()}-${diskSafe}`;
  const dir = path.join(STORAGE_UPLOADS, "leads", leadId);
  await mkdir(dir, { recursive: true });
  const absPath = path.join(dir, storedName);
  await writeFile(absPath, buffer);
  const storageKey = `leads/${leadId}/${storedName}`;
  const fileUrl = `/api/attachments/${attachmentId}/download`;
  return {
    storageKey,
    fileUrl,
    storedName,
    bytes: buffer.length,
    mimeType: mime,
    originalName,
  };
}

/** Зберігає буфер (PDF тощо) у приватне сховище для замовлення. */
export async function saveDealBufferPrivate(opts: {
  dealId: string;
  attachmentId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<SavedLeadFile> {
  const { dealId, buffer, fileName, mimeType, attachmentId } = opts;
  if (buffer.length <= 0) {
    throw new Error("EMPTY_FILE");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  const mime = mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("MIME_NOT_ALLOWED");
  }
  const originalName = sanitizeBaseName(fileName);
  const diskSafe = originalName.replace(/\s+/g, "_");
  const storedName = `${randomUUID()}-${diskSafe}`;
  const dir = path.join(STORAGE_UPLOADS, "deals", dealId);
  await mkdir(dir, { recursive: true });
  const absPath = path.join(dir, storedName);
  await writeFile(absPath, buffer);
  const storageKey = `deals/${dealId}/${storedName}`;
  const fileUrl = `/api/attachments/${attachmentId}/download`;
  return {
    storageKey,
    fileUrl,
    storedName,
    bytes: buffer.length,
    mimeType: mime,
    originalName,
  };
}

