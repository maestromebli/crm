import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExternalConstructorWorkspace } from "./workspace-client";

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Конструктор · ENVER",
  robots: { index: false, follow: false },
};

export default async function ExternalConstructorPage(props: PageProps) {
  const { token } = await props.params;
  if (!token?.trim()) notFound();

  const orch = await prisma.productionOrchestration.findFirst({
    where: { externalWorkspaceToken: token },
    include: {
      deal: {
        select: {
          id: true,
          title: true,
          client: { select: { name: true } },
        },
      },
    },
  });

  if (!orch) {
    notFound();
  }

  return (
    <ExternalConstructorWorkspace
      token={token}
      snapshot={{
        productionNumber: orch.productionNumber,
        dealTitle: orch.deal.title,
        clientName: orch.deal.client.name,
        status: orch.status,
        dueDate: orch.dueDate?.toISOString() ?? null,
        constructorExternalName: orch.constructorExternalName,
      }}
    />
  );
}
