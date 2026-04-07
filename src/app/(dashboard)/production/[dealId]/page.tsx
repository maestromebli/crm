import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ dealId: string }> };

export default async function ProductionDealRedirectPage(props: PageProps) {
  const { dealId } = await props.params;
  try {
    const flow = await prisma.productionFlow.findUnique({
      where: { dealId },
      select: { id: true },
    });
    if (flow) {
      redirect(`/crm/production/${flow.id}`);
    }
  } catch {
    /* таблиці ще немає після міграції */
  }
  redirect(`/deals/${dealId}/workspace?tab=production`);
}
