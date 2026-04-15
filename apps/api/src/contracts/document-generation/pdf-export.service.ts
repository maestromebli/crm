import { Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

@Injectable()
export class PdfExportService {
  async exportHtmlToPdf(html: string, title: string): Promise<Buffer> {
    const document = await PDFDocument.create();
    const page = document.addPage([595.28, 841.89]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    const content = html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    page.drawText(title, { x: 40, y: 800, size: 14, font, color: rgb(0.1, 0.1, 0.1) });
    let y = 776;
    const maxLine = 90;
    for (let i = 0; i < content.length && y > 40; i += maxLine) {
      const line = content.slice(i, i + maxLine);
      page.drawText(line, { x: 40, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 13;
    }

    const bytes = await document.save();
    return Buffer.from(bytes);
  }
}
