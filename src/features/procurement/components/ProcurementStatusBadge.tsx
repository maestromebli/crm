import { StatusBadge } from "../../../components/shared/StatusBadge";

export function ProcurementStatusBadge({ status }: { status: string }) {
  if (status === "DELIVERED" || status === "RECEIVED" || status === "CLOSED") {
    return <StatusBadge label={status} tone="success" />;
  }
  if (status.includes("PARTIALLY")) return <StatusBadge label={status} tone="warning" />;
  if (status === "CANCELLED") return <StatusBadge label={status} tone="danger" />;
  return <StatusBadge label={status} tone="info" />;
}

