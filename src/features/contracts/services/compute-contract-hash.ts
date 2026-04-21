import crypto from "node:crypto";

export async function computeBufferSha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
