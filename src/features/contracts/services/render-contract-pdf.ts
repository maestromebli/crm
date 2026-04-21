import { computeBufferSha256 } from "./compute-contract-hash";

export async function renderContractPdf(input: {
  html: string;
  upload: (fileName: string, buffer: Buffer, contentType: string) => Promise<string>;
  contractNumber: string;
}) {
  // Temporary renderer placeholder: replace with Playwright/Puppeteer renderer.
  const buffer = Buffer.from(input.html, "utf-8");
  const hash = await computeBufferSha256(buffer);
  const url = await input.upload(
    `${input.contractNumber}.pdf`,
    buffer,
    "application/pdf",
  );
  return { url, hash };
}
