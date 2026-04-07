import { notFound, redirect } from "next/navigation";
import { LeadEstimateEditorClient } from "../../../../../../modules/leads/lead-estimate/LeadEstimateEditorClient";
import { getLeadById } from "../../../../../../features/leads/queries";
import { getSessionAccess } from "../../../../../../lib/authz/session-access";
import {
  prisma,
  prismaCodegenIncludesEstimateLeadId,
} from "../../../../../../lib/prisma";

type PageProps = {
  params: Promise<{ leadId: string; estimateId: string }>;
};

export default async function LeadEstimatePage({ params }: PageProps) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");

  const { leadId, estimateId } = await params;

  if (!prismaCodegenIncludesEstimateLeadId()) {
    notFound();
  }

  const row = await prisma.estimate.findFirst({
    where: { id: estimateId, leadId },
    select: {
      id: true,
      lead: { select: { dealId: true } },
    },
  });
  if (!row || row.lead.dealId) {
    notFound();
  }

  const lead = await getLeadById(leadId, access.ctx);
  if (!lead) {
    notFound();
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50">
      <LeadEstimateEditorClient
        leadId={leadId}
        estimateId={estimateId}
        leadTitle={lead.title}
      />
    </div>
  );
}
