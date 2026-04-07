import type { Metadata } from "next";
import { DealsListPage } from "../_components/DealsListPage";
import { DEAL_LIST_COPY } from "../_components/deals-list-copy";

export const metadata: Metadata = {
  title: `${DEAL_LIST_COPY.negotiation.title} · ENVER CRM`,
};

export default function DealsNegotiationPage() {
  return <DealsListPage view="negotiation" />;
}
