import { redirect } from "next/navigation";

type Props = { params: Promise<{ dealId: string }> };

/** Канонічний досвід — єдине робоче місце угоди. */
export default async function DealRootPage({ params }: Props) {
  const { dealId } = await params;
  redirect(`/deals/${dealId}/workspace`);
}
