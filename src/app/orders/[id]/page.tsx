import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Canonical order route (compatibility wrapper during convergence).
 */
export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  redirect(`/deals/${id}/workspace?tab=production`);
}
