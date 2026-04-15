import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ dealId: string }>;
};

export default async function CrmDealAliasPage({ params }: Props) {
  const { dealId } = await params;
  redirect(`/deals/${dealId}/workspace`);
}
