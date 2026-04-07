import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ConstructorPortalClient } from "./ConstructorPortalClient";
import { prisma } from "../../../lib/prisma";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const t = token?.trim();
  let title = "Кімната конструктора";
  if (t && process.env.DATABASE_URL?.trim()) {
    try {
      const room = await prisma.dealConstructorRoom.findFirst({
        where: { publicToken: t },
        select: { deal: { select: { title: true } } },
      });
      if (room?.deal.title) {
        const raw = room.deal.title.trim();
        const short =
          raw.length > 56 ? `${raw.slice(0, 53)}…` : raw;
        title = `${short} · ENVER`;
      }
    } catch {
      /* залишаємо заголовок за замовчуванням */
    }
  }
  return {
    title,
    robots: { index: false, follow: false },
  };
}

export default async function ConstructorPublicPage({ params }: PageProps) {
  const { token } = await params;
  const t = token?.trim();
  if (!t) notFound();

  const exists = await prisma.dealConstructorRoom.findFirst({
    where: { publicToken: t },
    select: { id: true },
  });
  if (!exists) notFound();

  return <ConstructorPortalClient token={t} />;
}
