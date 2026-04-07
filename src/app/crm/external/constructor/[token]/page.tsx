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

  const room = await prisma.dealConstructorRoom.findFirst({
    where: { publicToken: token },
    include: {
      deal: {
        select: {
          id: true,
          title: true,
          client: { select: { name: true } },
          productionFlow: { select: { number: true, status: true } },
        },
      },
    },
  });

  if (!room) {
    notFound();
  }

  const flow = room.deal.productionFlow;

  return (
    <ExternalConstructorWorkspace
      token={token}
      snapshot={{
        productionNumber: flow?.number ?? room.deal.title,
        dealTitle: room.deal.title,
        clientName: room.deal.client.name,
        status: room.status,
        dueDate: room.dueAt?.toISOString() ?? null,
        constructorExternalName: room.externalConstructorLabel,
      }}
    />
  );
}
