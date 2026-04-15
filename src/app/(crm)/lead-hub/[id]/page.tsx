import { redirect } from "next/navigation";
import { toQueryString } from "@/lib/routing/to-query-string";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeadHubPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = toQueryString((await searchParams) ?? {});
  redirect(`/leads/${id}${query}`);
}
