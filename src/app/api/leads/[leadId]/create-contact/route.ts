import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { ensureContactForLead } from "../../../../../lib/leads/ensure-contact-from-lead";
import { prisma } from "../../../../../lib/prisma";

type Ctx = { params: Promise<{ leadId: string }> };

/** Ідемпотентне створення контакта з полів ліда (те саме, що й автоматичне на POST/PATCH ліда). */
export async function POST(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
    if (denied) return denied;

    const { created, contactId } = await ensureContactForLead(prisma, leadId);

    if (!contactId) {
      return NextResponse.json(
        {
          error:
            "Недостатньо даних для контакту (потрібні імʼя, телефон або email на картці ліда)",
        },
        { status: 400 },
      );
    }

    if (!created) {
      return NextResponse.json(
        { error: "До ліда вже привʼязано контакт" },
        { status: 409 },
      );
    }

    await appendActivityLog({
      entityType: "LEAD",
      entityId: leadId,
      type: "LEAD_UPDATED",
      actorUserId: user.id,
      data: { fields: ["contactId"], createdContactId: contactId },
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/contact`);
    revalidatePath(`/contacts/${contactId}`);

    return NextResponse.json({
      ok: true,
      contactId,
    });
  } catch (e) {
     
    console.error("[POST leads/create-contact]", e);
    return NextResponse.json({ error: "Помилка створення контакту" }, {
      status: 500,
    });
  }
}
