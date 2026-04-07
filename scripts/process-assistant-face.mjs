/**
 * Видаляє суцільний світлий фон (зв’язна область із кутів кадру) і зберігає PNG з альфою.
 * Запуск: node scripts/process-assistant-face.mjs [вхідний.png] [вихідний.png]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const bundledSource = path.join(root, "scripts", "assistant-face-source.png");
const legacyCursorAsset = path.join(
  "C:",
  "Users",
  "user",
  ".cursor",
  "projects",
  "d-crm",
  "assets",
  "c__Users_user_AppData_Roaming_Cursor_User_workspaceStorage_966f92e1d571b6ae4d65ad4acd615751_images_photo_2026-04-03_17-02-17-d49a51cd-07ab-4602-bd4a-0292ea3fecdb.png",
);

const defaultIn = fs.existsSync(bundledSource)
  ? bundledSource
  : legacyCursorAsset;

const defaultOut = path.join(root, "public", "assistant", "assistant-face.png");

const inputPath = process.argv[2]
  ? path.isAbsolute(process.argv[2])
    ? process.argv[2]
    : path.join(root, process.argv[2])
  : defaultIn;
const outputPath = process.argv[3]
  ? path.isAbsolute(process.argv[3])
    ? process.argv[3]
    : path.join(root, process.argv[3])
  : defaultOut;

function matchBg(r, g, b, br, bg, bb, tol) {
  return (
    Math.abs(r - br) <= tol &&
    Math.abs(g - bg) <= tol &&
    Math.abs(b - bb) <= tol
  );
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error("Файл не знайдено:", inputPath);
    process.exit(1);
  }

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  if (ch !== 4) {
    console.error("Очікується RGBA");
    process.exit(1);
  }

  const px = new Uint8ClampedArray(data);
  const br = px[0];
  const bgc = px[1];
  const bb = px[2];
  const tol = 18;

  const visited = new Uint8Array(w * h);
  const queue = [];

  function idx(x, y) {
    return (y * w + x) * 4;
  }

  function tryPush(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (visited[i]) return;
    const o = idx(x, y);
    const r = px[o];
    const g = px[o + 1];
    const b = px[o + 2];
    if (!matchBg(r, g, b, br, bgc, bb, tol)) return;
    visited[i] = 1;
    queue.push(x, y);
  }

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++];
    const y = queue[qi++];
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  for (let i = 0; i < w * h; i++) {
    if (!visited[i]) continue;
    const o = i * 4;
    px[o + 3] = 0;
  }

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(px), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log("OK:", outputPath, `${w}×${h}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
