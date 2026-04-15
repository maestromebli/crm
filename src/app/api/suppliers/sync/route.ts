import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import {
  getSupplierSyncStatus,
  runSupplierFileSync,
} from "../../../../features/suppliers/services/supplierSyncService";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  const status = await getSupplierSyncStatus();
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  const providerKey = String(form.get("providerKey") ?? "viyar");
  const providerName = String(form.get("providerName") ?? "Viyar");
  const modeRaw = String(form.get("mode") ?? "append");
  const mode = modeRaw === "replace" ? "replace" : "append";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передано" }, { status: 400 });
  }
  try {
    const summary = await runSupplierFileSync({
      providerKey,
      providerName,
      mode,
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Supplier sync failed" },
      { status: 400 },
    );
  }
}
