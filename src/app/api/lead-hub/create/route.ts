import { NextResponse } from "next/server";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import {
  createLeadHubSession,
  getLeadHubSession,
} from "@/lib/leads/ultra-api";

/**
 * @deprecated Legacy lead-hub endpoint.
 * Keep for compatibility while canonical lead flow converges.
 */
export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_CREATE);
  if (denied) return denied;

  let body: { title?: string; leadId?: string | null; currency?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const created = await createLeadHubSession({
    title: body.title ?? null,
    leadId: body.leadId ?? null,
    currency: body.currency,
  });

  const full = await getLeadHubSession(created.id, user);
  return NextResponse.json(full, { status: 201 });
}
