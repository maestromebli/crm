import { readFile } from "node:fs/promises";
import path from "node:path";

export type ExtractMode = "text" | "pdf" | "image" | "binary" | "unsupported";

/**
 * Читає файл з `public/…` (шлях як у Attachment.fileUrl).
 */
export async function extractTextFromLeadPublicFile(args: {
  publicPath: string;
  mimeType: string;
}): Promise<{ text: string | null; mode: ExtractMode }> {
  const rel = args.publicPath.replace(/^\/+/, "");
  const abs = path.join(process.cwd(), "public", rel);
  const mime = args.mimeType.toLowerCase();

  if (mime.startsWith("text/") || mime === "application/csv") {
    try {
      const buf = await readFile(abs);
      const text = buf.toString("utf8").trim();
      return { text: text.length > 0 ? text : null, mode: "text" };
    } catch {
      return { text: null, mode: "unsupported" };
    }
  }

  if (mime === "application/pdf") {
    try {
      const buf = await readFile(abs);
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buf });
      const data = await parser.getText();
      const text = (data.text ?? "").trim();
      return { text: text.length > 2 ? text : null, mode: "pdf" };
    } catch {
      return { text: null, mode: "pdf" };
    }
  }

  if (mime.startsWith("image/")) {
    return { text: null, mode: "image" };
  }

  return { text: null, mode: "binary" };
}

export async function readFileAsBase64(publicPath: string): Promise<string> {
  const rel = publicPath.replace(/^\/+/, "");
  const abs = path.join(process.cwd(), "public", rel);
  const buf = await readFile(abs);
  return buf.toString("base64");
}
