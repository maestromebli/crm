import { permanentRedirect } from "next/navigation";
import { toQueryString } from "@/lib/routing/to-query-string";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CrmDealPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = toQueryString((await searchParams) ?? {});
  permanentRedirect(`/deals/${id}/workspace${query}`);
}
