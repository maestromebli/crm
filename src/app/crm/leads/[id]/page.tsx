import { permanentRedirect } from "next/navigation";
import { toQueryString } from "@/lib/routing/to-query-string";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Canonical CRM lead path.
 * Compatibility wrapper keeps `/leads/:id` as the rendered page while route trees converge.
 */
export default async function CrmLeadCanonicalPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const query = toQueryString((await searchParams) ?? {});
  permanentRedirect(`/leads/${id}${query}`);
}
