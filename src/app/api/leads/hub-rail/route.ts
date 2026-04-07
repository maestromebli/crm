import { NextResponse } from "next/server";
import { listLeadsByView } from "../../../../features/leads/queries";
import { forbidUnlessPermission, requireSessionUser } from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import { getSessionAccess } from "../../../../lib/authz/session-access";

export const runtime = "nodejs";

const VIEWS = new Set([
  "all",
  "mine",
  "new",
  "no-response",
  "no-next-step",
  "overdue",
  "duplicates",
  "re-contact",
  "converted",
  "unassigned",
  "qualified",
  "lost",
]);

/**
 * Компактний список лідів для Lead Hub (ліва колонка): пошук + фільтр вигляду.
 */
export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_VIEW);
  if (denied) return denied;

  const access = await getSessionAccess();
  if (!access) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawView = searchParams.get("view") ?? "all";
  const view = VIEWS.has(rawView) ? rawView : "all";
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const { rows, error } = await listLeadsByView(
    view,
    access.ctx,
    view === "mine" ? { mineUserId: access.userId } : undefined,
  );

  if (error) {
    return NextResponse.json({ error, items: [] }, { status: 200 });
  }

  let filtered = rows;
  if (q) {
    filtered = rows.filter((r) => {
      const title = r.title.toLowerCase();
      const phone = (r.phone ?? r.contact?.phone ?? "").toLowerCase();
      const stage = r.stage.name.toLowerCase();
      return title.includes(q) || phone.includes(q) || stage.includes(q);
    });
  }

  const items = filtered.slice(0, 100).map((r) => ({
    id: r.id,
    title: r.title,
    stageName: r.stage.name,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json({ items, error: null });
}
