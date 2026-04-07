import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ dealId: string }> };

export default async function ProductionDealRedirectPage(props: PageProps) {
  const { dealId } = await props.params;
  try {
    const po = await prisma.productionOrder.findUnique({
      where: { dealId },
      select: { id: true },
    });
    if (po) {
      redirect(`/crm/production/${po.id}`);
    }
  } catch {
    /* таблиці ще немає після міграції */
  }
  redirect(`/deals/${dealId}/workspace?tab=production`);
}
