import type { QuotePrintModel } from "../../../lib/leads/lead-proposal-document";
import { QuotePrintView } from "./QuotePrintView";

type Props = { model: QuotePrintModel };

/** Публічний перегляд / друк КП (груповані позиції). */
export function LeadProposalDocumentView({ model }: Props) {
  return <QuotePrintView model={model} />;
}
