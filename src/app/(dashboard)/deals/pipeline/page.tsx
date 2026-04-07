import type { Metadata } from "next";
import { DealsListPage } from "../_components/DealsListPage";
import { DEAL_LIST_COPY } from "../_components/deals-list-copy";

export const metadata: Metadata = {
  title: `${DEAL_LIST_COPY.pipeline.title} · ENVER CRM`,
};

export default function DealsPipelinePage() {
  return <DealsListPage view="pipeline" defaultLayout="board" />;
}
