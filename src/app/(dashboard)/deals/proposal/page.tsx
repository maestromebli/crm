import type { Metadata } from "next";
import { DealsListPage } from "../_components/DealsListPage";
import { DEAL_LIST_COPY } from "../_components/deals-list-copy";

export const metadata: Metadata = {
  title: `${DEAL_LIST_COPY.proposal.title} · ENVER CRM`,
};

export default function DealsProposalPage() {
  return <DealsListPage view="proposal" />;
}
