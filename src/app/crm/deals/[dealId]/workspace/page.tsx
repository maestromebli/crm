import { permanentRedirect } from "next/navigation";
import { toQueryString } from "@/lib/routing/to-query-string";

type Props = {
  params: Promise<{ dealId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Canonical CRM alias for deal workspace.
 * Keeps `/deals/:dealId/workspace` as operational source during convergence.
 */
export default async function CrmDealWorkspaceAliasPage({
  params,
  searchParams,
}: Props) {
  const { dealId } = await params;
  const query = toQueryString((await searchParams) ?? {});
  permanentRedirect(`/deals/${dealId}/workspace${query}`);
}
