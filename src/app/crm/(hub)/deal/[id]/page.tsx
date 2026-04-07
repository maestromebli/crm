import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function CrmDealPage({ params }: Props) {
  const { id } = await params;
  redirect(`/deals/${id}/workspace`);
}
