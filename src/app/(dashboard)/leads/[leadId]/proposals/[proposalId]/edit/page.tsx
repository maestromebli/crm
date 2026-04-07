import type { Metadata } from "next";
import { ProposalQuoteEditorClient } from "../../../../../../../modules/leads/lead-proposal/ProposalQuoteEditorClient";
import { requireSessionForAppLayout } from "../../../../../../../lib/authz/page-auth";

export const metadata: Metadata = {
  title: "Редактор КП — ENVER CRM",
};

type Props = { params: Promise<{ leadId: string; proposalId: string }> };

export default async function ProposalEditPage({ params }: Props) {
  await requireSessionForAppLayout();
  const { leadId, proposalId } = await params;
  return (
    <ProposalQuoteEditorClient leadId={leadId} proposalId={proposalId} />
  );
}
